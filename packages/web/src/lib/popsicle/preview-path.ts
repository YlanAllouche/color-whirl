import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { buildBubbles, buildBubblesSeed, resolvePaletteConfig } from '@wallpaper-maker/core';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { EnvironmentCache } from './preview-environment.js';
import { createRoundedBox } from './preview-geometry.js';
import {
  applyToneMapping,
  clamp,
  createMaterialForColor,
  getEnabledPaletteOverride,
  hash01,
  textureParamsKey,
  type PopsicleConfig
} from './preview-utils.js';
import {
  cameraZoomFromDistance,
  computeBoundsPerStick,
  degToRad,
  getStackingOffset,
  getStickDimensions,
  minDistanceToFitBoundingSphere
} from './preview-layout.js';
import { getPreviewSize } from './preview-raster.js';
import type { PreviewQuality } from './preview-types.js';

export class PopsiclePathTracer {
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

  constructor(
    private container: HTMLElement,
    private renderer: THREE.WebGLRenderer,
    private envCache: EnvironmentCache
  ) {}

  ensureInitialized(): Promise<void> {
    if (!this.pathInitPromise) this.pathInitPromise = this.initPathTracer();
    return this.pathInitPromise;
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
  }

  stopPathTracingLoop(): void {
    if (this.pathTracingLoopId) {
      cancelAnimationFrame(this.pathTracingLoopId);
      this.pathTracingLoopId = 0;
    }
  }

  async renderOncePath(config: PopsicleConfig, quality: PreviewQuality): Promise<void> {
    const token = ++this.pathRenderToken;
    await this.ensureInitialized();
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
    const { previewWidth, previewHeight } = getPreviewSize(this.container, this.renderer, aspect, quality);
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

  private buildPathCamera(config: PopsicleConfig): THREE.PerspectiveCamera {
    const aspect = config.width / config.height;
    const frustumSize = 10;
    const baseDistance = Math.max(0.01, config.camera.distance);
    const zoom = cameraZoomFromDistance(baseDistance);
    const effectiveHeight = frustumSize / zoom;
    // This ends up constant for the chosen mapping, but we keep the derivation for clarity.
    const baseFov = (2 * Math.atan((effectiveHeight * 0.5) / baseDistance) * 180) / Math.PI;

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
    const padding = Math.max(0.5, Math.min(0.999, Number(config.camera.padding) || 0.92));
    const minDist = minDistanceToFitBoundingSphere(sphereRadius, aspect, baseFov, padding);
    const d = config.camera.mode === 'manual' ? baseDistance : Math.max(baseDistance, minDist);

    const near = config.camera.mode === 'manual' ? Math.max(0.001, Number(config.camera.near) || 0.001) : 0.1;
    const far =
      config.camera.mode === 'manual'
        ? Math.max(near + 0.001, Number(config.camera.far) || near + 1000)
        : Math.max(2000, d + sphereRadius * 4 + 50);

    const camera = new THREE.PerspectiveCamera(clamp(baseFov, 5, 80), aspect, near, far);
    const azimuthRad = degToRad(config.camera.azimuth);
    const elevationRad = degToRad(config.camera.elevation);
    const position = new THREE.Vector3(
      d * Math.cos(elevationRad) * Math.sin(azimuthRad),
      d * Math.sin(elevationRad),
      d * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    const target = new THREE.Vector3(0, 0, 0);

    if (config.camera.mode === 'manual') {
      const forward = target.clone().sub(position).normalize();
      let right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() < 1e-8) right = new THREE.Vector3(1, 0, 0);
      right.normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      const panX = Number.isFinite(Number(config.camera.panX)) ? Number(config.camera.panX) : 0;
      const panY = Number.isFinite(Number(config.camera.panY)) ? Number(config.camera.panY) : 0;
      const panOffset = right.multiplyScalar(panX).add(up.multiplyScalar(panY));
      position.add(panOffset);
      target.add(panOffset);
    }

    camera.position.copy(position);
    camera.lookAt(target);
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
