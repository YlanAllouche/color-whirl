import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { buildBubbles, buildBubblesSeed, resolvePaletteConfig } from '@wallpaper-maker/core';
import type { EnvironmentStyle, TextureType } from '@wallpaper-maker/core';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { EnvironmentCache } from './preview-environment.js';
import { createRoundedBox, subdivideGeometry } from './preview-geometry.js';
import {
  applyToneMapping,
  chainOnBeforeCompile,
  clamp,
  createMaterialForColor,
  disposeMaterial,
  getEnabledPaletteOverride,
  getPopsicleGeometryMultipliers,
  hash01,
  makeSolidRedTexture01,
  setShadowType,
  textureParamsKey,
  type PopsicleConfig
} from './preview-utils.js';
import {
  autoFitOrthoCameraToBox,
  cameraZoomFromDistance,
  computeBounds,
  computeBoundsPerStick,
  degToRad,
  getStackingOffset,
  getStickDimensions,
  minDistanceToFitBoundingSphere,
  symmetricBoxFromSize,
  type Bounds
} from './preview-layout.js';

type PreviewQuality = 'interactive' | 'final';
export type PreviewRenderMode = 'raster' | 'path';

export class PopsiclePreview {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private mode: PreviewRenderMode = 'raster';

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  // Raster state
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private sticksGroup!: THREE.Group;
  private outlineGroup!: THREE.Group;
  private outlineMeshes: THREE.Mesh[] = [];
  private outlineMaterial: THREE.MeshBasicMaterial | null = null;
  private stickMeshes: THREE.Mesh[] = [];
  private stickMaterialCache = new Map<string, THREE.Material | THREE.Material[]>();
  private stickGeometryCache = new Map<string, THREE.BufferGeometry>();
  private envCache = new EnvironmentCache();

  // Collision masking (raster only)
  private collisionDepthMat: THREE.MeshDepthMaterial | null = null;
  private collisionDummy: THREE.DataTexture | null = null;
  private collisionRTs: THREE.WebGLRenderTarget[] = [];
  private collisionRTW = 0;
  private collisionRTH = 0;

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  // Path tracing state
  private pathTracer: any = null;
  private bvhWorker: any = null;
  private pathTracingLoopId = 0;
  private lastPathSceneKey = '';
  private lastPathCameraKey = '';
  private lastPathQuality: PreviewQuality = 'final';
  private pathScene: THREE.Scene | null = null;
  private pathCamera: THREE.PerspectiveCamera | null = null;
  private pathInitPromise: Promise<void> | null = null;
  private pathRenderToken = 0;
  private pathSceneBuilding = false;
  private pendingPathRequest: { config: PopsicleConfig; quality: PreviewQuality } | null = null;
  private lastPathPreviewW = 0;
  private lastPathPreviewH = 0;
  private pathPresentQuad: FullScreenQuad | null = null;
  private pathToneMappingMode: 'aces' | 'none' = 'aces';

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false
    });
    this.renderer.domElement.style.display = 'block';
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Use renderer clear color for the solid background.
    this.scene.background = null;

    this.outlineGroup = new THREE.Group();
    this.outlineGroup.renderOrder = -1;
    this.scene.add(this.outlineGroup);
   
    this.sticksGroup = new THREE.Group();
    this.scene.add(this.sticksGroup);

    const frustumSize = 10;
    this.camera = new THREE.OrthographicCamera(
      frustumSize / -2,
      frustumSize / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x0b0b10, 0.15);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.25);

    this.scene.add(this.ambientLight, this.hemiLight, this.keyLight, this.fillLight, this.rimLight);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setMode(mode: PreviewRenderMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'raster') {
      this.stopPathTracingLoop();
      // Nothing else to do; raster scene is already resident.
      return;
    }

    // Lazily init path tracer when requested.
    if (!this.pathInitPromise) {
      this.pathInitPromise = this.initPathTracer();
    }
  }

  dispose(): void {
    this.stopPathTracingLoop();
    this.pathTracer?.dispose?.();
    this.pathTracer = null;

    this.pathSceneBuilding = false;
    this.pendingPathRequest = null;

    try {
      this.bvhWorker?.dispose?.();
    } catch {
      // Ignore.
    }
    this.bvhWorker = null;

    this.pathScene = null;
    this.pathCamera = null;
    this.lastPathPreviewW = 0;
    this.lastPathPreviewH = 0;
    this.pathPresentQuad?.dispose();
    this.pathPresentQuad = null;

    for (const g of this.stickGeometryCache.values()) g.dispose();
    this.stickGeometryCache.clear();
    for (const m of this.stickMaterialCache.values()) disposeMaterial(m);
    this.stickMaterialCache.clear();
    this.stickMeshes = [];
    this.sticksGroup.clear();

    this.outlineMeshes = [];
    this.outlineGroup.clear();
    this.outlineMaterial?.dispose();
    this.outlineMaterial = null;
    this.envCache.dispose();

    for (const rt of this.collisionRTs) rt.dispose();
    this.collisionRTs = [];
    this.collisionDepthMat?.dispose();
    this.collisionDepthMat = null;
    this.collisionDummy?.dispose();
    this.collisionDummy = null;
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.renderer.dispose();
    this.container.innerHTML = '';
  }

  resize(): void {
    // Render size is set during renderOnce based on current config.
  }

  renderOnce(config: PopsicleConfig, quality: PreviewQuality): void {
    if (this.mode === 'path') {
      // While dragging / scrubbing controls, path tracing scene rebuilds can be expensive.
      // Use the raster pipeline for interactive frames and only path trace on the settled (final) frame.
      if (quality === 'interactive') {
        try {
          this.stopPathTracingLoop();
        } catch {
          // Ignore.
        }
        this.renderOnceRaster(config, quality);
        return;
      }

      void this.renderOncePath(config, quality).catch((err) => {
        // Never leave the UI blank if path tracing setup fails.
        console.error('Path traced preview failed:', err);
        try {
          this.stopPathTracingLoop();
          this.mode = 'raster';
          this.renderOnceRaster(config, quality);
        } catch {
          // Ignore.
        }
      });
      return;
    }

    this.renderOnceRaster(config, quality);
  }

  // ---------------------- Raster ----------------------

  private renderOnceRaster(config: PopsicleConfig, quality: PreviewQuality): void {
    const effective = this.applyQualityOverrides(config, quality);

    // Camera
    const aspect = effective.width / effective.height;
    const frustumSize = 10;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    const azimuthRad = degToRad(effective.camera.azimuth);
    const elevationRad = degToRad(effective.camera.elevation);
    this.camera.position.set(
      effective.camera.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
      effective.camera.distance * Math.sin(elevationRad),
      effective.camera.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    this.camera.zoom = cameraZoomFromDistance(effective.camera.distance);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);

    // Renderer + background
    applyToneMapping(this.renderer, effective);
    if (effective.rendering.toneMapping === 'aces') {
      this.renderer.toneMapping = THREE.NoToneMapping;
    }
    this.renderer.setClearColor(new THREE.Color(effective.backgroundColor), 1);

    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const pixelRatio = quality === 'interactive' ? 1 : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);

    const { previewWidth, previewHeight } = this.getPreviewSize(aspect, quality);
    this.renderer.setSize(previewWidth, previewHeight, false);

    // Shadows
    const useShadows = !!effective.shadows.enabled;
    this.renderer.shadowMap.enabled = useShadows;
    setShadowType(this.renderer, effective.shadows.type);

    // Lights
    if (effective.lighting.enabled) {
      this.ambientLight.intensity = effective.lighting.ambientIntensity;
      this.ambientLight.visible = true;
      this.hemiLight.intensity = Math.max(0.0, effective.lighting.ambientIntensity * 0.55);
      this.hemiLight.visible = true;

      this.keyLight.intensity = effective.lighting.intensity;
      this.keyLight.position.set(effective.lighting.position.x, effective.lighting.position.y, effective.lighting.position.z);
      this.keyLight.visible = true;
      this.keyLight.castShadow = useShadows;

      this.fillLight.intensity = effective.lighting.intensity * 0.3;
      this.fillLight.position.set(-effective.lighting.position.x, -effective.lighting.position.y, effective.lighting.position.z * 0.5);
      this.fillLight.visible = true;
      this.fillLight.castShadow = false;

      this.rimLight.intensity = effective.lighting.intensity * 0.25;
      this.rimLight.position.set(effective.lighting.position.x * 0.2, -effective.lighting.position.y, effective.lighting.position.z * 1.2);
      this.rimLight.visible = true;
      this.rimLight.castShadow = false;
    } else {
      this.ambientLight.intensity = 1;
      this.ambientLight.visible = true;
      this.hemiLight.visible = false;
      this.keyLight.visible = false;
      this.fillLight.visible = false;
      this.rimLight.visible = false;
    }

    // Environment (reflections)
    if (effective.environment.enabled) {
      this.scene.environment = this.envCache.get(this.renderer, effective.environment.style);

      const rotRad = degToRad(effective.environment.rotation);
      // Optional (three r180+): rotate environment sampling without regenerating PMREM.
      if ('environmentRotation' in this.scene) {
        (this.scene as any).environmentRotation = new THREE.Euler(0, rotRad, 0);
      }
    } else {
      this.scene.environment = null;
      if ('environmentRotation' in this.scene) {
        (this.scene as any).environmentRotation = new THREE.Euler(0, 0, 0);
      }
    }

    // Geometry + instances
    const safeStickOpacity = clamp(Number.isFinite(Number(effective.stickOpacity)) ? Number(effective.stickOpacity) : 1.0, 0, 1);

    const nColors = Math.max(1, effective.colors.length);

    const getOv = (paletteIndex: number) => getEnabledPaletteOverride(effective, paletteIndex);
    const hasOvByPalette = new Array(nColors).fill(false);
    const freqByPalette = new Array(nColors).fill(1);
    for (let pi = 0; pi < nColors; pi++) {
      const ov = getOv(pi);
      if (!ov) continue;
      hasOvByPalette[pi] = true;
      freqByPalette[pi] = clamp(Number(ov.frequency ?? 1), 0, 1);
    }

    const resolvedBase = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(effective, pi, { applyOverrides: false }));
    const resolvedOv = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(effective, pi, { applyOverrides: true }));

    const dimsBaseByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedBase[pi].multipliers.popsicle;
      return getStickDimensions(
        effective.width,
        effective.height,
        effective.stickThickness * mult.thicknessMult,
        effective.stickSize * mult.sizeMult,
        effective.stickRatio * mult.ratioMult
      );
    });
    const dimsOvByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedOv[pi].multipliers.popsicle;
      return getStickDimensions(
        effective.width,
        effective.height,
        effective.stickThickness * mult.thicknessMult,
        effective.stickSize * mult.sizeMult,
        effective.stickRatio * mult.ratioMult
      );
    });

    const dimsForBoundsByPalette = Array.from({ length: nColors }, (_, pi) => ({
      width: Math.max(dimsBaseByPalette[pi].width, dimsOvByPalette[pi].width),
      height: Math.max(dimsBaseByPalette[pi].height, dimsOvByPalette[pi].height),
      depth: Math.max(dimsBaseByPalette[pi].depth, dimsOvByPalette[pi].depth)
    }));

    let maxOutlineThickness = 0;
    for (let pi = 0; pi < nColors; pi++) {
      for (const st of [resolvedBase[pi], resolvedOv[pi]]) {
        const oc = st.facades.outline;
        if (!oc?.enabled) continue;
        const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
        if (thickness > maxOutlineThickness) maxOutlineThickness = thickness;
      }
    }

    const bounds = computeBoundsPerStick({
      stickCount: effective.stickCount,
      getStickDimensions: (i) => dimsForBoundsByPalette[((i % nColors) + nColors) % nColors],
      stickOverhang: effective.stickOverhang,
      rotationCenterOffsetX: effective.rotationCenterOffsetX,
      rotationCenterOffsetY: effective.rotationCenterOffsetY,
      stickGap: effective.stickGap,
      outlineScale: 1 + maxOutlineThickness
    });

    // Auto-fit camera before placing meshes (bounds are centered at origin by construction).
    try {
      const padding = effective.bloom?.enabled ? 0.86 : 0.92;
      autoFitOrthoCameraToBox(this.camera, symmetricBoxFromSize(bounds.size), padding);
    } catch {
      // Ignore.
    }

    const geometriesByPalette: Array<{ base: THREE.BufferGeometry; ov: THREE.BufferGeometry }> = new Array(nColors);
    const usedGeoKeys = new Set<string>();

    for (let pi = 0; pi < nColors; pi++) {
      const makeGeo = (dims: { width: number; height: number; depth: number }) => {
        const geoKey = [
          dims.width.toFixed(4),
          dims.height.toFixed(4),
          dims.depth.toFixed(4),
          String(effective.stickEndProfile),
          effective.stickRoundness.toFixed(4),
          effective.stickChipAmount.toFixed(4),
          effective.stickChipJaggedness.toFixed(4),
          effective.stickBevel.toFixed(4),
          effective.geometry.quality.toFixed(3),
          String(effective.seed)
        ].join(':');

        usedGeoKeys.add(geoKey);
        let geo = this.stickGeometryCache.get(geoKey);
        if (!geo) {
          geo = createRoundedBox(
            dims.width,
            dims.height,
            dims.depth,
            effective.stickEndProfile,
            effective.stickRoundness,
            effective.stickChipAmount,
            effective.stickChipJaggedness,
            effective.stickBevel,
            effective.geometry.quality,
            effective.seed
          );
          this.stickGeometryCache.set(geoKey, geo);
        }
        return geo;
      };

      geometriesByPalette[pi] = {
        base: makeGeo(dimsBaseByPalette[pi]),
        ov: makeGeo(dimsOvByPalette[pi])
      };
    }

    for (const [k, g] of this.stickGeometryCache.entries()) {
      if (usedGeoKeys.has(k)) continue;
      g.dispose();
      this.stickGeometryCache.delete(k);
    }

    const envIntensity = effective.environment.enabled ? effective.environment.intensity : 0;
    const facadesKey = JSON.stringify(effective.facades);
    const edgeKey = JSON.stringify(effective.edge);
    const emissionKey = JSON.stringify(effective.emission);
    const bubblesKey = JSON.stringify((effective as any).bubbles ?? null);
    const paletteOverridesKey = JSON.stringify((effective as any).palette?.overrides ?? []);
    const matBaseKey = [
      effective.texture,
      textureParamsKey(effective),
      facadesKey,
      edgeKey,
      emissionKey,
      bubblesKey,
      paletteOverridesKey,
      envIntensity.toFixed(3),
      safeStickOpacity.toFixed(3),
      String(effective.seed)
    ].join(':');
    const getMaterial = (
      paletteIndex: number,
      hex: string,
      stickDimensions: { width: number; height: number; depth: number },
      applyOverrides: boolean
    ) => {
      const k = [
        matBaseKey,
        applyOverrides ? '1' : '0',
        String(paletteIndex),
        hex,
        stickDimensions.width.toFixed(4),
        stickDimensions.height.toFixed(4),
        stickDimensions.depth.toFixed(4)
      ].join(':');
      const existing = this.stickMaterialCache.get(k);
      if (existing) return existing;
      const m = createMaterialForColor(effective, paletteIndex, hex, envIntensity, safeStickOpacity, stickDimensions, { applyOverrides });
      this.stickMaterialCache.set(k, m);
      return m;
    };

    const collisionPaletteCount = Math.max(1, effective.colors.length);
    const collisionBuckets: THREE.Mesh[][] = Array.from({ length: collisionPaletteCount }, () => []);
    const collisionPaletteMaterials: Array<Set<THREE.Material | THREE.Material[]>> = Array.from({ length: collisionPaletteCount }, () => new Set());

    // Ensure mesh pool
    while (this.stickMeshes.length < effective.stickCount) {
      const dims0 = dimsBaseByPalette[0];
      const mesh = new THREE.Mesh(geometriesByPalette[0].base, getMaterial(0, '#ffffff', dims0, false));
      this.sticksGroup.add(mesh);
      this.stickMeshes.push(mesh);
    }

    const sticksByPalette: number[][] = Array.from({ length: nColors }, () => []);
    const approxPos: Array<THREE.Vector3 | null> = new Array(effective.stickCount).fill(null);

    // Pass A: approximate positions using base geometry only.
    {
      const safeStickGap = Number.isFinite(Number(effective.stickGap)) ? Number(effective.stickGap) : 0;
      let zCursor = 0;
      let prevDepth = 0;

      for (let i = 0; i < effective.stickCount; i++) {
        const paletteIndex = ((i % nColors) + nColors) % nColors;
        sticksByPalette[paletteIndex].push(i);

        const dims = dimsBaseByPalette[paletteIndex];
        if (i === 0) {
          zCursor = 0;
        } else {
          zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeStickGap;
        }
        prevDepth = dims.depth;

        const o = getStackingOffset(
          i,
          dims,
          effective.stickOverhang,
          effective.rotationCenterOffsetX,
          effective.rotationCenterOffsetY,
          safeStickGap,
          zCursor
        );

        approxPos[i] = new THREE.Vector3(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
      }
    }

    const closestStickByPalette = new Array(nColors).fill(-1);
    for (let pi = 0; pi < nColors; pi++) {
      if (!hasOvByPalette[pi]) continue;
      const freq = freqByPalette[pi] ?? 1;
      if (freq > 0) continue;
      let bestI = -1;
      let bestD = Infinity;
      for (const idx of sticksByPalette[pi]) {
        const p = approxPos[idx];
        if (!p) continue;
        const d = this.camera.position.distanceToSquared(p);
        if (d < bestD) {
          bestD = d;
          bestI = idx;
        }
      }
      closestStickByPalette[pi] = bestI;
    }

    const applyOverrideByStick = new Array(effective.stickCount).fill(false);
    for (let pi = 0; pi < nColors; pi++) {
      if (!hasOvByPalette[pi]) continue;
      const freq = freqByPalette[pi] ?? 1;
      if (freq >= 0.999) {
        for (const idx of sticksByPalette[pi]) applyOverrideByStick[idx] = true;
        continue;
      }
      if (freq <= 0.000001) {
        const idx = closestStickByPalette[pi];
        if (idx >= 0) applyOverrideByStick[idx] = true;
        continue;
      }
      for (const idx of sticksByPalette[pi]) {
        if (hash01(effective.seed, pi, idx) < freq) applyOverrideByStick[idx] = true;
      }
    }

    // Pass B: assign meshes with selected overrides.
    {
      const safeStickGap = Number.isFinite(Number(effective.stickGap)) ? Number(effective.stickGap) : 0;
      let zCursor = 0;
      let prevDepth = 0;

      for (let i = 0; i < this.stickMeshes.length; i++) {
        const mesh = this.stickMeshes[i];
        if (i >= effective.stickCount) {
          mesh.visible = false;
          continue;
        }

        mesh.visible = true;
        const paletteIndex = ((i % nColors) + nColors) % nColors;
        const applyOverrides = !!applyOverrideByStick[i];
        const dims = applyOverrides ? dimsOvByPalette[paletteIndex] : dimsBaseByPalette[paletteIndex];
        const geo = applyOverrides ? geometriesByPalette[paletteIndex].ov : geometriesByPalette[paletteIndex].base;
        const hex = effective.colors[paletteIndex] ?? '#ffffff';

        mesh.geometry = geo;
        mesh.material = getMaterial(paletteIndex, hex, dims, applyOverrides);

        collisionBuckets[paletteIndex % collisionPaletteCount].push(mesh);
        collisionPaletteMaterials[paletteIndex % collisionPaletteCount].add(mesh.material as any);

        mesh.castShadow = useShadows;
        mesh.receiveShadow = useShadows;

        if (i === 0) {
          zCursor = 0;
        } else {
          zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeStickGap;
        }
        prevDepth = dims.depth;

        const o = getStackingOffset(
          i,
          dims,
          effective.stickOverhang,
          effective.rotationCenterOffsetX,
          effective.rotationCenterOffsetY,
          safeStickGap,
          zCursor
        );
        mesh.position.set(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
        mesh.rotation.set(0, 0, o.rotationZ);
      }
    }

    // Outline (inverted hull): supports per-color overrides.
    {
      const outlineMats = new Map<string, THREE.MeshBasicMaterial>();

      while (this.outlineMeshes.length < effective.stickCount) {
        const om = new THREE.Mesh(geometriesByPalette[0].base, new THREE.MeshBasicMaterial({ color: 0x000000 }));
        om.castShadow = false;
        om.receiveShadow = false;
        this.outlineGroup.add(om);
        this.outlineMeshes.push(om);
      }

      let anyOutline = false;
      for (let i = 0; i < this.outlineMeshes.length; i++) {
        const om = this.outlineMeshes[i];
        if (i >= effective.stickCount) {
          om.visible = false;
          continue;
        }

        const sm = this.stickMeshes[i];
        if (!sm.visible) {
          om.visible = false;
          continue;
        }

        const paletteIndex = ((i % nColors) + nColors) % nColors;
        const applyOverrides = !!applyOverrideByStick[i];
        const resolved = applyOverrides ? resolvedOv[paletteIndex] : resolvedBase[paletteIndex];
        const oc = resolved.facades.outline;
        const opacity = clamp(Number(oc?.opacity) || 1, 0, 1);
        const thickness = Math.max(0, Math.min(0.2, Number(oc?.thickness) || 0));
        const enabled = !!oc?.enabled && thickness > 0 && opacity > 0;

        if (!enabled) {
          om.visible = false;
          continue;
        }

        anyOutline = true;
        const matKey = `${String(oc.color)}:${opacity.toFixed(4)}`;
        let mat = outlineMats.get(matKey);
        if (!mat) {
          mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(oc.color),
            side: THREE.BackSide,
            transparent: opacity < 1,
            opacity,
            depthWrite: false
          });
          outlineMats.set(matKey, mat);
        }

        om.visible = true;
        om.geometry = sm.geometry;
        om.material = mat;
        om.position.copy(sm.position);
        om.rotation.copy(sm.rotation);
        om.scale.setScalar(1 + thickness);
      }

      this.outlineGroup.visible = anyOutline;
    }

    const collisionMaterials = collisionPaletteMaterials.map((s) => Array.from(s));

    this.applyCollisionMaskingRaster(effective, previewWidth, previewHeight, collisionBuckets, collisionMaterials);

    // Shadow camera + catcher
    if (useShadows && this.keyLight.visible) {
      const map = Math.max(256, Math.min(8192, Math.round(effective.shadows.mapSize)));
      this.keyLight.shadow.mapSize.set(map, map);
      this.keyLight.shadow.bias = effective.shadows.bias;
      this.keyLight.shadow.normalBias = effective.shadows.normalBias;

      const pad = Math.max(bounds.size.x, bounds.size.y) * 0.35 + 0.5;
      const shadowCam = this.keyLight.shadow.camera as THREE.OrthographicCamera;
      shadowCam.left = -bounds.size.x / 2 - pad;
      shadowCam.right = bounds.size.x / 2 + pad;
      shadowCam.top = bounds.size.y / 2 + pad;
      shadowCam.bottom = -bounds.size.y / 2 - pad;
      shadowCam.near = 0.1;
      shadowCam.far = Math.max(50, bounds.size.z + 50);
      shadowCam.updateProjectionMatrix();
      this.keyLight.target.position.set(0, 0, 0);
      this.scene.add(this.keyLight.target);
    }

    if (effective.bloom.enabled) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(previewWidth, previewHeight),
          effective.bloom.strength,
          effective.bloom.radius,
          effective.bloom.threshold
        );
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.bloomPass);
      }

      this.renderPass!.scene = this.scene;
      this.renderPass!.camera = this.camera;
      this.bloomPass!.strength = effective.bloom.strength;
      this.bloomPass!.radius = effective.bloom.radius;
      this.bloomPass!.threshold = effective.bloom.threshold;
      this.composer.setSize(previewWidth, previewHeight);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private applyCollisionMaskingRaster(
    config: PopsicleConfig,
    previewWidth: number,
    previewHeight: number,
    meshesByPalette: THREE.Mesh[][],
    paletteMaterials: Array<Array<THREE.Material | THREE.Material[]>>
  ): void {
    const nColors = Math.max(1, config.colors.length);
    if (meshesByPalette.length !== nColors) return;

    const enabled = config.collisions.mode === 'carve' && nColors <= 8 && this.mode === 'raster';
    if (!enabled) {
      // Leave any injected shader code in-place; it no-ops when otherDepthCount=0.
      for (const list of paletteMaterials) {
        for (const m of list ?? []) {
          if (!m) continue;
          const mats = Array.isArray(m) ? m : [m];
          for (const mm of mats) {
            const sh = (mm.userData as any).__wmCollisionShader;
            if (sh?.uniforms?.wmOtherDepthCount) sh.uniforms.wmOtherDepthCount.value = 0;
          }
        }
      }
      return;
    }

    const marginPx = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
    const featherPx = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;
    const softEdge = config.collisions.carve.edge === 'soft' && featherPx > 0;

    const screenW = Math.max(1, Math.round(previewWidth));
    const screenH = Math.max(1, Math.round(previewHeight));
    const maskScale = 0.6;
    const rtW = Math.max(1, Math.round(screenW * maskScale));
    const rtH = Math.max(1, Math.round(screenH * maskScale));

    const makeRT = () => {
      const rt = new THREE.WebGLRenderTarget(rtW, rtH, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false
      });
      rt.depthTexture = new THREE.DepthTexture(rtW, rtH);
      rt.depthTexture.format = THREE.DepthFormat;
      rt.depthTexture.type = THREE.UnsignedShortType;
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
      return rt;
    };

    if (!this.collisionDepthMat) this.collisionDepthMat = new THREE.MeshDepthMaterial();
    if (!this.collisionDummy) this.collisionDummy = makeSolidRedTexture01();

    if (this.collisionRTs.length !== nColors || this.collisionRTW !== rtW || this.collisionRTH !== rtH) {
      for (const rt of this.collisionRTs) rt.dispose();
      this.collisionRTs = Array.from({ length: nColors }, () => makeRT());
      this.collisionRTW = rtW;
      this.collisionRTH = rtH;
    }

    // Popsicle doesn't have palette weights; use palette index as priority (higher index carves lower index).
    const weights = Array.from({ length: nColors }, (_, i) => i);

    const otherIndicesByPalette: number[][] = [];
    for (let pi = 0; pi < nColors; pi++) {
      const others: number[] = [];
      for (let j = 0; j < nColors; j++) {
        if (j === pi) continue;
        if (config.collisions.carve.direction === 'twoWay') {
          others.push(j);
          continue;
        }
        if ((weights[j] ?? 0) > (weights[pi] ?? 0)) others.push(j);
      }
      others.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
      otherIndicesByPalette[pi] = others.slice(0, 7);
    }

    const dummy = this.collisionDummy;
    const depthRTs = this.collisionRTs;

    const patchMaterial = (mat: THREE.Material, pi: number) => {
      if (softEdge) {
        mat.transparent = true;
        mat.depthWrite = false;
      }

      const idxs = otherIndicesByPalette[pi] ?? [];
      const otherDepth = idxs.map((j) => depthRTs[j].depthTexture);

      const finishEnabled = config.collisions.mode === 'carve' && config.collisions.carve.finish === 'wallsCap' ? 1 : 0;
      const finishDepthPx =
        (Math.max(0, Number(config.collisions.carve.marginPx) || 0) +
          (config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0)) *
        Math.max(0, Number(config.collisions.carve.finishAutoDepthMult) || 0);

      chainOnBeforeCompile(
        mat,
        (shader) => {
          shader.uniforms.wmCollideRes = { value: new THREE.Vector2(screenW, screenH) };
          shader.uniforms.wmCollideMarginPx = { value: marginPx };
          shader.uniforms.wmCollideFeatherPx = { value: featherPx };
          shader.uniforms.wmCollideSoftEdge = { value: softEdge ? 1 : 0 };
          shader.uniforms.wmFinishEnabled = { value: finishEnabled };
          shader.uniforms.wmFinishDepthPx = { value: finishDepthPx };
          shader.uniforms.wmOtherDepthCount = { value: otherDepth.length };
          shader.uniforms.wmOtherDepth0 = { value: (otherDepth[0] as any) ?? dummy };
          shader.uniforms.wmOtherDepth1 = { value: (otherDepth[1] as any) ?? dummy };
          shader.uniforms.wmOtherDepth2 = { value: (otherDepth[2] as any) ?? dummy };
          shader.uniforms.wmOtherDepth3 = { value: (otherDepth[3] as any) ?? dummy };
          shader.uniforms.wmOtherDepth4 = { value: (otherDepth[4] as any) ?? dummy };
          shader.uniforms.wmOtherDepth5 = { value: (otherDepth[5] as any) ?? dummy };
          shader.uniforms.wmOtherDepth6 = { value: (otherDepth[6] as any) ?? dummy };

          (mat.userData as any).__wmCollisionShader = shader;

          const headerGlobal = `
 uniform vec2 wmCollideRes;
 uniform float wmCollideMarginPx;
 uniform float wmCollideFeatherPx;
 uniform float wmCollideSoftEdge;
uniform float wmFinishEnabled;
uniform float wmFinishDepthPx;
 uniform int wmOtherDepthCount;
uniform sampler2D wmOtherDepth0;
uniform sampler2D wmOtherDepth1;
uniform sampler2D wmOtherDepth2;
uniform sampler2D wmOtherDepth3;
uniform sampler2D wmOtherDepth4;
uniform sampler2D wmOtherDepth5;
uniform sampler2D wmOtherDepth6;

float wmDepth01(sampler2D d, vec2 uv) {
  return texture2D(d, clamp(uv, 0.0, 1.0)).x;
}

float wmInFront01(sampler2D d, vec2 uv, float curZ) {
  float z = wmDepth01(d, uv);
  if (z >= 0.999999) return 0.0;
  return z < (curZ - 0.00001) ? 1.0 : 0.0;
}

float wmInFrontAtRadius(sampler2D d, vec2 uv, float radiusPx, float curZ) {
  float p = wmInFront01(d, uv, curZ);
  if (radiusPx <= 0.0) return p;
  vec2 px = 1.0 / wmCollideRes;
  vec2 o = vec2(radiusPx, 0.0) * px;
  p = max(p, wmInFront01(d, uv + vec2( o.x, 0.0), curZ));
  p = max(p, wmInFront01(d, uv + vec2(-o.x, 0.0), curZ));
  p = max(p, wmInFront01(d, uv + vec2(0.0,  o.x), curZ));
  p = max(p, wmInFront01(d, uv + vec2(0.0, -o.x), curZ));
  p = max(p, wmInFront01(d, uv + vec2( o.x,  o.x), curZ));
  p = max(p, wmInFront01(d, uv + vec2(-o.x,  o.x), curZ));
  p = max(p, wmInFront01(d, uv + vec2( o.x, -o.x), curZ));
  p = max(p, wmInFront01(d, uv + vec2(-o.x, -o.x), curZ));
  return p;
}

float wmAnyInFront(vec2 uv, float radiusPx, float curZ) {
  float p = 0.0;
  if (wmOtherDepthCount > 0) p = max(p, wmInFrontAtRadius(wmOtherDepth0, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 1) p = max(p, wmInFrontAtRadius(wmOtherDepth1, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 2) p = max(p, wmInFrontAtRadius(wmOtherDepth2, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 3) p = max(p, wmInFrontAtRadius(wmOtherDepth3, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 4) p = max(p, wmInFrontAtRadius(wmOtherDepth4, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 5) p = max(p, wmInFrontAtRadius(wmOtherDepth5, uv, radiusPx, curZ));
  if (wmOtherDepthCount > 6) p = max(p, wmInFrontAtRadius(wmOtherDepth6, uv, radiusPx, curZ));
  return p;
}

void wmApplyCollisionMask(inout vec4 col) {
  if (wmOtherDepthCount <= 0) return;
  vec2 uv = gl_FragCoord.xy / wmCollideRes;
  float curZ = gl_FragCoord.z;
  float margin = max(0.0, wmCollideMarginPx);
  float feather = max(0.0, wmCollideFeatherPx);

  float hit0 = wmAnyInFront(uv, 0.0, curZ);
  if (hit0 > 0.5) {
    discard;
  }

  float hitM = wmAnyInFront(uv, margin, curZ);
  if (hitM <= 0.5) {
    return;
  }

  float carveAmt = 1.0;
  if (wmCollideSoftEdge > 0.5 && feather > 0.0) {
    float cut = 0.0;
    if (wmAnyInFront(uv, margin + feather * 0.25, curZ) > 0.5) cut = max(cut, 0.25);
    if (wmAnyInFront(uv, margin + feather * 0.50, curZ) > 0.5) cut = max(cut, 0.50);
    if (wmAnyInFront(uv, margin + feather * 0.75, curZ) > 0.5) cut = max(cut, 0.75);
    if (wmAnyInFront(uv, margin + feather, curZ) > 0.5) cut = max(cut, 1.00);
    carveAmt = 1.0 - cut;
  }

  if (wmFinishEnabled > 0.5) {
    float wallThickness = max(2.0, min(30.0, wmFinishDepthPx * 0.35));
    float wall = wmAnyInFront(uv, max(0.0, margin - wallThickness), curZ);
    vec3 capCol = col.rgb * 0.14;
    vec3 wallCol = col.rgb * 0.30;
    vec3 inside = mix(capCol, wallCol, wall);
    col.rgb = mix(col.rgb, inside, carveAmt);
    return;
  }

  if (wmCollideSoftEdge > 0.5 && feather > 0.0) {
    col.a *= max(0.0, 1.0 - carveAmt);
    if (col.a <= 0.001) discard;
  } else {
    discard;
  }
}
`;

          let fs = shader.fragmentShader;
          if (fs.includes('#include <common>')) {
            fs = fs.replace('#include <common>', `#include <common>\n${headerGlobal}\n`);
          } else {
            fs = fs.replace('void main() {', `${headerGlobal}\nvoid main() {`);
          }
          fs = fs.replace('#include <dithering_fragment>', `wmApplyCollisionMask(gl_FragColor);\n#include <dithering_fragment>`);
          shader.fragmentShader = fs;
        },
        `collide-v1:${config.collisions.carve.direction}:${config.collisions.carve.edge}:${marginPx.toFixed(2)}:${featherPx.toFixed(2)}:${idxs.length}`
      );
    };

    for (let pi = 0; pi < nColors; pi++) {
      const list = paletteMaterials[pi] ?? [];
      for (const entry of list) {
        if (!entry) continue;
        const mats = Array.isArray(entry) ? entry : [entry];
        for (const mm of mats) patchMaterial(mm, pi);
      }
    }

    // Render per-palette depth maps.
    const prevTarget = this.renderer.getRenderTarget();
    const prevOverride = (this.scene as any).overrideMaterial;
    const clearCol = this.renderer.getClearColor(new THREE.Color());
    const clearA = this.renderer.getClearAlpha();
    const vis = this.stickMeshes.map((m) => m.visible);

    this.renderer.setClearColor(0x000000, 0);
    (this.scene as any).overrideMaterial = this.collisionDepthMat;

    for (let i = 0; i < this.stickMeshes.length; i++) {
      if (this.stickMeshes[i].visible) this.stickMeshes[i].visible = false;
    }

    for (let pi = 0; pi < nColors; pi++) {
      for (const mesh of meshesByPalette[pi]) mesh.visible = true;
      this.renderer.setRenderTarget(depthRTs[pi]);
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
      for (const mesh of meshesByPalette[pi]) mesh.visible = false;
    }

    (this.scene as any).overrideMaterial = prevOverride;
    for (let i = 0; i < this.stickMeshes.length; i++) this.stickMeshes[i].visible = vis[i];
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(clearCol, clearA);
  }

  private getPreviewSize(aspect: number, quality: PreviewQuality): { previewWidth: number; previewHeight: number } {
    const cw = Math.max(1, this.container.clientWidth);
    const ch = Math.max(1, this.container.clientHeight);

    // Keep the displayed canvas size stable (fit-to-container), and only vary the internal
    // render buffer size while dragging.
    const cssWidth = Math.min(cw, ch * aspect);
    const cssHeight = cssWidth / aspect;

    const scale = quality === 'interactive' ? 0.6 : 1.0;
    const previewWidth = Math.max(1, Math.round(cssWidth * scale));
    const previewHeight = Math.max(1, Math.round(cssHeight * scale));

    // Force CSS size so the viewport doesn't "twitch" when previewWidth/Height changes.
    this.renderer.domElement.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
    this.renderer.domElement.style.height = `${Math.max(1, Math.round(cssHeight))}px`;

    return { previewWidth, previewHeight };
  }

  private applyQualityOverrides(config: PopsicleConfig, quality: PreviewQuality): PopsicleConfig {
    if (quality === 'final') return config;

    // Interactive mode: keep framing but reduce expensive features.
    const next: PopsicleConfig = {
      ...config,
      colors: [...config.colors],
      textureParams: {
        drywall: { ...config.textureParams.drywall },
        glass: { ...config.textureParams.glass },
        cel: { ...config.textureParams.cel }
      },
      facades: {
        side: { ...config.facades.side },
        grazing: { ...config.facades.grazing },
        outline: { ...config.facades.outline }
      },
      edge: { ...config.edge, seam: { ...config.edge.seam }, band: { ...config.edge.band } },
      emission: { ...config.emission },
      bloom: { ...config.bloom },
      lighting: {
        ...config.lighting,
        position: { ...config.lighting.position }
      },
      camera: { ...config.camera },
      environment: { ...config.environment },
      shadows: { ...config.shadows },
      rendering: { ...config.rendering },
      geometry: { ...config.geometry }
    };

    // Disable heavier features while dragging.
    // Keep environment reflections on (cached PMREM) so the preview doesn't look dead.
    next.shadows.enabled = false;
    next.geometry.quality = Math.min(next.geometry.quality, 0.18);
    return next;
  }

  private applyPathTracingOverrides(config: PopsicleConfig): PopsicleConfig {
    // Path tracing requires baking a BVH over de-instanced geometry.
    // Popsicle meshes can be extremely dense at high geometry quality, so cap it to keep
    // previews responsive and memory usage bounded.
    const maxQ = 0.18;
    const qIn = Number(config.geometry?.quality ?? 1);
    const q = Number.isFinite(qIn) ? Math.max(0, Math.min(1, qIn)) : 1;
    const nextQ = Math.min(q, maxQ);

    const next: PopsicleConfig = {
      ...config,
      colors: [...config.colors],
      textureParams: {
        drywall: { ...config.textureParams.drywall },
        glass: { ...config.textureParams.glass },
        cel: { ...config.textureParams.cel }
      },
      facades: {
        side: { ...config.facades.side },
        grazing: { ...config.facades.grazing },
        outline: { ...config.facades.outline }
      },
      edge: { ...config.edge, seam: { ...config.edge.seam }, band: { ...config.edge.band } },
      emission: { ...config.emission },
      bloom: { ...config.bloom },
      lighting: { ...config.lighting, position: { ...config.lighting.position } },
      camera: { ...config.camera },
      environment: { ...config.environment },
      shadows: { ...config.shadows },
      rendering: { ...config.rendering },
      geometry: { ...config.geometry, quality: nextQ }
    };

    // Bubble carving in the path-traced preview is very expensive; keep it off.
    if ((next as any).bubbles) {
      (next as any).bubbles = { ...(next as any).bubbles, enabled: false };
    }

    return next;
  }

  // ---------------------- Path tracing ----------------------

  private async initPathTracer(): Promise<void> {
    const mod = await import('three-gpu-pathtracer');
    const WebGLPathTracer = (mod as any).WebGLPathTracer ?? (mod as any).default?.WebGLPathTracer;
    if (!WebGLPathTracer) {
      throw new Error('WebGLPathTracer export not found in three-gpu-pathtracer');
    }
    this.pathTracer = new WebGLPathTracer(this.renderer);

    // Required for setSceneAsync.
    if (!this.bvhWorker) {
      const bvhMod = await import('three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js');
      const GenerateMeshBVHWorker = (bvhMod as any).GenerateMeshBVHWorker ?? (bvhMod as any).default;
      if (!GenerateMeshBVHWorker) {
        throw new Error('GenerateMeshBVHWorker export not found in three-mesh-bvh');
      }
      this.bvhWorker = new GenerateMeshBVHWorker();
    }
    try {
      this.pathTracer.setBVHWorker?.(this.bvhWorker);
    } catch {
      // Ignore; setSceneAsync will throw if unsupported.
    }

    // Sensible defaults; overridden per-quality in renderOncePath.
    this.pathTracer.renderToCanvas = true;
    this.pathTracer.dynamicLowRes = true;
    this.pathTracer.lowResScale = 0.5;
    this.pathTracer.renderScale = 1.0;
    this.pathTracer.synchronizeRenderSize = true;
    this.pathTracer.rasterizeScene = true;
    this.pathTracer.enablePathTracing = true;
    this.pathTracer.pausePathTracing = false;
    this.pathTracer.bounces = 4;
    this.pathTracer.transmissiveBounces = 2;
    this.pathTracer.filterGlossyFactor = 0.5;
    this.pathTracer.renderToCanvasCallback = (target: THREE.WebGLRenderTarget, renderer: THREE.WebGLRenderer) => {
      this.renderPathToCanvas(target, renderer);
    };

    // Reduce internal texture atlas size for previews.
    try {
      this.pathTracer.textureSize?.set?.(512, 512);
    } catch {
      // Ignore.
    }
  }

  private stopPathTracingLoop(): void {
    if (this.pathTracingLoopId) {
      cancelAnimationFrame(this.pathTracingLoopId);
      this.pathTracingLoopId = 0;
    }
  }

  private startPathTracingLoop(sampleBudget: number): void {
    this.stopPathTracingLoop();

    const loop = () => {
      if (!this.pathTracer) return;
      if (this.pathTracer.pausePathTracing) return;

      if (this.pathTracer.samples >= sampleBudget) {
        this.stopPathTracingLoop();
        return;
      }

      this.pathTracer.renderSample();
      this.pathTracingLoopId = requestAnimationFrame(loop);
    };

    this.pathTracingLoopId = requestAnimationFrame(loop);
  }

  private getPathSceneKey(config: PopsicleConfig): string {
    // Keep it stable and cheap. Excludes camera so we can update it without rebuilding BVH.
    const keyObj = {
      w: config.width,
      h: config.height,
      colors: config.colors,
      palette: (config as any).palette?.overrides ?? [],
      tex: config.texture,
      bg: config.backgroundColor,
      count: config.stickCount,
      overhang: config.stickOverhang,
      rotx: config.rotationCenterOffsetX,
      roty: config.rotationCenterOffsetY,
      gap: config.stickGap,
      size: config.stickSize,
      ratio: config.stickRatio,
      thick: config.stickThickness,
      endProfile: (config as any).stickEndProfile,
      round: config.stickRoundness,
      chipAmount: (config as any).stickChipAmount,
      chipJagged: (config as any).stickChipJaggedness,
      bevel: config.stickBevel,
      so: config.stickOpacity,
      light: config.lighting,
      env: config.environment,
      tm: config.rendering,
      geo: config.geometry,
      bubbles: (config as any).bubbles ?? null
    };
    return JSON.stringify(keyObj);
  }

  private getPathCameraKey(config: PopsicleConfig): string {
    return JSON.stringify({ cam: config.camera });
  }

  private async renderOncePath(config: PopsicleConfig, quality: PreviewQuality): Promise<void> {
    const token = ++this.pathRenderToken;
    if (!this.pathInitPromise) this.pathInitPromise = this.initPathTracer();
    await this.pathInitPromise;
    if (token !== this.pathRenderToken) return;

    const effective = this.applyPathTracingOverrides(config);

    // Build / update scene if needed.
    const sceneKey = this.getPathSceneKey(effective);
    const cameraKey = this.getPathCameraKey(effective);
    const sceneChanged = sceneKey !== this.lastPathSceneKey;
    const cameraChanged = cameraKey !== this.lastPathCameraKey;
    const qualityChanged = quality !== this.lastPathQuality;
    this.lastPathQuality = quality;

    // If a BVH build is already in flight, coalesce *before* touching the renderer.
    // Resizing the canvas clears it and would cause a blank frame.
    if (sceneChanged && this.pathSceneBuilding) {
      this.pendingPathRequest = { config, quality };
      return;
    }

    const aspect = effective.width / effective.height;

    // Set renderer size (path tracer synchronizes render size if enabled).
    const { previewWidth, previewHeight } = this.getPreviewSize(aspect, quality);
    this.renderer.setPixelRatio(1);
    if (previewWidth !== this.lastPathPreviewW || previewHeight !== this.lastPathPreviewH) {
      this.renderer.setSize(previewWidth, previewHeight, false);
      this.lastPathPreviewW = previewWidth;
      this.lastPathPreviewH = previewHeight;
    }
    applyToneMapping(this.renderer, effective);
    this.pathToneMappingMode = effective.rendering.toneMapping === 'aces' ? 'aces' : 'none';
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(new THREE.Color(effective.backgroundColor), 1);

    // Ensure we can resume after interactive raster frames.
    try {
      this.pathTracer.pausePathTracing = false;
    } catch {
      // Ignore.
    }

    if (sceneChanged) {
      this.pathSceneBuilding = true;

      this.lastPathSceneKey = sceneKey;
      this.lastPathCameraKey = cameraKey;
      this.pathScene?.traverse((obj) => {
        const mesh = obj as any;
        if (mesh.geometry?.dispose) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m: any) => m?.dispose?.());
          else mesh.material?.dispose?.();
        }
      });

      // Build synchronously first (keeps previous frame visible until we're ready).
      this.pathCamera = this.buildPathCamera(effective);
      this.pathScene = this.buildPathScene(effective, this.pathCamera);

      // Render a single raster frame immediately so the canvas doesn't appear blank
      // while the BVH is being generated in the worker.
      try {
        this.renderer.render(this.pathScene, this.pathCamera);
      } catch {
        // Ignore.
      }

      // Async BVH generation to avoid long main-thread stalls.
      try {
        this.pathTracer.pausePathTracing = false;
      } catch {
        // Ignore.
      }
      try {
        await this.pathTracer.setSceneAsync(this.pathScene, this.pathCamera);
        if (token !== this.pathRenderToken) return;
        this.pathTracer.reset();
      } finally {
        this.pathSceneBuilding = false;

        // If something changed while we were building the BVH, render the latest request.
        const pending = this.pendingPathRequest;
        this.pendingPathRequest = null;
        if (pending) {
          // Fire and forget; renderOncePath increments the token internally.
          void this.renderOncePath(pending.config, pending.quality);
        }
      }
    } else if (cameraChanged) {
      // Camera-only update: avoid rebuilding the BVH.
      this.lastPathCameraKey = cameraKey;
      this.pathCamera = this.buildPathCamera(effective);
      try {
        this.pathTracer.pausePathTracing = false;
      } catch {
        // Ignore.
      }
      if (typeof this.pathTracer.setCamera === 'function') {
        this.pathTracer.setCamera(this.pathCamera);
      } else if (typeof this.pathTracer.updateCamera === 'function') {
        // Best-effort.
        this.pathTracer.updateCamera();
      }

      // Keep something on screen while accumulation restarts.
      try {
        if (this.pathScene) this.renderer.render(this.pathScene, this.pathCamera);
      } catch {
        // Ignore.
      }
      this.pathTracer.reset();
    } else if (qualityChanged) {
      // Quality change: keep scene, reset accumulation.
      try {
        this.pathTracer.pausePathTracing = false;
      } catch {
        // Ignore.
      }

      // Render a raster frame so reset doesn't look like a blank flash.
      try {
        if (this.pathScene && this.pathCamera) this.renderer.render(this.pathScene, this.pathCamera);
      } catch {
        // Ignore.
      }
      this.pathTracer.reset();
    }

    const sampleBudget = quality === 'interactive' ? 2 : 48;
    this.pathTracer.dynamicLowRes = true;
    this.pathTracer.lowResScale = 0.5;
    this.pathTracer.renderScale = quality === 'interactive' ? 0.65 : 1.0;
    this.pathTracer.minSamples = 1;
    this.pathTracer.renderDelay = 0;

    // Always draw at least one frame after resizing/clearing the canvas.
    // If we are already at the sample budget and we don't render a new frame,
    // the resized canvas can remain blank until the next user interaction.
    let didRenderSample = false;
    try {
      this.pathTracer.renderSample();
      didRenderSample = true;
    } catch {
      // Ignore; loop below may still recover.
    }

    if (!didRenderSample) {
      try {
        if (this.pathScene && this.pathCamera) this.renderer.render(this.pathScene, this.pathCamera);
      } catch {
        // Ignore.
      }
    }

    if ((this.pathTracer.samples ?? 0) >= sampleBudget) {
      this.stopPathTracingLoop();
      return;
    }

    this.startPathTracingLoop(sampleBudget);
  }

  private buildPathCamera(config: PopsicleConfig): THREE.PerspectiveCamera {
    const aspect = config.width / config.height;
    const frustumSize = 10;
    const baseDistance = Math.max(0.01, config.camera.distance);
    const zoom = cameraZoomFromDistance(baseDistance);
    const effectiveHeight = frustumSize / zoom;
    // This ends up constant for the chosen mapping, but we keep the derivation for clarity.
    const baseFov = (2 * Math.atan((effectiveHeight * 0.5) / baseDistance) * 180) / Math.PI;

    const baseStickDimensions = getStickDimensions(config.width, config.height, config.stickThickness, config.stickSize, config.stickRatio);
    const nColors = Math.max(1, config.colors.length);

    const resolvedBase = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: false }));
    const resolvedOv = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: true }));

    const dimsBaseByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedBase[pi].multipliers.popsicle;
      return getStickDimensions(
        config.width,
        config.height,
        config.stickThickness * (mult.thicknessMult ?? 1),
        config.stickSize * (mult.sizeMult ?? 1),
        config.stickRatio * (mult.ratioMult ?? 1)
      );
    });
    const dimsOvByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedOv[pi].multipliers.popsicle;
      return getStickDimensions(
        config.width,
        config.height,
        config.stickThickness * (mult.thicknessMult ?? 1),
        config.stickSize * (mult.sizeMult ?? 1),
        config.stickRatio * (mult.ratioMult ?? 1)
      );
    });

    const stickDimensionsByPalette = Array.from({ length: nColors }, (_, pi) => ({
      width: Math.max(dimsBaseByPalette[pi].width, dimsOvByPalette[pi].width),
      height: Math.max(dimsBaseByPalette[pi].height, dimsOvByPalette[pi].height),
      depth: Math.max(dimsBaseByPalette[pi].depth, dimsOvByPalette[pi].depth)
    }));

    let maxOutlineThickness = 0;
    for (let pi = 0; pi < nColors; pi++) {
      for (const st of [resolvedBase[pi], resolvedOv[pi]]) {
        const oc = st.facades.outline;
        if (!oc?.enabled) continue;
        const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
        if (thickness > maxOutlineThickness) maxOutlineThickness = thickness;
      }
    }

    const outlineScaleForBounds = 1 + maxOutlineThickness;
    const bounds = computeBoundsPerStick({
      stickCount: config.stickCount,
      getStickDimensions: (i) => stickDimensionsByPalette[((i % nColors) + nColors) % nColors],
      stickOverhang: config.stickOverhang,
      rotationCenterOffsetX: config.rotationCenterOffsetX,
      rotationCenterOffsetY: config.rotationCenterOffsetY,
      stickGap: config.stickGap,
      outlineScale: outlineScaleForBounds
    });
    const sphereRadius = 0.5 * bounds.size.length();
    const padding = config.bloom?.enabled ? 0.86 : 0.92;
    const minDist = minDistanceToFitBoundingSphere(sphereRadius, aspect, baseFov, padding);
    const d = Math.max(baseDistance, minDist);

    const camera = new THREE.PerspectiveCamera(clamp(baseFov, 5, 80), aspect, 0.1, Math.max(2000, d + sphereRadius * 4 + 50));
    const azimuthRad = degToRad(config.camera.azimuth);
    const elevationRad = degToRad(config.camera.elevation);
    camera.position.set(
      d * Math.cos(elevationRad) * Math.sin(azimuthRad),
      d * Math.sin(elevationRad),
      d * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return camera;
  }

  private getPathPresentQuad(): FullScreenQuad {
    if (this.pathPresentQuad) return this.pathPresentQuad;
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D map;
        varying vec2 vUv;

        void main() {
          vec4 col = texture2D(map, vUv);
          #if defined( TONE_MAPPING )
            col.rgb = toneMapping(col.rgb);
          #endif
          gl_FragColor = linearToOutputTexel(col);
        }
      `
    });
    material.toneMapped = true;
    material.depthWrite = false;
    material.depthTest = false;
    material.transparent = false;
    material.blending = THREE.NoBlending;
    this.pathPresentQuad = new FullScreenQuad(material);
    return this.pathPresentQuad;
  }

  private renderPathToCanvas(target: THREE.WebGLRenderTarget, renderer: THREE.WebGLRenderer): void {
    const quad = this.getPathPresentQuad();
    const material = quad.material as THREE.ShaderMaterial;
    material.uniforms.map.value = target.texture;

    const prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = this.pathToneMappingMode === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    quad.render(renderer);
    renderer.toneMapping = prevToneMapping;
  }

  private buildPathScene(config: PopsicleConfig, camera: THREE.PerspectiveCamera): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = null;

    // Lights
    if (config.lighting.enabled) {
      scene.add(new THREE.AmbientLight(0xffffff, config.lighting.ambientIntensity));
      const hemi = new THREE.HemisphereLight(0xffffff, 0x0b0b10, Math.max(0.0, config.lighting.ambientIntensity * 0.55));
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, config.lighting.intensity);
      key.position.set(config.lighting.position.x, config.lighting.position.y, config.lighting.position.z);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, config.lighting.intensity * 0.3);
      fill.position.set(-config.lighting.position.x, -config.lighting.position.y, config.lighting.position.z * 0.5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, config.lighting.intensity * 0.25);
      rim.position.set(config.lighting.position.x * 0.2, -config.lighting.position.y, config.lighting.position.z * 1.2);
      scene.add(rim);
    } else {
      scene.add(new THREE.AmbientLight(0xffffff, 1));
    }

    // Environment
    if (config.environment.enabled) {
      scene.environment = this.envCache.get(this.renderer, config.environment.style);
      const rotRad = degToRad(config.environment.rotation);
      if ('environmentRotation' in scene) {
        (scene as any).environmentRotation = new THREE.Euler(0, rotRad, 0);
      }
    }

    const safeStickOpacity = clamp(Number.isFinite(Number(config.stickOpacity)) ? Number(config.stickOpacity) : 1.0, 0, 1);
    const nColors = Math.max(1, config.colors.length);

    const getOv = (paletteIndex: number) => getEnabledPaletteOverride(config, paletteIndex);
    const hasOvByPalette = new Array(nColors).fill(false);
    const freqByPalette = new Array(nColors).fill(1);
    for (let pi = 0; pi < nColors; pi++) {
      const ov = getOv(pi);
      if (!ov) continue;
      hasOvByPalette[pi] = true;
      freqByPalette[pi] = clamp(Number(ov.frequency ?? 1), 0, 1);
    }

    const resolvedBase = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: false }));
    const resolvedOv = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: true }));

    const dimsBaseByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedBase[pi].multipliers.popsicle;
      return getStickDimensions(
        config.width,
        config.height,
        config.stickThickness * (mult.thicknessMult ?? 1),
        config.stickSize * (mult.sizeMult ?? 1),
        config.stickRatio * (mult.ratioMult ?? 1)
      );
    });
    const dimsOvByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = resolvedOv[pi].multipliers.popsicle;
      return getStickDimensions(
        config.width,
        config.height,
        config.stickThickness * (mult.thicknessMult ?? 1),
        config.stickSize * (mult.sizeMult ?? 1),
        config.stickRatio * (mult.ratioMult ?? 1)
      );
    });
    const dimsForBoundsByPalette = Array.from({ length: nColors }, (_, pi) => ({
      width: Math.max(dimsBaseByPalette[pi].width, dimsOvByPalette[pi].width),
      height: Math.max(dimsBaseByPalette[pi].height, dimsOvByPalette[pi].height),
      depth: Math.max(dimsBaseByPalette[pi].depth, dimsOvByPalette[pi].depth)
    }));

    let maxOutlineThickness = 0;
    for (let pi = 0; pi < nColors; pi++) {
      for (const st of [resolvedBase[pi], resolvedOv[pi]]) {
        const oc = st.facades.outline;
        if (!oc?.enabled) continue;
        const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
        if (thickness > maxOutlineThickness) maxOutlineThickness = thickness;
      }
    }

    const bounds = computeBoundsPerStick({
      stickCount: config.stickCount,
      getStickDimensions: (i) => dimsForBoundsByPalette[((i % nColors) + nColors) % nColors],
      stickOverhang: config.stickOverhang,
      rotationCenterOffsetX: config.rotationCenterOffsetX,
      rotationCenterOffsetY: config.rotationCenterOffsetY,
      stickGap: config.stickGap,
      outlineScale: 1 + maxOutlineThickness
    });

    const sticksByPalette: number[][] = Array.from({ length: nColors }, () => []);
    for (let i = 0; i < config.stickCount; i++) sticksByPalette[((i % nColors) + nColors) % nColors].push(i);

    const approxPos: Array<THREE.Vector3 | null> = new Array(config.stickCount).fill(null);
    {
      const safeStickGap = Number.isFinite(Number(config.stickGap)) ? Number(config.stickGap) : 0;
      let zCursor = 0;
      let prevDepth = 0;
      for (let i = 0; i < config.stickCount; i++) {
        const paletteIndex = ((i % nColors) + nColors) % nColors;
        const dims = dimsBaseByPalette[paletteIndex];
        if (i === 0) zCursor = 0;
        else zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeStickGap;
        prevDepth = dims.depth;
        const o = getStackingOffset(
          i,
          dims,
          config.stickOverhang,
          config.rotationCenterOffsetX,
          config.rotationCenterOffsetY,
          safeStickGap,
          zCursor
        );
        approxPos[i] = new THREE.Vector3(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
      }
    }

    const closestStickByPalette = new Array(nColors).fill(-1);
    for (let pi = 0; pi < nColors; pi++) {
      if (!hasOvByPalette[pi]) continue;
      const freq = freqByPalette[pi] ?? 1;
      if (freq > 0) continue;
      let bestI = -1;
      let bestD = Infinity;
      for (const idx of sticksByPalette[pi]) {
        const p = approxPos[idx];
        if (!p) continue;
        const d = camera.position.distanceToSquared(p);
        if (d < bestD) {
          bestD = d;
          bestI = idx;
        }
      }
      closestStickByPalette[pi] = bestI;
    }

    const applyOverrideByStick = new Array(config.stickCount).fill(false);
    for (let pi = 0; pi < nColors; pi++) {
      if (!hasOvByPalette[pi]) continue;
      const freq = freqByPalette[pi] ?? 1;
      const occ = sticksByPalette[pi] ?? [];
      if (freq >= 0.999) {
        for (const idx of occ) applyOverrideByStick[idx] = true;
        continue;
      }
      if (freq <= 0.000001) {
        const idx = closestStickByPalette[pi];
        if (idx >= 0) applyOverrideByStick[idx] = true;
        continue;
      }
      for (let oi = 0; oi < occ.length; oi++) {
        const idx = occ[oi];
        if (hash01(config.seed, pi, oi) < freq) applyOverrideByStick[idx] = true;
      }
    }

    const bubblesCfg = (config as any).bubbles as any;
    const bubblesEnabled = !!bubblesCfg?.enabled;
    const bubblesMode: 'through' | 'cap' = bubblesCfg?.mode === 'cap' ? 'cap' : 'through';
    const useBubblesGeometry = bubblesEnabled;
    const materialConfig = useBubblesGeometry
      ? ({
          ...config,
          bubbles: {
            ...(bubblesCfg ?? {}),
            enabled: false
          }
        } as any as PopsicleConfig)
      : config;

    const seedBase = useBubblesGeometry ? buildBubblesSeed(config.seed, Number(bubblesCfg?.seedOffset) || 0) : 0;
    const evaluator = useBubblesGeometry ? new Evaluator() : null;
    const sphereGeo = useBubblesGeometry ? new THREE.SphereGeometry(1, 12, 10) : null;


    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = clamp((x - e0) / Math.max(1e-6, e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    };

    const carveBubbles = (
      geoIn: THREE.BufferGeometry,
      world: THREE.Matrix4,
      bubbles: Array<{ center: THREE.Vector3; radius: number }>
    ): THREE.BufferGeometry => {
      if (!evaluator || !sphereGeo) return geoIn;
      const inv = world.clone().invert();

      let current = new Brush(geoIn.clone());
      current.updateMatrixWorld(true);

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const cLocal = b.center.clone().applyMatrix4(inv);
        const sphere = new Brush(sphereGeo);
        sphere.position.copy(cLocal);
        sphere.scale.setScalar(b.radius);
        sphere.updateMatrixWorld(true);

        const next = evaluator.evaluate(current, sphere, SUBTRACTION);
        if (current.geometry) current.geometry.dispose();
        current = next;
      }

      const out = current.geometry;
      out.computeVertexNormals();
      out.computeBoundingBox();
      out.computeBoundingSphere();
      return out;
    };

    const qualityBoost = useBubblesGeometry && bubblesMode === 'cap' ? Math.max(config.geometry.quality, 0.95) : config.geometry.quality;

    const geoCache = new Map<string, THREE.BufferGeometry>();
    const getGeo = (dims: { width: number; height: number; depth: number }, applyOverrides: boolean) => {
      const key = [
        dims.width.toFixed(4),
        dims.height.toFixed(4),
        dims.depth.toFixed(4),
        String(config.stickEndProfile),
        config.stickRoundness.toFixed(4),
        config.stickChipAmount.toFixed(4),
        config.stickChipJaggedness.toFixed(4),
        config.stickBevel.toFixed(4),
        qualityBoost.toFixed(3),
        applyOverrides ? 'ov1' : 'ov0',
        String(config.seed)
      ].join(':');
      const existing = geoCache.get(key);
      if (existing) return existing;
      const geo = createRoundedBox(
        dims.width,
        dims.height,
        dims.depth,
        config.stickEndProfile,
        config.stickRoundness,
        config.stickChipAmount,
        config.stickChipJaggedness,
        config.stickBevel,
        qualityBoost,
        config.seed
      );
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      geoCache.set(key, geo);
      return geo;
    };

    const envIntensity = config.environment.enabled ? config.environment.intensity : 0;
    const materialCache = new Map<string, THREE.Material | THREE.Material[]>();
    const getMat = (paletteIndex: number, hex: string, dims: { width: number; height: number; depth: number }, applyOverrides: boolean) => {
      const k = [
        materialConfig.texture,
        textureParamsKey(materialConfig),
        JSON.stringify(materialConfig.facades),
        JSON.stringify(materialConfig.edge),
        JSON.stringify(materialConfig.emission),
        JSON.stringify((materialConfig as any).bubbles ?? null),
        JSON.stringify((materialConfig as any).palette?.overrides ?? []),
        applyOverrides ? 'ov1' : 'ov0',
        String(paletteIndex),
        hex,
        dims.width.toFixed(4),
        dims.height.toFixed(4),
        dims.depth.toFixed(4),
        envIntensity.toFixed(3),
        safeStickOpacity.toFixed(3),
        String(materialConfig.seed)
      ].join(':');
      const existing = materialCache.get(k);
      if (existing) return existing;
      const m = createMaterialForColor(materialConfig, paletteIndex, hex, envIntensity, safeStickOpacity, dims, { applyOverrides });
      materialCache.set(k, m);
      return m;
    };

    const safeStickGap = Number.isFinite(Number(config.stickGap)) ? Number(config.stickGap) : 0;
    let zCursor = 0;
    let prevDepth = 0;

    for (let i = 0; i < config.stickCount; i++) {
      const paletteIndex = ((i % nColors) + nColors) % nColors;
      const applyOverrides = !!applyOverrideByStick[i];
      const hex = config.colors[paletteIndex] ?? '#ffffff';

      const dims = applyOverrides ? dimsOvByPalette[paletteIndex] : dimsBaseByPalette[paletteIndex];
      const geo = getGeo(dims, applyOverrides);
      const mat = getMat(paletteIndex, hex, dims, applyOverrides);
      const mesh = new THREE.Mesh(geo, mat);

      if (i === 0) {
        zCursor = 0;
      } else {
        zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeStickGap;
      }
      prevDepth = dims.depth;

      const o = getStackingOffset(
        i,
        dims,
        config.stickOverhang,
        config.rotationCenterOffsetX,
        config.rotationCenterOffsetY,
        safeStickGap,
        zCursor
      );

      mesh.position.set(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
      mesh.rotation.z = o.rotationZ;
      mesh.updateMatrixWorld(true);

      if (useBubblesGeometry) {
        const stickBounds = new THREE.Box3().setFromObject(mesh);

        const candidates = buildBubbles(bubblesCfg, new THREE.Vector3(1, 1, 1), seedBase, {
          bounds: stickBounds,
          maxBubbles: bubblesMode === 'cap' ? 260 : 160
        });

        const inv = mesh.matrixWorld.clone().invert();
        const halfW = Math.max(1e-6, dims.width * 0.5);
        const halfH = Math.max(1e-6, dims.height * 0.5);
        const halfD = Math.max(1e-6, dims.depth * 0.5);
        const minDim = Math.min(dims.width, dims.height, dims.depth);
        const openMargin = Math.max(0.002, minDim * 0.01);
        const sealMargin = Math.max(openMargin, (Number(bubblesCfg.wallThickness) || 0) * 0.85);

        const adjusted: Array<{ center: THREE.Vector3; radius: number }> = [];
        const cLocal = new THREE.Vector3();

        for (let bi = 0; bi < candidates.length && adjusted.length < (bubblesMode === 'cap' ? 14 : 12); bi++) {
          const b = candidates[bi];

          if (bubblesMode === 'cap') {
            cLocal.copy(b.center).applyMatrix4(inv);

            const dxMin = cLocal.x + halfW;
            const dxMax = halfW - cLocal.x;
            const dyMin = cLocal.y + halfH;
            const dyMax = halfH - cLocal.y;
            const dzMin = cLocal.z + halfD;
            const dzMax = halfD - cLocal.z;

            // Must be (roughly) inside stick volume.
            if (dxMin < 0 || dxMax < 0 || dyMin < 0 || dyMax < 0 || dzMin < 0 || dzMax < 0) continue;

            const dists = [dxMin, dxMax, dyMin, dyMax, dzMin, dzMax];
            let minI = 0;
            for (let i2 = 1; i2 < 6; i2++) if (dists[i2] < dists[minI]) minI = i2;
            const nearDist = dists[minI];
            const farDist = dists[minI ^ 1];

            const rOpen = nearDist + openMargin;
            const rSeal = farDist - sealMargin;
            if (!(rSeal > rOpen)) continue;
            if (b.radius < rOpen) continue; // don't inflate

            let r = Math.min(b.radius, rSeal);

            // Ensure the cavity does not break out of any other face.
            for (let fi = 0; fi < 6; fi++) {
              if (fi === minI) continue;
              r = Math.min(r, dists[fi] - sealMargin);
            }

            if (!(r > rOpen)) continue;

            adjusted.push({ center: b.center, radius: r });
          } else {
            // through
            adjusted.push({ center: b.center, radius: b.radius });
          }
        }

        if (adjusted.length > 0) {
          mesh.geometry = carveBubbles(mesh.geometry, mesh.matrixWorld, adjusted);
        }
      }

      scene.add(mesh);
    }

    return scene;
  }
}

export async function renderRasterToCanvas(config: PopsicleConfig): Promise<HTMLCanvasElement> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(config.width, config.height, false);
  applyToneMapping(renderer, config);
  renderer.setClearColor(new THREE.Color(config.backgroundColor), 1);

  const envCache = new EnvironmentCache();
  const scene = new THREE.Scene();
  scene.background = null;

  // Camera (orthographic)
  const aspect = config.width / config.height;
  const frustumSize = 10;
  const camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  const azimuthRad = degToRad(config.camera.azimuth);
  const elevationRad = degToRad(config.camera.elevation);
  camera.position.set(
    config.camera.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
    config.camera.distance * Math.sin(elevationRad),
    config.camera.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
  );
  camera.zoom = cameraZoomFromDistance(config.camera.distance);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  // Lights
  let keyLight: THREE.DirectionalLight | null = null;
  if (config.lighting.enabled) {
    scene.add(new THREE.AmbientLight(0xffffff, config.lighting.ambientIntensity));
    scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x0b0b10,
        Math.max(0.0, config.lighting.ambientIntensity * 0.55)
      )
    );
    keyLight = new THREE.DirectionalLight(0xffffff, config.lighting.intensity);
    keyLight.position.set(config.lighting.position.x, config.lighting.position.y, config.lighting.position.z);
    scene.add(keyLight);
    const fill = new THREE.DirectionalLight(0xffffff, config.lighting.intensity * 0.3);
    fill.position.set(-config.lighting.position.x, -config.lighting.position.y, config.lighting.position.z * 0.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, config.lighting.intensity * 0.25);
    rim.position.set(config.lighting.position.x * 0.2, -config.lighting.position.y, config.lighting.position.z * 1.2);
    scene.add(rim);
  } else {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
  }

  // Environment
  if (config.environment.enabled) {
    scene.environment = envCache.get(renderer, config.environment.style);
    const rotRad = degToRad(config.environment.rotation);
    if ('environmentRotation' in scene) {
      (scene as any).environmentRotation = new THREE.Euler(0, rotRad, 0);
    }
  }

  // Geometry + sticks
  const safeStickOpacity = clamp(Number.isFinite(Number(config.stickOpacity)) ? Number(config.stickOpacity) : 1.0, 0, 1);
  const stickDimensions = getStickDimensions(config.width, config.height, config.stickThickness, config.stickSize, config.stickRatio);
  const bounds = computeBounds(
    stickDimensions,
    config.stickCount,
    config.stickOverhang,
    config.rotationCenterOffsetX,
    config.rotationCenterOffsetY,
    config.stickGap
  );

  const geometry = createRoundedBox(
    stickDimensions.width,
    stickDimensions.height,
    stickDimensions.depth,
    config.stickEndProfile,
    config.stickRoundness,
    config.stickChipAmount,
    config.stickChipJaggedness,
    config.stickBevel,
    config.geometry.quality,
    config.seed
  );

  const useShadows = !!config.shadows.enabled;
  renderer.shadowMap.enabled = useShadows;
  setShadowType(renderer, config.shadows.type);
  if (keyLight) keyLight.castShadow = useShadows;

  const envIntensity = config.environment.enabled ? config.environment.intensity : 0;
  const materialCache = new Map<string, THREE.Material | THREE.Material[]>();
  const outlineEnabled = config.facades.outline.enabled;
  const outlineCfg = config.facades.outline;
  const outlineOpacity = clamp(Number(outlineCfg.opacity) || 1, 0, 1);
  const outlineThickness = Math.max(0, Math.min(0.2, Number(outlineCfg.thickness) || 0));
  const outlineMat = outlineEnabled
    ? new THREE.MeshBasicMaterial({
        color: new THREE.Color(outlineCfg.color),
        side: THREE.BackSide,
        transparent: outlineOpacity < 1,
        opacity: outlineOpacity,
        depthWrite: false
      })
    : null;
  const getMat = (paletteIndex: number, hex: string) => {
    const k = [
      config.texture,
      textureParamsKey(config),
      JSON.stringify(config.facades),
      JSON.stringify(config.edge),
      JSON.stringify(config.emission),
      JSON.stringify((config as any).bubbles ?? null),
      String(paletteIndex),
      hex,
      envIntensity.toFixed(3),
      safeStickOpacity.toFixed(3),
      String(config.seed)
    ].join(':');
    const existing = materialCache.get(k);
    if (existing) return existing;
    const m = createMaterialForColor(config, paletteIndex, hex, envIntensity, safeStickOpacity, stickDimensions);
    materialCache.set(k, m);
    return m;
  };

  for (let i = 0; i < config.stickCount; i++) {
    const o = getStackingOffset(
      i,
      stickDimensions,
      config.stickOverhang,
      config.rotationCenterOffsetX,
      config.rotationCenterOffsetY,
      config.stickGap
    );
    const paletteIndex = i % config.colors.length;
    const hex = config.colors[paletteIndex] ?? '#ffffff';
    const mesh = new THREE.Mesh(geometry, getMat(paletteIndex, hex));
    mesh.castShadow = useShadows;
    mesh.receiveShadow = useShadows;
    mesh.position.set(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
    mesh.rotation.set(0, 0, o.rotationZ);
    scene.add(mesh);

    if (outlineMat) {
      const om = new THREE.Mesh(geometry, outlineMat);
      om.castShadow = false;
      om.receiveShadow = false;
      om.position.copy(mesh.position);
      om.rotation.copy(mesh.rotation);
      om.scale.setScalar(1 + outlineThickness);
      scene.add(om);
    }
  }

  // No shadow catcher: keep shadows stick-to-stick only.

  if (config.bloom.enabled) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(config.width, config.height),
        config.bloom.strength,
        config.bloom.radius,
        config.bloom.threshold
      )
    );
    composer.render();
    composer.dispose();
  } else {
    renderer.render(scene, camera);
  }

  // Cleanup: keep canvas pixels intact.
  envCache.dispose();
  renderer.dispose();

  geometry.dispose();
  for (const m of materialCache.values()) disposeMaterial(m);
  outlineMat?.dispose();

  return renderer.domElement;
}
