import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createStickMeshMaterial } from '@wallpaper-maker/core';
import type { WallpaperConfig, EnvironmentStyle, ShadowType, TextureType } from '@wallpaper-maker/core';

type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

type PreviewQuality = 'interactive' | 'final';
export type PreviewRenderMode = 'raster' | 'path';

type Bounds = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampMult(raw: unknown, min: number = 0.25, max: number = 4): number {
  const v = Number(raw);
  if (!Number.isFinite(v)) return 1;
  return clamp(v, min, max);
}

function getEnabledPaletteOverride(config: PopsicleConfig, paletteIndex: number): any | null {
  const list: any = (config as any)?.palette?.overrides;
  if (!Array.isArray(list)) return null;
  const v = list[paletteIndex];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const enabled = typeof (v as any).enabled === 'boolean' ? (v as any).enabled : !!(v as any).enabled;
  if (!enabled) return null;
  return v;
}

function getPopsicleGeometryMultipliers(config: PopsicleConfig, paletteIndex: number): {
  sizeMult: number;
  ratioMult: number;
  thicknessMult: number;
} {
  const ov = getEnabledPaletteOverride(config, paletteIndex);
  const g = ov?.geometry?.popsicle;
  return {
    sizeMult: clampMult(g?.sizeMult),
    ratioMult: clampMult(g?.ratioMult),
    thicknessMult: clampMult(g?.thicknessMult)
  };
}

function chainOnBeforeCompile(material: THREE.Material, fn: (shader: any) => void, keyPart: string): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    (prev as any)?.(shader, renderer);
    fn(shader);
  };

  const prevKey = (material as any).customProgramCacheKey;
  (material as any).customProgramCacheKey = () => {
    const a = typeof prevKey === 'function' ? String(prevKey.call(material)) : '';
    return a ? `${a}|${keyPart}` : keyPart;
  };
  material.needsUpdate = true;
}

function makeSolidRedTexture01(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function disposeMaterial(m: THREE.Material | THREE.Material[] | null | undefined): void {
  if (!m) return;
  if (Array.isArray(m)) {
    for (const x of m) x.dispose();
    return;
  }
  m.dispose();
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

function autoFitOrthoCameraToBox(camera: THREE.OrthographicCamera, box: THREE.Box3, padding: number = 0.92): void {
  const pad = clamp(Number(padding), 0.5, 0.999);
  if (box.isEmpty()) return;

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

function symmetricBoxFromSize(size: THREE.Vector3): THREE.Box3 {
  const half = size.clone().multiplyScalar(0.5);
  return new THREE.Box3(new THREE.Vector3(-half.x, -half.y, -half.z), new THREE.Vector3(half.x, half.y, half.z));
}

function minDistanceToFitBoundingSphere(radius: number, aspect: number, vFovDeg: number, padding: number = 0.92): number {
  const r = Math.max(0, Number(radius) || 0);
  if (r <= 0) return 0;
  const pad = clamp(Number(padding), 0.5, 0.999);
  const vHalf = (clamp(Number(vFovDeg) || 0, 1, 179) * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(1e-6, aspect));
  const half = Math.min(vHalf, hHalf);
  const tanHalf = Math.max(1e-6, Math.tan(half));
  // Conservative: keep the near side of the sphere within the frustum.
  return r + r / (tanHalf * pad);
}

function getStickDimensions(
  canvasWidth: number,
  canvasHeight: number,
  stickThickness: number,
  stickSize: number,
  stickRatio: number
): { width: number; height: number; depth: number } {
  const aspect = canvasWidth / canvasHeight;
  const baseSize = 8;

  const safeSize = clamp(Number.isFinite(stickSize) ? stickSize : 1.0, 0.01, 100);
  const safeRatio = clamp(Number.isFinite(stickRatio) ? stickRatio : 3.0, 0.05, 100);

  const baseWidth = baseSize * aspect * 0.15 * safeSize;
  const baseHeight = baseSize * 0.8 * safeSize;
  const area = baseWidth * baseHeight;

  const width = Math.sqrt(area / safeRatio);
  const height = Math.sqrt(area * safeRatio);

  return {
    width,
    height,
    depth: baseSize * aspect * 0.02 * stickThickness * safeSize
  };
}

function getStackingOffset(
  index: number,
  stickDimensions: { width: number; height: number; depth: number },
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number,
  zOverride?: number
): { x: number; y: number; z: number; rotationZ: number } {
  const rotationAngle = index * degToRad(stickOverhang);

  const offsetXPercent = rotationCenterOffsetX / 100;
  const offsetYPercent = rotationCenterOffsetY / 100;

  const pivotX = offsetXPercent * (stickDimensions.width / 2);
  const pivotY = offsetYPercent * (stickDimensions.height / 2);

  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);

  const offsetX = pivotX * (1 - cos) + pivotY * sin;
  const offsetY = pivotY * (1 - cos) - pivotX * sin;

  return {
    x: offsetX,
    y: offsetY,
    z: typeof zOverride === 'number' && Number.isFinite(zOverride) ? zOverride : index * (stickDimensions.depth + stickGap),
    rotationZ: rotationAngle
  };
}

function createRoundedBox(
  width: number,
  height: number,
  depth: number,
  endProfile: 'rounded' | 'chamfer' | 'chipped',
  roundness: number,
  chipAmount: number,
  chipJaggedness: number,
  bevel: number,
  quality: number,
  seed: number
): THREE.BufferGeometry {
  const safeRoundness = clamp(roundness, 0, 1);
  const safeBevel = clamp(bevel, 0, 1);
  const safeChipAmount = clamp(chipAmount, 0, 1);
  const safeChipJaggedness = clamp(chipJaggedness, 0, 1);
  const q = clamp(quality, 0, 1);

  const maxRadius = Math.min(width, height) / 2;
  const radius = maxRadius * safeRoundness;

  const rng = (() => {
    let t = ((seed >>> 0) || 1) ^ 0x9e3779b9;
    return () => {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  const profile = endProfile === 'chamfer' || endProfile === 'chipped' || endProfile === 'rounded' ? endProfile : 'rounded';

  const addChippedCorner = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    inwardX: number,
    inwardY: number
  ) => {
    const segBase = 2 + Math.round(safeChipJaggedness * 6);
    const segs = Math.max(2, Math.min(10, segBase));
    const invLen = 1 / Math.max(1e-6, Math.hypot(inwardX, inwardY));
    const ix = inwardX * invLen;
    const iy = inwardY * invLen;

    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const bx = fromX + (toX - fromX) * t;
      const by = fromY + (toY - fromY) * t;
      const jitter = (rng() - 0.5) * 2;
      const amt = safeChipAmount * radius * (0.25 + 0.55 * safeChipJaggedness) * (0.35 + 0.65 * Math.abs(jitter));
      shape.lineTo(bx + ix * amt, by + iy * amt);
    }
  };

  if (radius <= 0) {
    shape.moveTo(x, y);
    shape.lineTo(x + width, y);
    shape.lineTo(x + width, y + height);
    shape.lineTo(x, y + height);
    shape.closePath();
  } else if (profile === 'rounded') {
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
  } else {
    const c = radius;
    shape.moveTo(x + c, y);
    shape.lineTo(x + width - c, y);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width - c, y, x + width, y + c, -1, 1);
    }
    shape.lineTo(x + width, y + c);
    shape.lineTo(x + width, y + height - c);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width, y + height - c, x + width - c, y + height, -1, -1);
    }
    shape.lineTo(x + width - c, y + height);
    shape.lineTo(x + c, y + height);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + c, y + height, x, y + height - c, 1, -1);
    }
    shape.lineTo(x, y + height - c);
    shape.lineTo(x, y + c);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x, y + c, x + c, y, 1, 1);
    }
    shape.lineTo(x + c, y);
  }

  const maxBevel = Math.min(width, height) * 0.15;
  const bevelSize = maxBevel * safeBevel;
  const bevelThickness = maxBevel * safeBevel;

  const curveSegments = Math.round(12 + q * 96); // 12..108
  const bevelSegments = Math.round(2 + q * 24); // 2..26

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: depth,
    bevelEnabled: safeBevel > 0,
    bevelSegments,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function textureParamsKey(config: PopsicleConfig): string {
  const t = config.texture;
  if (t === 'drywall') {
    const p = config.textureParams.drywall;
    return `dry:${p.grainAmount.toFixed(3)}:${p.grainScale.toFixed(3)}`;
  }
  if (t === 'glass') {
    return `g:${config.textureParams.glass.style}`;
  }
  if (t === 'cel') {
    const p = config.textureParams.cel;
    return `cel:${Math.round(p.bands)}:${p.halftone ? 1 : 0}`;
  }
  return '';
}

function createMaterialForColor(
  config: PopsicleConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  stickOpacity: number,
  stickDimensions?: { width: number; height: number; depth: number }
): THREE.Material | THREE.Material[] {
  return createStickMeshMaterial(config, paletteIndex, color, envIntensity, stickOpacity, stickDimensions);
}

function createProceduralEquirectDataTexture(style: EnvironmentStyle): THREE.DataTexture {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const addSoftbox = (u: number, v: number, radius: number, strength: number) => {
    return (x: number, y: number) => {
      const dx = x - u;
      const dy = y - v;
      const d2 = dx * dx + dy * dy;
      const r2 = radius * radius;
      if (d2 >= r2) return 0;
      const t = 1 - d2 / r2;
      return strength * t * t;
    };
  };

  const spotA = addSoftbox(0.25, 0.22, 0.12, 0.9);
  const spotB = addSoftbox(0.72, 0.18, 0.16, 0.7);
  const spotC = addSoftbox(0.52, 0.55, 0.22, 0.45);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      let r = 0;
      let g = 0;
      let b = 0;

      if (style === 'overcast') {
        const top = 0.78;
        const bot = 0.46;
        const t = clamp01(1 - v);
        const k = bot + (top - bot) * Math.pow(t, 1.4);
        r = k;
        g = k;
        b = k;
      } else if (style === 'sunset') {
        const t = clamp01(1 - v);
        const warm = 0.55 + 0.4 * Math.pow(t, 1.2);
        r = warm;
        g = 0.35 + 0.25 * Math.pow(t, 1.1);
        b = 0.32 + 0.18 * Math.pow(1 - t, 1.7);
      } else {
        const t = clamp01(1 - v);
        const sky = 0.74 * Math.pow(t, 1.6);
        const floor = 0.06 + 0.05 * (1 - t);
        const k = floor + sky;
        r = k;
        g = k;
        b = k;
      }

      const s = spotA(u, v) + spotB(u, v) + spotC(u, v);
      r = clamp01(r + s);
      g = clamp01(g + s);
      b = clamp01(b + s);

      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

class EnvironmentCache {
  private envTargets = new Map<EnvironmentStyle, THREE.WebGLRenderTarget>();

  get(renderer: THREE.WebGLRenderer, style: EnvironmentStyle): THREE.Texture {
    const existing = this.envTargets.get(style);
    if (existing) return existing.texture;

    const tex = createProceduralEquirectDataTexture(style);
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();

    this.envTargets.set(style, target);
    return target.texture;
  }

  dispose(): void {
    for (const t of this.envTargets.values()) t.dispose();
    this.envTargets.clear();
  }
}

function applyToneMapping(renderer: THREE.WebGLRenderer, config: PopsicleConfig): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (config.rendering.toneMapping === 'aces') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
  }
  renderer.toneMappingExposure = Number.isFinite(config.rendering.exposure) ? config.rendering.exposure : 1.0;
  (renderer as any).physicallyCorrectLights = true;
}

function setShadowType(renderer: THREE.WebGLRenderer, type: ShadowType): void {
  renderer.shadowMap.type = type === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
}

function computeBounds(
  stickDimensions: { width: number; height: number; depth: number },
  stickCount: number,
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number,
  outlineScale: number = 1
): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  const oScale = Math.max(1, Number(outlineScale) || 1);

  // Conservative radius in XY accounting for rotation.
  const halfDiag = Math.sqrt(
    (stickDimensions.width * 0.5) * (stickDimensions.width * 0.5) +
      (stickDimensions.height * 0.5) * (stickDimensions.height * 0.5)
  ) * oScale;
  const halfDepth = stickDimensions.depth * 0.5 * oScale;

  for (let i = 0; i < stickCount; i++) {
    const o = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap);
    min.x = Math.min(min.x, o.x - halfDiag);
    min.y = Math.min(min.y, o.y - halfDiag);
    min.z = Math.min(min.z, o.z - halfDepth);
    max.x = Math.max(max.x, o.x + halfDiag);
    max.y = Math.max(max.y, o.y + halfDiag);
    max.z = Math.max(max.z, o.z + halfDepth);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  return { min, max, center, size, radius };
}

function computeBoundsPerStick(options: {
  stickCount: number;
  getStickDimensions: (i: number) => { width: number; height: number; depth: number };
  stickOverhang: number;
  rotationCenterOffsetX: number;
  rotationCenterOffsetY: number;
  stickGap: number;
  outlineScale?: number;
}): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  const oScale = Math.max(1, Number(options.outlineScale ?? 1) || 1);
  const safeGap = Number.isFinite(Number(options.stickGap)) ? Number(options.stickGap) : 0;

  let zCursor = 0;
  let prevDepth = 0;

  for (let i = 0; i < options.stickCount; i++) {
    const dims = options.getStickDimensions(i);
    if (i === 0) {
      zCursor = 0;
    } else {
      zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeGap;
    }
    prevDepth = dims.depth;

    const o = getStackingOffset(i, dims, options.stickOverhang, options.rotationCenterOffsetX, options.rotationCenterOffsetY, safeGap, zCursor);

    const halfDiag = Math.sqrt((dims.width * 0.5) * (dims.width * 0.5) + (dims.height * 0.5) * (dims.height * 0.5)) * oScale;
    const halfDepth = dims.depth * 0.5 * oScale;

    min.x = Math.min(min.x, o.x - halfDiag);
    min.y = Math.min(min.y, o.y - halfDiag);
    min.z = Math.min(min.z, o.z - halfDepth);
    max.x = Math.max(max.x, o.x + halfDiag);
    max.y = Math.max(max.y, o.y + halfDiag);
    max.z = Math.max(max.z, o.z + halfDepth);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  return { min, max, center, size, radius };
}

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
  private pathTracingLoopId = 0;
  private lastPathConfigKey = '';
  private lastPathQuality: PreviewQuality = 'final';
  private pathScene: THREE.Scene | null = null;
  private pathCamera: THREE.PerspectiveCamera | null = null;
  private pathInitPromise: Promise<void> | null = null;
  private pathRenderToken = 0;

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
    this.pathScene = null;
    this.pathCamera = null;

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
      void this.renderOncePath(config, quality);
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
    const stickDimensionsByPalette = Array.from({ length: nColors }, (_, pi) => {
      const mult = getPopsicleGeometryMultipliers(effective, pi);
      return getStickDimensions(
        effective.width,
        effective.height,
        effective.stickThickness * mult.thicknessMult,
        effective.stickSize * mult.sizeMult,
        effective.stickRatio * mult.ratioMult
      );
    });

    const outlineScaleForBounds = effective.facades.outline.enabled
      ? 1 + Math.max(0, Math.min(0.2, Number(effective.facades.outline.thickness) || 0))
      : 1;

    const bounds = computeBoundsPerStick({
      stickCount: effective.stickCount,
      getStickDimensions: (i) => stickDimensionsByPalette[((i % nColors) + nColors) % nColors],
      stickOverhang: effective.stickOverhang,
      rotationCenterOffsetX: effective.rotationCenterOffsetX,
      rotationCenterOffsetY: effective.rotationCenterOffsetY,
      stickGap: effective.stickGap,
      outlineScale: outlineScaleForBounds
    });

    // Auto-fit camera before placing meshes (bounds are centered at origin by construction).
    try {
      const padding = effective.bloom?.enabled ? 0.86 : 0.92;
      autoFitOrthoCameraToBox(this.camera, symmetricBoxFromSize(bounds.size), padding);
    } catch {
      // Ignore.
    }

    const geometriesByPalette: THREE.BufferGeometry[] = new Array(nColors);
    const usedGeoKeys = new Set<string>();

    for (let pi = 0; pi < nColors; pi++) {
      const dims = stickDimensionsByPalette[pi];
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
      geometriesByPalette[pi] = geo;
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
    const matBaseKey = [
      effective.texture,
      textureParamsKey(effective),
      facadesKey,
      edgeKey,
      emissionKey,
      bubblesKey,
      envIntensity.toFixed(3),
      safeStickOpacity.toFixed(3),
      String(effective.seed)
    ].join(':');
    const getMaterial = (paletteIndex: number, hex: string, stickDimensions: { width: number; height: number; depth: number }) => {
      const k = [
        matBaseKey,
        String(paletteIndex),
        hex,
        stickDimensions.width.toFixed(4),
        stickDimensions.height.toFixed(4),
        stickDimensions.depth.toFixed(4)
      ].join(':');
      const existing = this.stickMaterialCache.get(k);
      if (existing) return existing;
      const m = createMaterialForColor(effective, paletteIndex, hex, envIntensity, safeStickOpacity, stickDimensions);
      this.stickMaterialCache.set(k, m);
      return m;
    };

    const collisionPaletteCount = Math.max(1, effective.colors.length);
    const collisionBuckets: THREE.Mesh[][] = Array.from({ length: collisionPaletteCount }, () => []);
    const collisionPaletteMaterials: Array<THREE.Material | THREE.Material[]> = new Array(collisionPaletteCount);

    // Ensure mesh pool
    while (this.stickMeshes.length < effective.stickCount) {
      const dims0 = stickDimensionsByPalette[0];
      const mesh = new THREE.Mesh(geometriesByPalette[0], getMaterial(0, '#ffffff', dims0));
      this.sticksGroup.add(mesh);
      this.stickMeshes.push(mesh);
    }

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
      const hex = effective.colors[paletteIndex] ?? '#ffffff';
      const dims = stickDimensionsByPalette[paletteIndex];
      mesh.geometry = geometriesByPalette[paletteIndex];
      mesh.material = getMaterial(paletteIndex, hex, dims);
      collisionBuckets[paletteIndex % collisionPaletteCount].push(mesh);
      if (!collisionPaletteMaterials[paletteIndex % collisionPaletteCount]) collisionPaletteMaterials[paletteIndex % collisionPaletteCount] = mesh.material as any;
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

    // Outline (inverted hull)
    const outlineEnabled = effective.facades.outline.enabled;
    this.outlineGroup.visible = outlineEnabled;
    if (outlineEnabled) {
      const oc = effective.facades.outline;
      const opacity = clamp(Number(oc.opacity) || 1, 0, 1);
      const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
      const colorHex = new THREE.Color(oc.color).getHex();

      const needsNewMat =
        !this.outlineMaterial ||
        this.outlineMaterial.color.getHex() !== colorHex ||
        this.outlineMaterial.opacity !== opacity ||
        this.outlineMaterial.transparent !== (opacity < 1);

      if (needsNewMat) {
        this.outlineMaterial?.dispose();
        this.outlineMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(oc.color),
          side: THREE.BackSide,
          transparent: opacity < 1,
          opacity,
          depthWrite: false
        });
      }

      while (this.outlineMeshes.length < effective.stickCount) {
        const om = new THREE.Mesh(geometriesByPalette[0], this.outlineMaterial!);
        om.castShadow = false;
        om.receiveShadow = false;
        this.outlineGroup.add(om);
        this.outlineMeshes.push(om);
      }

      for (let i = 0; i < this.outlineMeshes.length; i++) {
        const om = this.outlineMeshes[i];
        if (i >= effective.stickCount) {
          om.visible = false;
          continue;
        }

        const sm = this.stickMeshes[i];
        om.visible = sm.visible;
        om.geometry = sm.geometry;
        om.material = this.outlineMaterial!;
        om.position.copy(sm.position);
        om.rotation.copy(sm.rotation);
        om.scale.setScalar(1 + thickness);
      }
    }

    this.applyCollisionMaskingRaster(effective, previewWidth, previewHeight, collisionBuckets, collisionPaletteMaterials);

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
    paletteMaterials: Array<THREE.Material | THREE.Material[]>
  ): void {
    const nColors = Math.max(1, config.colors.length);
    if (meshesByPalette.length !== nColors) return;

    const enabled = config.collisions.mode === 'carve' && nColors <= 8 && this.mode === 'raster';
    if (!enabled) {
      // Leave any injected shader code in-place; it no-ops when otherDepthCount=0.
      for (const m of paletteMaterials) {
        if (!m) continue;
        const mats = Array.isArray(m) ? m : [m];
        for (const mm of mats) {
          const sh = (mm.userData as any).__wmCollisionShader;
          if (sh?.uniforms?.wmOtherDepthCount) sh.uniforms.wmOtherDepthCount.value = 0;
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
      const m = paletteMaterials[pi];
      if (!m) continue;
      const mats = Array.isArray(m) ? m : [m];
      for (const mm of mats) patchMaterial(mm, pi);
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

  // ---------------------- Path tracing ----------------------

  private async initPathTracer(): Promise<void> {
    const mod = await import('three-gpu-pathtracer');
    const WebGLPathTracer = (mod as any).WebGLPathTracer;
    if (!WebGLPathTracer) {
      throw new Error('WebGLPathTracer export not found in three-gpu-pathtracer');
    }
    this.pathTracer = new WebGLPathTracer(this.renderer);

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

  private getPathConfigKey(config: PopsicleConfig): string {
    // Keep it stable and cheap.
    const keyObj = {
      w: config.width,
      h: config.height,
      colors: config.colors,
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
      cam: config.camera,
      light: config.lighting,
      env: config.environment,
      tm: config.rendering,
      geo: config.geometry
    };
    return JSON.stringify(keyObj);
  }

  private async renderOncePath(config: PopsicleConfig, quality: PreviewQuality): Promise<void> {
    const token = ++this.pathRenderToken;
    if (!this.pathInitPromise) this.pathInitPromise = this.initPathTracer();
    await this.pathInitPromise;
    if (token !== this.pathRenderToken) return;

    const aspect = config.width / config.height;

    // Set renderer size (path tracer synchronizes render size if enabled).
    const { previewWidth, previewHeight } = this.getPreviewSize(aspect, quality);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(previewWidth, previewHeight, false);
    applyToneMapping(this.renderer, config);
    this.renderer.setClearColor(new THREE.Color(config.backgroundColor), 1);

    // Build / update scene if needed.
    const key = this.getPathConfigKey(config);
    const changed = key !== this.lastPathConfigKey;
    const qualityChanged = quality !== this.lastPathQuality;
    this.lastPathQuality = quality;

    if (changed) {
      this.lastPathConfigKey = key;
      this.pathScene?.traverse((obj) => {
        const mesh = obj as any;
        if (mesh.geometry?.dispose) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m: any) => m?.dispose?.());
          else mesh.material?.dispose?.();
        }
      });

      this.pathScene = this.buildPathScene(config);
      this.pathCamera = this.buildPathCamera(config);

      // Async BVH generation to avoid long main-thread stalls.
      await this.pathTracer.setSceneAsync(this.pathScene, this.pathCamera);
      if (token !== this.pathRenderToken) return;
      this.pathTracer.reset();
    } else if (qualityChanged) {
      // Quality change: keep scene, reset accumulation.
      this.pathTracer.reset();
    }

    if (quality === 'interactive') {
      this.pathTracer.dynamicLowRes = true;
      this.pathTracer.lowResScale = 0.5;
      this.pathTracer.renderScale = 0.65;
      this.pathTracer.minSamples = 1;
      this.pathTracer.renderDelay = 0;
      this.startPathTracingLoop(2);
    } else {
      this.pathTracer.dynamicLowRes = true;
      this.pathTracer.lowResScale = 0.5;
      this.pathTracer.renderScale = 1.0;
      this.pathTracer.minSamples = 1;
      this.pathTracer.renderDelay = 0;
      this.startPathTracingLoop(48);
    }
  }

  private buildPathCamera(config: PopsicleConfig): THREE.PerspectiveCamera {
    const aspect = config.width / config.height;
    const frustumSize = 10;
    const baseDistance = Math.max(0.01, config.camera.distance);
    const zoom = cameraZoomFromDistance(baseDistance);
    const effectiveHeight = frustumSize / zoom;
    // This ends up constant for the chosen mapping, but we keep the derivation for clarity.
    const baseFov = (2 * Math.atan((effectiveHeight * 0.5) / baseDistance) * 180) / Math.PI;

    const outlineScaleForBounds = config.facades.outline.enabled
      ? 1 + Math.max(0, Math.min(0.2, Number(config.facades.outline.thickness) || 0))
      : 1;
    const baseStickDimensions = getStickDimensions(config.width, config.height, config.stickThickness, config.stickSize, config.stickRatio);
    const nColors = Math.max(1, config.colors.length);
    const stickDimensionsByPalette = Array.from({ length: nColors }, (_, pi) => {
      const sizeMult = getPopsicleGeometryMultipliers(config, pi).sizeMult;
      return {
        width: baseStickDimensions.width * sizeMult,
        height: baseStickDimensions.height * sizeMult,
        depth: baseStickDimensions.depth * sizeMult
      };
    });
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

  private buildPathScene(config: PopsicleConfig): THREE.Scene {
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
    const baseStickDimensions = getStickDimensions(config.width, config.height, config.stickThickness, config.stickSize, config.stickRatio);
    const nColors = Math.max(1, config.colors.length);
    const stickDimensionsByPalette = Array.from({ length: nColors }, (_, pi) => {
      const sizeMult = getPopsicleGeometryMultipliers(config, pi).sizeMult;
      return {
        width: baseStickDimensions.width * sizeMult,
        height: baseStickDimensions.height * sizeMult,
        depth: baseStickDimensions.depth * sizeMult
      };
    });

    const bounds = computeBoundsPerStick({
      stickCount: config.stickCount,
      getStickDimensions: (i) => stickDimensionsByPalette[((i % nColors) + nColors) % nColors],
      stickOverhang: config.stickOverhang,
      rotationCenterOffsetX: config.rotationCenterOffsetX,
      rotationCenterOffsetY: config.rotationCenterOffsetY,
      stickGap: config.stickGap
    });

    const geometry = createRoundedBox(
      baseStickDimensions.width,
      baseStickDimensions.height,
      baseStickDimensions.depth,
      config.stickEndProfile,
      config.stickRoundness,
      config.stickChipAmount,
      config.stickChipJaggedness,
      config.stickBevel,
      config.geometry.quality,
      config.seed
    );

    const envIntensity = config.environment.enabled ? config.environment.intensity : 0;
    const materialCache = new Map<string, THREE.Material | THREE.Material[]>();
    const getMat = (paletteIndex: number, hex: string) => {
      const dims = stickDimensionsByPalette[paletteIndex] ?? baseStickDimensions;
      const k = [
        config.texture,
        textureParamsKey(config),
        JSON.stringify(config.facades),
        JSON.stringify(config.edge),
        JSON.stringify(config.emission),
        JSON.stringify((config as any).bubbles ?? null),
        String(paletteIndex),
        hex,
        dims.width.toFixed(4),
        dims.height.toFixed(4),
        dims.depth.toFixed(4),
        envIntensity.toFixed(3),
        safeStickOpacity.toFixed(3),
        String(config.seed)
      ].join(':');
      const existing = materialCache.get(k);
      if (existing) return existing;
      const m = createMaterialForColor(config, paletteIndex, hex, envIntensity, safeStickOpacity, dims);
      materialCache.set(k, m);
      return m;
    };

    const safeStickGap = Number.isFinite(Number(config.stickGap)) ? Number(config.stickGap) : 0;
    let zCursor = 0;
    let prevDepth = 0;

    for (let i = 0; i < config.stickCount; i++) {
      const paletteIndex = ((i % nColors) + nColors) % nColors;
      const hex = config.colors[paletteIndex] ?? '#ffffff';
      const mesh = new THREE.Mesh(geometry, getMat(paletteIndex, hex));

      const dims = stickDimensionsByPalette[paletteIndex] ?? baseStickDimensions;
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

      const sizeMult = getPopsicleGeometryMultipliers(config, paletteIndex).sizeMult;
      if (Number.isFinite(sizeMult) && sizeMult !== 1) mesh.scale.setScalar(sizeMult);

      mesh.position.set(o.x - bounds.center.x, o.y - bounds.center.y, o.z - bounds.center.z);
      mesh.rotation.z = o.rotationZ;
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
