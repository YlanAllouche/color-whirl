import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { Spheres3DConfig, Triangles3DConfig } from '@wallpaper-maker/core';
import { createSpheres3DScene, createTriangles3DScene } from '@wallpaper-maker/core';

export type Basic3DType = 'spheres3d' | 'triangles3d';
export type Basic3DConfig = Spheres3DConfig | Triangles3DConfig;
export type PreviewQuality = 'interactive' | 'final';

export type RenderSize = { width: number; height: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function wrapDeg360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function cameraZoomFromDistance(distance: number): number {
  // Match the generators' orthographic zoom mapping.
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

function autoFitOrthoCameraToScene(camera: THREE.OrthographicCamera, scene: THREE.Scene, padding: number = 0.92): void {
  const pad = clamp(Number(padding), 0.5, 0.999);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return;

  // Push back if the camera would slice geometry.
  camera.updateMatrixWorld(true);

  const tmpDir = new THREE.Vector3();

  const min = box.min;
  const max = box.max;
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];

  const measure = () => {
    camera.updateMatrixWorld(true);
    let maxAbsX = 0;
    let maxAbsY = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < corners.length; i++) {
      const p = corners[i].clone().applyMatrix4(camera.matrixWorldInverse);
      maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
      maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    return { maxAbsX, maxAbsY, minZ, maxZ };
  };

  let m = measure();
  const minNear = 0.001;
  const zThreshold = -minNear + 1e-4;
  if (m.maxZ > zThreshold) {
    const delta = (m.maxZ - zThreshold) + Math.max(0.01, (m.maxZ - m.minZ) * 0.02);
    camera.getWorldDirection(tmpDir);
    camera.position.addScaledVector(tmpDir, -delta);
    m = measure();
  }

  const halfW0 = Math.abs(camera.right - camera.left) * 0.5;
  const halfH0 = Math.abs(camera.top - camera.bottom) * 0.5;
  const eps = 1e-6;
  const zoomMaxX = m.maxAbsX > eps ? (halfW0 * pad) / m.maxAbsX : Infinity;
  const zoomMaxY = m.maxAbsY > eps ? (halfH0 * pad) / m.maxAbsY : Infinity;
  const zoomMax = Math.min(zoomMaxX, zoomMaxY);
  if (Number.isFinite(zoomMax) && zoomMax > 0) camera.zoom = Math.min(camera.zoom, zoomMax);

  const nearDist = Math.max(0, -m.maxZ);
  const farDist = Math.max(0, -m.minZ);
  if (Number.isFinite(nearDist) && Number.isFinite(farDist) && farDist > 0) {
    const depth = Math.max(eps, farDist - nearDist);
    const zPad = Math.max(0.05, depth * 0.05);
    const nextNear = Math.max(minNear, nearDist - zPad);
    const nextFar = Math.max(nextNear + 1.0, farDist + zPad);
    camera.near = nextNear;
    camera.far = nextFar;
  }

  camera.updateProjectionMatrix();
}

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
    camera: { distance: 0, azimuth: 0, elevation: 0 }
  };
  if (normalized.bloom) {
    normalized.bloom = { ...normalized.bloom, enabled: false, strength: 0, radius: 0, threshold: 0 };
  }
  return JSON.stringify(normalized);
}

export class Basic3DPreview {
  private container: HTMLElement;
  private type: Basic3DType;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private lastSig: string | null = null;
  private lastBloomEnabled: boolean | null = null;

  constructor(container: HTMLElement, type: Basic3DType) {
    this.container = container;
    this.type = type;
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

    const azimuthRad = degToRad(wrapDeg360(config.camera.azimuth));
    const elevationDeg = clamp(config.camera.elevation, -80, 80);
    const elevationRad = degToRad(elevationDeg);
    const d = Math.max(0.01, config.camera.distance);
    this.camera.position.set(d * Math.cos(elevationRad) * Math.sin(azimuthRad), d * Math.sin(elevationRad), d * Math.cos(elevationRad) * Math.cos(azimuthRad));
    this.camera.zoom = cameraZoomFromDistance(d);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);

    // Auto-fit after applying user camera settings.
    try {
      const padding = bloomEnabled ? 0.86 : 0.92;
      autoFitOrthoCameraToScene(this.camera, this.scene, padding);
    } catch {
      // Ignore.
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

  private rebuild(config: Basic3DConfig): void {
    const collisionMaskScale = config.collisions?.mode === 'carve' ? 0.6 : 1;
    const built = this.type === 'spheres3d'
      ? createSpheres3DScene(config as Spheres3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale })
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
