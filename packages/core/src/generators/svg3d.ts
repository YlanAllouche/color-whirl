import * as THREE from 'three';

import type { Svg3DConfig, EnvironmentStyle, PaletteAssignMode } from '../types.js';
import { createRng } from '../types.js';
import { createSurfaceMaterial } from '../materials.js';
import { renderWithOptionalBloom } from './postprocessing.js';
import { autoFitOrthographicCameraToBox } from './camera-fit.js';
import { validateSvgSource } from '../svg-utils.js';
import { resolvePaletteConfig } from '../palette.js';

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function wrapDeg360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (u <= acc) return i;
  }
  return Math.max(0, wNorm.length - 1);
}

function createProceduralEnvironment(
  renderer: THREE.WebGLRenderer,
  style: EnvironmentStyle,
  rotationDeg: number
): { texture: THREE.Texture; dispose: () => void } {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  const rot = ((((rotationDeg % 360) + 360) % 360) / 360) * width;

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
      const xx = (x + rot) % width;
      const u = xx / (width - 1);

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
        const top = { r: 0.92, g: 0.48, b: 0.30 };
        const bot = { r: 0.18, g: 0.22, b: 0.35 };
        const t = clamp01(1 - v);
        const k = Math.pow(t, 1.1);
        r = bot.r + (top.r - bot.r) * k;
        g = bot.g + (top.g - bot.g) * k;
        b = bot.b + (top.b - bot.b) * k;
      } else {
        // studio
        const top = 0.85;
        const bot = 0.18;
        const t = clamp01(1 - v);
        const k = bot + (top - bot) * Math.pow(t, 1.35);
        r = k;
        g = k;
        b = k;
      }

      const a = spotA(u, v) + spotB(u, v) + spotC(u, v);
      r = clamp01(r + a);
      g = clamp01(g + a);
      b = clamp01(b + a);

      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  // PMREM for nicer reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();

  return {
    texture: env,
    dispose: () => {
      try {
        env.dispose();
      } finally {
        pmrem.dispose();
      }
    }
  };
}

function buildExtrudedSvgGeometry(config: Svg3DConfig): { geometry: THREE.BufferGeometry; maxDim: number } {
  const source = validateSvgSource(config.svg.source);

  let data: any;
  try {
    const loader = new SVGLoader();
    data = loader.parse(source);
  } catch (err: any) {
    throw new Error(`Invalid SVG: failed to parse (${String(err?.message || err)})`);
  }

  const shapes: THREE.Shape[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of data?.paths ?? []) {
    const subs = (p as any)?.subPaths ?? [];
    for (const sp of subs) {
      const pts = (sp as any).getPoints ? (sp as any).getPoints(40) : [];
      for (const v of pts) {
        const x = Number(v?.x);
        const y = Number(v?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    try {
      const ss = SVGLoader.createShapes(p as any);
      for (const s of ss) shapes.push(s);
    } catch {
      // Ignore malformed paths.
    }
  }

  if (shapes.length === 0 || !Number.isFinite(minX)) {
    throw new Error('Invalid SVG: no closed shapes found to extrude');
  }

  const w = Math.max(1e-9, maxX - minX);
  const h = Math.max(1e-9, maxY - minY);
  const maxDim = Math.max(w, h);
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  const curveSegments = Math.max(1, Math.round(4 + clamp01(Number(config.geometry.quality) || 0) * 20));
  const bevelEnabled = !!config.svg.bevel?.enabled;
  const bevelSizeNorm = clamp(Number(config.svg.bevel?.size) || 0, 0, 0.2);
  const bevelSeg = Math.max(0, Math.min(8, Math.round(Number(config.svg.bevel?.segments) || 0)));
  const depthScene = Math.max(0.000001, Number(config.svg.extrudeDepth) || 0.000001);

  // Convert normalized bevel size to SVG units, then normalize the resulting geometry.
  const depthSvg = depthScene * maxDim;
  const bevelSvg = bevelEnabled ? bevelSizeNorm * maxDim : 0;

  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: depthSvg,
    bevelEnabled: bevelEnabled && bevelSvg > 0 && bevelSeg > 0,
    bevelSize: bevelSvg,
    bevelThickness: bevelSvg,
    bevelSegments: Math.max(1, bevelSeg),
    curveSegments,
    steps: 1
  });

  // Center + normalize to maxDim=1 (uniform).
  geom.computeBoundingBox();
  const s = 1 / Math.max(1e-9, maxDim);
  geom.applyMatrix4(new THREE.Matrix4().makeTranslation(-cx, -cy, -depthSvg * 0.5));
  geom.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  return { geometry: geom, maxDim };
}

export function createSvg3DScene(
  config: Svg3DConfig,
  options?: {
    canvas?: HTMLCanvasElement;
    preserveDrawingBuffer?: boolean;
    pixelRatio?: number;
    collisionMaskScale?: number;
  }
): { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer } {
  const scene = new THREE.Scene();

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

  const azimuthRad = degToRad(wrapDeg360(config.camera.azimuth));
  const elevationDeg = clamp(Number(config.camera.elevation) || 0, -80, 80);
  const elevationRad = degToRad(elevationDeg);
  const d = Math.max(0.01, Number(config.camera.distance) || 0.01);
  camera.position.set(d * Math.cos(elevationRad) * Math.sin(azimuthRad), d * Math.sin(elevationRad), d * Math.cos(elevationRad) * Math.cos(azimuthRad));
  camera.zoom = cameraZoomFromDistance(d);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: options?.preserveDrawingBuffer ?? true,
    canvas: options?.canvas
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const tm = config.rendering.toneMapping === 'none' ? 'none' : 'aces';
  renderer.toneMapping = tm === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = Number.isFinite(Number(config.rendering.exposure)) ? Number(config.rendering.exposure) : 1.0;
  (renderer as any).physicallyCorrectLights = true;

  renderer.setClearColor(new THREE.Color(config.backgroundColor), 1);
  renderer.setSize(config.width, config.height);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const pr = Number.isFinite(Number(options?.pixelRatio)) ? Number(options?.pixelRatio) : Math.min(dpr, 2);
  renderer.setPixelRatio(pr);

  const useShadows = !!config.shadows.enabled;
  renderer.shadowMap.enabled = useShadows;
  renderer.shadowMap.type = config.shadows.type === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;

  if (config.lighting.enabled) {
    scene.add(new THREE.AmbientLight(0xffffff, Number(config.lighting.ambientIntensity) || 0));
    const key = new THREE.DirectionalLight(0xffffff, Number(config.lighting.intensity) || 0);
    key.position.set(config.lighting.position.x, config.lighting.position.y, config.lighting.position.z);
    key.castShadow = useShadows;
    scene.add(key);
    if (useShadows) {
      const map = Math.max(256, Math.min(8192, Math.round(Number(config.shadows.mapSize) || 2048)));
      key.shadow.mapSize.set(map, map);
      key.shadow.bias = Number(config.shadows.bias) || 0;
      key.shadow.normalBias = Number(config.shadows.normalBias) || 0;
    }
    const fill = new THREE.DirectionalLight(0xffffff, (Number(config.lighting.intensity) || 0) * 0.3);
    fill.position.set(-config.lighting.position.x, -config.lighting.position.y, config.lighting.position.z * 0.5);
    scene.add(fill);
  } else {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
  }

  let envDisposable: { dispose: () => void } | null = null;
  if (config.environment.enabled) {
    const style: EnvironmentStyle =
      config.environment.style === 'overcast' || config.environment.style === 'sunset' ? config.environment.style : 'studio';
    const rot = Number(config.environment.rotation) || 0;
    const env = createProceduralEnvironment(renderer, style, rot);
    envDisposable = env;
    scene.environment = env.texture;

    let disposed = false;
    (scene.userData as any).__wmDisposeProceduralEnvironment = () => {
      if (disposed) return;
      disposed = true;
      try {
        env.dispose();
      } finally {
        scene.environment = null;
      }
    };
  } else {
    scene.environment = null;
  }

  const envIntensity = config.environment.enabled ? Number(config.environment.intensity) || 0 : 0;
  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const nColors = colors.length;
  const rng = createRng(config.seed);
  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], nColors);

  const sizeMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config as any, pi).multipliers.svg.sizeMult);
  const extrudeMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config as any, pi).multipliers.svg.extrudeMult);

  const count = Math.max(1, Math.round(Number(config.svg.count) || 0));
  const spread = Math.max(0, Number(config.svg.spread) || 0);
  const depth = Math.max(0, Number(config.svg.depth) || 0);
  const sizeMin = Math.max(0.0001, Number(config.svg.sizeMin) || 0.0001);
  const sizeMax = Math.max(sizeMin, Number(config.svg.sizeMax) || sizeMin);
  const opacity = clamp01(Number(config.svg.opacity) || 1);

  const { geometry } = buildExtrudedSvgGeometry(config);

  const useMode: PaletteAssignMode = config.svg.paletteMode === 'cycle' ? 'cycle' : 'weighted';
  const pickIndex = (i: number): number => {
    if (useMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weightsNorm);
  };

  // One instanced mesh per palette index.
  const perColor: Array<{ idx: number; inst: THREE.InstancedMesh; mat: THREE.Material; count: number }> = [];
  for (let pi = 0; pi < nColors; pi++) {
    const mat = createSurfaceMaterial(config, pi, colors[pi] ?? '#ffffff', envIntensity, opacity);
    const anyMat: any = mat as any;
    if (typeof anyMat.side === 'number') anyMat.side = THREE.DoubleSide;
    perColor.push({ idx: pi, inst: new THREE.InstancedMesh(geometry, mat, count), mat, count: 0 });
  }

  for (const it of perColor) {
    it.inst.castShadow = useShadows;
    it.inst.receiveShadow = useShadows;
    scene.add(it.inst);
  }

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler(0, 0, 0);

  for (let i = 0; i < count; i++) {
    const size = sizeMin + rng() * (sizeMax - sizeMin);
    const x = (rng() - 0.5) * 2 * spread;
    const y = (rng() - 0.5) * 2 * spread;
    const z = (rng() - 0.5) * depth;
    const theta = rng() * Math.PI * 2;

    const pi = pickIndex(i);
    const bucket = perColor[pi] ?? perColor[0];

    const sizeMult = sizeMultByIndex[pi] ?? 1;
    const extrudeMult = extrudeMultByIndex[pi] ?? 1;

    tmpPos.set(x, y, z);
    tmpEuler.set(0, 0, theta);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(size * sizeMult, size * sizeMult, extrudeMult);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    bucket.inst.setMatrixAt(bucket.count++, tmpMat);
  }

  for (const it of perColor) {
    it.inst.count = it.count;
    it.inst.instanceMatrix.needsUpdate = true;
  }

  // SVG coordinates are Y-down; flip for three's Y-up.
  scene.scale.y = -1;

  // Auto-fit camera to prevent cropped renders.
  try {
    scene.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const padding = config.bloom?.enabled ? 0.86 : 0.92;
    autoFitOrthographicCameraToBox(camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
  } catch {
    // Ignore.
  }

  // Avoid unused warning
  void envDisposable;
  void options?.collisionMaskScale;

  return { scene, camera, renderer };
}

export function renderSvg3DToCanvas(config: Svg3DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { scene, camera, renderer } = createSvg3DScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderWithOptionalBloom({ renderer, scene, camera, width: config.width, height: config.height, bloom: config.bloom });
  (scene.userData as any).__wmDisposeProceduralEnvironment?.();
  delete (scene.userData as any).__wmDisposeProceduralEnvironment;
  return renderer.domElement;
}
