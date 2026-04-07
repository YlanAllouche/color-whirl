import * as THREE from 'three';
import { EnvironmentCache } from './preview-environment.js';
import { PopsicleRasterPipeline } from './preview-raster.js';
import { PopsiclePathTracer } from './preview-path.js';
import type { PreviewQuality, PreviewRenderMode } from './preview-types.js';
import type { PopsicleConfig } from './preview-utils.js';

export type { PreviewRenderMode } from './preview-types.js';
export { renderRasterToCanvas } from './preview-raster.js';

export class PopsiclePreview {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private mode: PreviewRenderMode = 'raster';
  private envCache = new EnvironmentCache();
  private raster: PopsicleRasterPipeline;
  private path: PopsiclePathTracer;

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

    this.raster = new PopsicleRasterPipeline(this.container, this.renderer, this.envCache);
    this.path = new PopsiclePathTracer(this.container, this.renderer, this.envCache);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setMode(mode: PreviewRenderMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'raster') {
      this.path.stopPathTracingLoop();
      // Nothing else to do; raster scene is already resident.
      return;
    }

    // Lazily init path tracer when requested.
    void this.path.ensureInitialized();
  }

  dispose(): void {
    this.path.dispose();
    this.raster.dispose();
    this.envCache.dispose();
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
          this.path.stopPathTracingLoop();
        } catch {
          // Ignore.
        }
        this.raster.renderOnce(config, quality, { allowCollision: false });
        return;
      }

      void this.path.renderOncePath(config, quality).catch((err) => {
        // Never leave the UI blank if path tracing setup fails.
        console.error('Path traced preview failed:', err);
        try {
          this.path.stopPathTracingLoop();
          this.mode = 'raster';
          this.raster.renderOnce(config, quality, { allowCollision: true });
        } catch {
          // Ignore.
        }
      });
      return;
    }

    this.raster.renderOnce(config, quality, { allowCollision: true });
  }
}
