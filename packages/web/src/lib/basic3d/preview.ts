import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { Spheres3DConfig, Triangles3DConfig } from '@wallpaper-maker/core';
import { createSpheres3DScene, createTriangles3DScene } from '@wallpaper-maker/core';

export type Basic3DType = 'spheres3d' | 'triangles3d';
export type Basic3DConfig = Spheres3DConfig | Triangles3DConfig;
export type PreviewQuality = 'interactive' | 'final';

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
    if (this.scene) {
      try {
        (this.scene.userData as any).__wmDisposeCollisionMasking?.();
      } catch {
        // Ignore.
      }
      try {
        (this.scene.userData as any).__wmDisposeProceduralEnvironment?.();
      } catch {
        // Ignore.
      }
      try {
        delete (this.scene.userData as any).__wmDisposeProceduralEnvironment;
      } catch {
        // Ignore.
      }

      try {
        disposeSceneDeep(this.scene);
      } catch {
        // Ignore.
      }
    }

    try {
      this.composer?.dispose();
    } catch {
      // Ignore.
    }
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;

    if (this.renderer) {
      try {
        (this.renderer as any).forceContextLoss?.();
      } catch {
        // Ignore.
      }
      try {
        this.renderer.dispose();
      } catch {
        // Ignore.
      }
    }

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.lastSig = null;
    this.lastBloomEnabled = null;
    this.container.innerHTML = '';
  }

  renderOnce(
    config: Basic3DConfig,
    quality: PreviewQuality,
    opts?: {
      cameraOnly?: boolean;
    }
  ): void {
    const bloomEnabled = !!config.bloom?.enabled;
    const shouldComputeSig = !(opts?.cameraOnly === true);
    const nextSig = shouldComputeSig ? signatureWithoutCameraAndBloom(config) : null;

    const needsBuild = !this.renderer || !this.scene || !this.camera || (shouldComputeSig && nextSig !== this.lastSig);

    if (needsBuild) {
      this.build(config);
      this.lastSig = shouldComputeSig ? nextSig : signatureWithoutCameraAndBloom(config);
      this.lastBloomEnabled = null;
    }

    if (!this.renderer || !this.scene || !this.camera) return;

    // Size (keep consistent with config dimensions).
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(config.width, config.height, false);

    // Camera (matches generator setup).
    const aspect = config.width / config.height;
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

    // Bloom wiring is outside the generators; toggle/update without rebuilding.
    if (this.lastBloomEnabled !== bloomEnabled) {
      if (bloomEnabled) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.setPixelRatio(1);
        this.composer.setSize(config.width, config.height);
        this.renderPass = new RenderPass(this.scene, this.camera as any);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(config.width, config.height), config.bloom.strength, config.bloom.radius, config.bloom.threshold);
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
      this.composer.setSize(config.width, config.height);
      if (this.renderPass) this.renderPass.camera = this.camera as any;
      if (this.bloomPass) {
        this.bloomPass.strength = config.bloom.strength;
        this.bloomPass.radius = config.bloom.radius;
        this.bloomPass.threshold = config.bloom.threshold;
        this.bloomPass.resolution.set(config.width, config.height);
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

    // Note: quality is currently handled by the caller via config dimensions.
    void quality;
  }

  private build(config: Basic3DConfig): void {
    this.dispose();

    const collisionMaskScale = config.collisions?.mode === 'carve' ? 0.6 : 1;
    const built = this.type === 'spheres3d'
      ? createSpheres3DScene(config as Spheres3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale })
      : createTriangles3DScene(config as Triangles3DConfig, { preserveDrawingBuffer: true, pixelRatio: 1, collisionMaskScale });

    this.scene = built.scene;
    this.camera = built.camera;
    this.renderer = built.renderer;

    const el = this.renderer.domElement;
    el.style.display = 'block';
    el.style.touchAction = 'none';
    this.container.appendChild(el);
  }
}
