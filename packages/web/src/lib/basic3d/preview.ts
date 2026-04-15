import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { Spheres3DConfig, Triangles3DConfig, Svg3DConfig } from '@wallpaper-maker/core';
import {
  applyOrthographicCameraFromConfig,
  autoFitOrthographicCameraToBox,
  createSpheres3DScene,
  createTriangles3DScene,
  createSvg3DScene
} from '@wallpaper-maker/core';

export type Basic3DType = 'spheres3d' | 'triangles3d' | 'svg3d';
export type Basic3DConfig = Spheres3DConfig | Triangles3DConfig | Svg3DConfig;
export type PreviewQuality = 'interactive' | 'final';
export type RenderMode = 'raster' | 'path';

export type RenderSize = { width: number; height: number };

function disposeMaterial(mat: any): void {
  if (!mat) return;
  if (Array.isArray(mat)) {
    for (const m of mat) disposeMaterial(m);
    return;
  }

  try {
    // Common texture fields.
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'envMap']) {
      const tex = (mat as any)[k];
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    }
  } catch {
    // Ignore.
  }

  try {
    if (typeof mat.dispose === 'function') mat.dispose();
  } catch {
    // Ignore.
  }
}

function disposeSceneDeep(scene: THREE.Scene): void {
  scene.traverse((obj: THREE.Object3D) => {
    const anyObj = obj as any;
    if (anyObj.geometry && typeof anyObj.geometry.dispose === 'function') {
      try {
        anyObj.geometry.dispose();
      } catch {
        // Ignore.
      }
    }
    if (anyObj.material) disposeMaterial(anyObj.material);
  });
}

function signatureWithoutCameraAndBloom(config: Basic3DConfig): string {
  // These configs are plain data; JSON.stringify is stable enough here.
  const normalized: any = {
    ...config,
    camera: {}
  };
  if (normalized.bloom) {
    normalized.bloom = { ...normalized.bloom, enabled: false, strength: 0, radius: 0, threshold: 0 };
  }
  return JSON.stringify(normalized);
}

export class Basic3DPreview {
  private container: HTMLElement;
  private type: Basic3DType;

  private mode: RenderMode = 'raster';

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

  // Path tracing state
  private pathTracer: any = null;
  private bvhWorker: any = null;
  private pathInitPromise: Promise<void> | null = null;
  private pathRenderToken = 0;
  private pathScene: THREE.Scene | null = null;
  private pathCamera: THREE.Camera | null = null;
  private lastPathKey: string | null = null;
  private lastPathQuality: PreviewQuality | null = null;
  private pathLoopId: number | null = null;

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private lastSig: string | null = null;
  private lastBloomEnabled: boolean | null = null;

  constructor(container: HTMLElement, type: Basic3DType) {
    this.container = container;
    this.type = type;
  }

  setMode(mode: RenderMode): void {
    const next: RenderMode = mode === 'path' ? 'path' : 'raster';
    if (this.mode === next) return;
    this.mode = next;
    if (next === 'raster') {
      this.stopPathTracingLoop();
    }
    // Reset accumulation on mode change.
    this.pathTracer?.reset?.();
  }

  getDomElement(): HTMLCanvasElement | null {
    return (this.renderer?.domElement as HTMLCanvasElement | undefined) ?? null;
  }

  setType(type: Basic3DType): void {
    if (this.type === type) return;
    this.type = type;
    this.dispose();
  }

  dispose(): void {
    const prev = {
      renderer: this.renderer,
      scene: this.scene,
      composer: this.composer
    };

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.lastSig = null;
    this.lastBloomEnabled = null;

    this.stopPathTracingLoop();
    try {
      this.pathTracer?.dispose?.();
    } catch {
      // Ignore.
    }
    this.pathTracer = null;

    try {
      this.bvhWorker?.dispose?.();
    } catch {
      // Ignore.
    }
    this.bvhWorker = null;

    this.pathInitPromise = null;
    this.pathScene = null;
    this.pathCamera = null;
    this.lastPathKey = null;
    this.lastPathQuality = null;

    try {
      prev.composer?.dispose();
    } catch {
      // Ignore.
    }

    this.disposeSceneAndRenderer(prev.scene, prev.renderer);

    // Best-effort: ensure the host is clean.
    try {
      this.container.innerHTML = '';
    } catch {
      // Ignore.
    }
  }

  renderOnce(
    config: Basic3DConfig,
    quality: PreviewQuality,
    opts?: {
      cameraOnly?: boolean;
      renderSize?: RenderSize;
    }
  ): void {
    const renderW = Math.max(1, Math.round(Number(opts?.renderSize?.width ?? config.width) || 1));
    const renderH = Math.max(1, Math.round(Number(opts?.renderSize?.height ?? config.height) || 1));

    const bloomEnabled = !!config.bloom?.enabled;
    const shouldComputeSig = !(opts?.cameraOnly === true);
    const nextSig = shouldComputeSig ? signatureWithoutCameraAndBloom(config) : null;

    const needsBuild = !this.renderer || !this.scene || !this.camera || (shouldComputeSig && nextSig !== this.lastSig);

    if (needsBuild) {
      this.rebuild(config);
      this.lastSig = shouldComputeSig ? nextSig : signatureWithoutCameraAndBloom(config);
      this.lastBloomEnabled = null;
    }

    if (!this.renderer || !this.scene || !this.camera) return;

    // Size (keep consistent with config dimensions).
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(renderW, renderH, false);

    // Camera (matches generator setup).
    const aspect = renderW / renderH;
    const frustumSize = 10;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    applyOrthographicCameraFromConfig(this.camera, config.camera);

    if (config.camera.mode !== 'manual') {
      // Auto-fit after applying user camera settings.
      try {
        const bounds = new THREE.Box3().setFromObject(this.scene);
        const padding = Math.max(0.5, Math.min(0.999, Number(config.camera.padding) || 0.92));
        autoFitOrthographicCameraToBox(this.camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
      } catch {
        // Ignore.
      }
    }

    // Bloom wiring is outside the generators; toggle/update without rebuilding.
    if (this.lastBloomEnabled !== bloomEnabled) {
      if (bloomEnabled) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.setPixelRatio(1);
        this.composer.setSize(renderW, renderH);
        this.renderPass = new RenderPass(this.scene, this.camera as any);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(renderW, renderH), config.bloom.strength, config.bloom.radius, config.bloom.threshold);
        this.composer.addPass(this.bloomPass);
      } else {
        try {
          this.composer?.dispose();
        } catch {
          // Ignore.
        }
        this.composer = null;
        this.renderPass = null;
        this.bloomPass = null;
      }
      this.lastBloomEnabled = bloomEnabled;
    }

    if (this.composer) {
      this.composer.setSize(renderW, renderH);
      if (this.renderPass) this.renderPass.camera = this.camera as any;
      if (this.bloomPass) {
        this.bloomPass.strength = config.bloom.strength;
        this.bloomPass.radius = config.bloom.radius;
        this.bloomPass.threshold = config.bloom.threshold;
        this.bloomPass.resolution.set(renderW, renderH);
      }
    }

    if (this.mode === 'path') {
      void this.renderPath(config, quality, renderW, renderH).catch((err) => {
        // Never leave the UI blank if path tracing setup fails.
        console.error('Path traced preview failed:', err);
        try {
          this.stopPathTracingLoop();
          this.mode = 'raster';
          this.renderOnce(config, quality, opts);
        } catch {
          // Ignore.
        }
      });
      return;
    }

    // Generator hooks (collision masking, etc.).
    try {
      (this.scene.userData as any).__wmBeforeRender?.(this.renderer, this.scene, this.camera);
    } catch {
      // Ignore.
    }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Note: quality is handled by the caller via renderSize.
    void quality;
  }

  private getPathKey(config: Basic3DConfig): string {
    // Stable + cheap enough.
    return JSON.stringify(config);
  }

  private async initPathTracer(): Promise<void> {
    if (this.pathTracer) return;
    const mod = await import('three-gpu-pathtracer');
    const WebGLPathTracer = (mod as any).WebGLPathTracer ?? (mod as any).default?.WebGLPathTracer;
    if (!WebGLPathTracer) throw new Error('WebGLPathTracer export not found in three-gpu-pathtracer');
    if (!this.renderer) return;
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

    this.pathTracer.renderToCanvas = true;
    this.pathTracer.dynamicLowRes = true;
    this.pathTracer.lowResScale = 0.5;
    this.pathTracer.synchronizeRenderSize = true;
    this.pathTracer.rasterizeScene = true;
    this.pathTracer.enablePathTracing = true;
    this.pathTracer.pausePathTracing = false;
    this.pathTracer.bounces = 4;
    this.pathTracer.transmissiveBounces = 2;
    this.pathTracer.filterGlossyFactor = 0.5;

    // Reduce internal texture atlas size for previews.
    try {
      this.pathTracer.textureSize?.set?.(512, 512);
    } catch {
      // Ignore.
    }
  }

  private stopPathTracingLoop(): void {
    if (this.pathLoopId != null) {
      try {
        cancelAnimationFrame(this.pathLoopId);
      } catch {
        // Ignore
      }
      this.pathLoopId = null;
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
      this.pathLoopId = requestAnimationFrame(loop);
    };
    this.pathLoopId = requestAnimationFrame(loop);
  }

  private async renderPath(config: Basic3DConfig, quality: PreviewQuality, renderW: number, renderH: number): Promise<void> {
    const token = ++this.pathRenderToken;
    if (!this.renderer || !this.scene || !this.camera) return;

    // Lazy init path tracer.
    if (!this.pathInitPromise) this.pathInitPromise = this.initPathTracer();
    await this.pathInitPromise;
    if (token !== this.pathRenderToken) return;
    if (!this.pathTracer) return;

    // Size.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(renderW, renderH, false);

    const key = this.getPathKey(config);
    const changed = key !== this.lastPathKey;
    const qualityChanged = quality !== this.lastPathQuality;
    this.lastPathQuality = quality;

    if (changed) {
      this.lastPathKey = key;
      this.pathScene = this.scene;
      this.pathCamera = this.camera;
      await this.pathTracer.setSceneAsync(this.pathScene, this.pathCamera);
      if (token !== this.pathRenderToken) return;
      this.pathTracer.reset();
    } else if (qualityChanged) {
      this.pathTracer.reset();
    }

    if (quality === 'interactive') {
      this.pathTracer.renderScale = 0.65;
      this.startPathTracingLoop(2);
    } else {
      this.pathTracer.renderScale = 1.0;
      this.startPathTracingLoop(48);
    }
  }

  private rebuild(config: Basic3DConfig): void {
    const collisionMaskScale = config.collisions?.mode === 'carve' ? 0.6 : 1;
    const built =
      this.type === 'spheres3d'
        ? createSpheres3DScene(config as Spheres3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale })
        : this.type === 'svg3d'
          ? createSvg3DScene(config as Svg3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale })
          : createTriangles3DScene(config as Triangles3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale });

    const nextScene = built.scene;
    const nextCamera = built.camera;
    const nextRenderer = built.renderer;

    const nextEl = nextRenderer.domElement;
    nextEl.style.display = 'block';
    nextEl.style.touchAction = 'none';

    const prev = {
      renderer: this.renderer,
      scene: this.scene,
      composer: this.composer
    };

    // Swap in the new canvas first so a failed dispose doesn't blank the UI.
    try {
      const prevEl = prev.renderer?.domElement;
      if (prevEl && prevEl.parentElement === this.container) {
        this.container.replaceChild(nextEl, prevEl);
      } else {
        this.container.innerHTML = '';
        this.container.appendChild(nextEl);
      }
    } catch {
      // Last resort.
      try {
        this.container.innerHTML = '';
        this.container.appendChild(nextEl);
      } catch {
        // Ignore.
      }
    }

    this.scene = nextScene;
    this.camera = nextCamera;
    this.renderer = nextRenderer;

    // Path tracer is tied to a renderer; reset on rebuild.
    if (this.pathTracer) {
      this.stopPathTracingLoop();
      try {
        this.pathTracer.dispose?.();
      } catch {
        // Ignore.
      }
      this.pathTracer = null;
      this.pathInitPromise = null;
      this.lastPathKey = null;
      this.lastPathQuality = null;
    }

    try {
      this.bvhWorker?.dispose?.();
    } catch {
      // Ignore.
    }
    this.bvhWorker = null;

    // Recreate composer wiring lazily after rebuild.
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;

    try {
      prev.composer?.dispose();
    } catch {
      // Ignore.
    }

    this.disposeSceneAndRenderer(prev.scene, prev.renderer);
  }

  private disposeSceneAndRenderer(scene: THREE.Scene | null, renderer: THREE.WebGLRenderer | null): void {
    if (scene) {
      try {
        (scene.userData as any).__wmDisposeCollisionMasking?.();
      } catch {
        // Ignore.
      }
      try {
        (scene.userData as any).__wmDisposeProceduralEnvironment?.();
      } catch {
        // Ignore.
      }
      try {
        delete (scene.userData as any).__wmDisposeProceduralEnvironment;
      } catch {
        // Ignore.
      }

      try {
        disposeSceneDeep(scene);
      } catch {
        // Ignore.
      }
    }

    if (renderer) {
      try {
        renderer.dispose();
      } catch {
        // Ignore.
      }
    }
  }
}
