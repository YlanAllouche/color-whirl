import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { resolvePaletteConfig } from '@wallpaper-maker/core';
import { EnvironmentCache } from './preview-environment.js';
import { createRoundedBox } from './preview-geometry.js';
import {
  applyToneMapping,
  clamp,
  createMaterialForColor,
  disposeMaterial,
  getEnabledPaletteOverride,
  hash01,
  setShadowType,
  textureParamsKey,
  type PopsicleConfig
} from './preview-utils.js';
import {
  applyOrthoCameraFromConfig,
  autoFitOrthoCameraToBox,
  computeBounds,
  computeBoundsPerStick,
  degToRad,
  getStackingOffset,
  getStickDimensions,
  symmetricBoxFromSize
} from './preview-layout.js';
import { PopsicleCollisionMasking } from './preview-collision.js';
import type { PreviewQuality } from './preview-types.js';

export function getPreviewSize(
  container: HTMLElement,
  renderer: THREE.WebGLRenderer,
  aspect: number,
  quality: PreviewQuality
): { previewWidth: number; previewHeight: number } {
  const cw = Math.max(1, container.clientWidth);
  const ch = Math.max(1, container.clientHeight);

  // Keep the displayed canvas size stable (fit-to-container), and only vary the internal
  // render buffer size while dragging.
  const cssWidth = Math.min(cw, ch * aspect);
  const cssHeight = cssWidth / aspect;

  const scale = quality === 'interactive' ? 0.6 : 1.0;
  const previewWidth = Math.max(1, Math.round(cssWidth * scale));
  const previewHeight = Math.max(1, Math.round(cssHeight * scale));

  // Force CSS size so the viewport doesn't "twitch" when previewWidth/Height changes.
  renderer.domElement.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
  renderer.domElement.style.height = `${Math.max(1, Math.round(cssHeight))}px`;

  return { previewWidth, previewHeight };
}

export class PopsicleRasterPipeline {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private sticksGroup: THREE.Group;
  private outlineGroup: THREE.Group;
  private outlineMeshes: THREE.Mesh[] = [];
  private stickMeshes: THREE.Mesh[] = [];
  private stickMaterialCache = new Map<string, THREE.Material | THREE.Material[]>();
  private stickGeometryCache = new Map<string, THREE.BufferGeometry>();
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private collision = new PopsicleCollisionMasking();

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  constructor(
    private container: HTMLElement,
    private renderer: THREE.WebGLRenderer,
    private envCache: EnvironmentCache
  ) {
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

  dispose(): void {
    for (const g of this.stickGeometryCache.values()) g.dispose();
    this.stickGeometryCache.clear();
    for (const m of this.stickMaterialCache.values()) disposeMaterial(m);
    this.stickMaterialCache.clear();
    this.stickMeshes = [];
    this.sticksGroup.clear();

    this.outlineMeshes = [];
    this.outlineGroup.clear();

    this.collision.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
  }

  renderOnce(config: PopsicleConfig, quality: PreviewQuality, opts?: { allowCollision?: boolean }): void {
    const effective = this.applyQualityOverrides(config, quality);

    // Camera
    const aspect = effective.width / effective.height;
    const frustumSize = 10;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    applyOrthoCameraFromConfig(this.camera, effective.camera);

    // Renderer + background
    applyToneMapping(this.renderer, effective);
    if (effective.rendering.toneMapping === 'aces') {
      this.renderer.toneMapping = THREE.NoToneMapping;
    }
    this.renderer.setClearColor(new THREE.Color(effective.backgroundColor), 1);

    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const pixelRatio = quality === 'interactive' ? 1 : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);

    const { previewWidth, previewHeight } = getPreviewSize(this.container, this.renderer, aspect, quality);
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

    if (effective.camera.mode !== 'manual') {
      // Auto-fit camera before placing meshes (bounds are centered at origin by construction).
      try {
        const padding = Math.max(0.5, Math.min(0.999, Number(effective.camera.padding) || 0.92));
        autoFitOrthoCameraToBox(this.camera, symmetricBoxFromSize(bounds.size), padding);
      } catch {
        // Ignore.
      }
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
    const allowCollision = opts?.allowCollision ?? true;

    this.collision.applyRasterMasking({
      config: effective,
      previewWidth,
      previewHeight,
      meshesByPalette: collisionBuckets,
      paletteMaterials: collisionMaterials,
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      stickMeshes: this.stickMeshes,
      enabled: allowCollision
    });

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
  applyOrthoCameraFromConfig(camera, config.camera);

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
