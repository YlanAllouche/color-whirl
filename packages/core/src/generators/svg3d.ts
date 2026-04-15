import * as THREE from 'three';

import type { Svg3DConfig, EnvironmentStyle, PaletteAssignMode } from '../types.js';
import { createRng } from '../types.js';
import { createSurfaceMaterial } from '../materials.js';
import { renderWithOptionalBloom } from './postprocessing.js';
import { applyOrthographicCameraFromConfig, autoFitOrthographicCameraToBox } from './camera-fit.js';
import { inferSvgRenderMode, validateSvgSource } from '../svg-utils.js';
import { resolvePaletteConfig } from '../palette.js';
import { extractSvgToneGeometries3D } from '../svg-tone-extraction.js';

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

function mergeNonIndexedBufferGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = geoms.filter(Boolean);
  if (list.length === 0) return new THREE.BufferGeometry();

  const posArrays: Float32Array[] = [];
  const normArrays: Float32Array[] = [];
  const uvArrays: Float32Array[] = [];

  let posLen = 0;
  let normLen = 0;
  let uvLen = 0;

  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const pos = g.getAttribute('position') as THREE.BufferAttribute | null;
    if (!pos) continue;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const nor = g.getAttribute('normal') as THREE.BufferAttribute | null;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | null;

    const posArr = pos.array instanceof Float32Array ? pos.array : new Float32Array(pos.array as any);
    const norArr = nor?.array instanceof Float32Array ? (nor.array as Float32Array) : nor ? new Float32Array(nor.array as any) : new Float32Array(posArr.length);
    const uvArr = uv?.array instanceof Float32Array ? (uv.array as Float32Array) : uv ? new Float32Array(uv.array as any) : new Float32Array(0);

    posArrays.push(posArr);
    normArrays.push(norArr);
    uvArrays.push(uvArr);
    posLen += posArr.length;
    normLen += norArr.length;
    uvLen += uvArr.length;
  }

  const out = new THREE.BufferGeometry();
  if (posLen === 0) return out;

  const posMerged = new Float32Array(posLen);
  const norMerged = new Float32Array(normLen);
  const uvMerged = uvLen > 0 ? new Float32Array(uvLen) : null;

  let pOff = 0;
  let nOff = 0;
  let uOff = 0;
  for (let i = 0; i < posArrays.length; i++) {
    posMerged.set(posArrays[i], pOff);
    pOff += posArrays[i].length;
    norMerged.set(normArrays[i], nOff);
    nOff += normArrays[i].length;
    if (uvMerged && uvArrays[i].length > 0) {
      uvMerged.set(uvArrays[i], uOff);
      uOff += uvArrays[i].length;
    }
  }

  out.setAttribute('position', new THREE.BufferAttribute(posMerged, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norMerged, 3));
  if (uvMerged && uOff > 0) out.setAttribute('uv', new THREE.BufferAttribute(uvMerged, 2));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function buildStrokeSvgGeometry(config: Svg3DConfig): { geometry: THREE.BufferGeometry; maxDim: number } {
  const source = validateSvgSource(config.svg.source);

  let data: any;
  try {
    const loader = new SVGLoader();
    data = loader.parse(source);
  } catch (err: any) {
    throw new Error(`Invalid SVG: failed to parse (${String(err?.message || err)})`);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const polylines: THREE.Vector2[][] = [];

  for (const p of data?.paths ?? []) {
    const subs = (p as any)?.subPaths ?? [];
    for (const sp of subs) {
      const pts = (sp as any).getPoints ? (sp as any).getPoints(80) : [];
      if (!pts || pts.length < 2) continue;
      const arr: THREE.Vector2[] = [];
      for (const v of pts) {
        const x = Number(v?.x);
        const y = Number(v?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        arr.push(new THREE.Vector2(x, y));
      }
      if (arr.length >= 2) polylines.push(arr);
    }
  }

  if (polylines.length === 0 || !Number.isFinite(minX)) {
    throw new Error('Invalid SVG: no drawable paths found for stroke rendering');
  }

  const w = Math.max(1e-9, maxX - minX);
  const h = Math.max(1e-9, maxY - minY);
  const maxDim = Math.max(w, h);
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  // Stroke width is expressed relative to the normalized icon (maxDim=1).
  const radiusNorm = Math.max(0.000001, Number(config.svg.stroke?.radius) || 0.000001);
  const widthNorm = radiusNorm * 2;
  const widthSvg = widthNorm * maxDim;

  const arcDiv = Math.max(1, Math.min(12, Math.round(Number(config.svg.stroke?.segments) || 6)));

  const style: any = {
    strokeWidth: widthSvg,
    strokeLineJoin: 'round',
    strokeLineCap: 'round',
    strokeMiterLimit: 4
  };

  const geoms: THREE.BufferGeometry[] = [];
  for (const pts of polylines) {
    const g = SVGLoader.pointsToStroke(pts, style, arcDiv, 0);
    if (g) geoms.push(g);
  }

  if (geoms.length === 0) {
    throw new Error('Invalid SVG: could not build stroke geometry');
  }

  const merged = mergeNonIndexedBufferGeometries(geoms);
  for (const g of geoms) {
    try {
      g.dispose();
    } catch {
      // Ignore
    }
  }

  // Center + normalize to maxDim=1.
  const s = 1 / Math.max(1e-9, maxDim);
  merged.applyMatrix4(new THREE.Matrix4().makeTranslation(-cx, -cy, 0));
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return { geometry: merged, maxDim };
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

  applyOrthographicCameraFromConfig(camera, config.camera);

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

  const rmRaw = String((config as any).svg?.renderMode ?? 'auto');
  const explicitMode = rmRaw === 'fill' || rmRaw === 'stroke' || rmRaw === 'fill+stroke' ? rmRaw : 'auto';
  const inferred = inferSvgRenderMode(config.svg.source);
  const mode = explicitMode === 'auto' ? inferred : (explicitMode as 'fill' | 'stroke' | 'fill+stroke');
  const doFill = mode === 'fill' || mode === 'fill+stroke';
  const doStroke = mode === 'stroke' || mode === 'fill+stroke';

  const colorModeRaw = String((config as any).svg?.colorMode ?? 'palette');
  const colorMode = colorModeRaw === 'svg-to-palette' ? 'svg-to-palette' : 'palette';
  const maxTones = Math.max(1, Math.min(64, Math.round(Number((config as any).svg?.maxTones) || 8)));

  const sizeMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config as any, pi).multipliers.svg.sizeMult);
  const extrudeMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config as any, pi).multipliers.svg.extrudeMult);

  const count = Math.max(1, Math.round(Number(config.svg.count) || 0));
  const spread = Math.max(0, Number(config.svg.spread) || 0);
  const depth = Math.max(0, Number(config.svg.depth) || 0);
  const tiltRad = degToRad(clamp(Number(config.svg.tiltDeg) || 0, 0, 80));
  const baseRotRad = degToRad(Number(config.svg.rotateDeg) || 0);
  const rotJitterRad = degToRad(Math.max(0, Number(config.svg.rotateJitterDeg) || 0));
  const sizeMin = Math.max(0.0001, Number(config.svg.sizeMin) || 0.0001);
  const sizeMax = Math.max(sizeMin, Number(config.svg.sizeMax) || sizeMin);
  const fillOpacity = doFill ? clamp01(Number(config.svg.opacity) || 1) : 0;
  const strokeOpacity = doStroke ? clamp01(Number(config.svg.stroke?.opacity) || 1) : 0;

  const geometryFill = doFill && colorMode === 'palette' ? buildExtrudedSvgGeometry(config).geometry : null;
  const toneGeometries = doFill && colorMode === 'svg-to-palette'
    ? extractSvgToneGeometries3D(config.svg.source, maxTones, {
        curveSegments: Math.max(1, Math.round(4 + clamp01(Number(config.geometry.quality) || 0) * 20)),
        bevelEnabled: !!config.svg.bevel?.enabled,
        bevelSizeNorm: clamp(Number(config.svg.bevel?.size) || 0, 0, 0.2),
        bevelSegments: Math.max(0, Math.min(8, Math.round(Number(config.svg.bevel?.segments) || 0))),
        depthScene: Math.max(0.000001, Number(config.svg.extrudeDepth) || 0.000001)
      }).map((entry) => entry.geometry)
    : null;
  const geometryStroke = doStroke ? buildStrokeSvgGeometry(config).geometry : null;

  if (!geometryFill && (!toneGeometries || toneGeometries.length === 0) && !geometryStroke) {
    // Should not happen; keep a clear error.
    throw new Error('SVG renderMode resulted in no geometry to render');
  }

  const useMode: PaletteAssignMode = config.svg.paletteMode === 'cycle' ? 'cycle' : 'weighted';
  const pickIndex = (i: number): number => {
    if (useMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weightsNorm);
  };

  // Instanced meshes per palette index for fill and/or stroke.
  const perColorFill: Array<{ idx: number; paletteIndex: number; inst: THREE.InstancedMesh; mat: THREE.Material; count: number }> = [];
  const perColorStroke: Array<{ idx: number; paletteIndex: number; inst: THREE.InstancedMesh; mat: THREE.Material; count: number }> = [];

  if (toneGeometries && toneGeometries.length > 0 && fillOpacity > 0) {
    // One instanced mesh per tone, colored by palette index.
    for (let ti = 0; ti < toneGeometries.length; ti++) {
      const pi = ti % nColors;
      const mat = createSurfaceMaterial(config, pi, colors[pi] ?? '#ffffff', envIntensity, fillOpacity);
      const anyMat: any = mat as any;
      if (typeof anyMat.side === 'number') anyMat.side = THREE.DoubleSide;
      const inst = new THREE.InstancedMesh(toneGeometries[ti], mat, count);
      inst.count = count;
      inst.castShadow = useShadows;
      inst.receiveShadow = useShadows;
      scene.add(inst);
      // Store in perColorFill as a generic bucket list (idx is tone index).
      perColorFill.push({ idx: ti, paletteIndex: pi, inst, mat, count });
    }
  } else if (geometryFill && fillOpacity > 0) {
    for (let pi = 0; pi < nColors; pi++) {
      const mat = createSurfaceMaterial(config, pi, colors[pi] ?? '#ffffff', envIntensity, fillOpacity);
      const anyMat: any = mat as any;
      if (typeof anyMat.side === 'number') anyMat.side = THREE.DoubleSide;
      const inst = new THREE.InstancedMesh(geometryFill, mat, count);
      perColorFill.push({ idx: pi, paletteIndex: pi, inst, mat, count: 0 });
      inst.castShadow = useShadows;
      inst.receiveShadow = useShadows;
      scene.add(inst);
    }
  }

  if (geometryStroke && strokeOpacity > 0) {
    for (let pi = 0; pi < nColors; pi++) {
      const mat = createSurfaceMaterial(config, pi, colors[pi] ?? '#ffffff', envIntensity, strokeOpacity);
      const anyMat: any = mat as any;
      if (typeof anyMat.side === 'number') anyMat.side = THREE.DoubleSide;
      const inst = new THREE.InstancedMesh(geometryStroke, mat, count);
      perColorStroke.push({ idx: pi, paletteIndex: pi, inst, mat, count: 0 });
      inst.castShadow = useShadows;
      inst.receiveShadow = useShadows;
      scene.add(inst);
    }
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
    const theta = baseRotRad + (rotJitterRad > 0 ? (rng() - 0.5) * rotJitterRad : 0);
    const tiltX = tiltRad > 0 ? (rng() - 0.5) * 2 * tiltRad : 0;
    const tiltY = tiltRad > 0 ? (rng() - 0.5) * 2 * tiltRad : 0;

    const pi = pickIndex(i);
    const bucketFill = colorMode === 'svg-to-palette' ? null : (perColorFill[pi] ?? perColorFill[0]);
    const bucketStroke = perColorStroke[pi] ?? perColorStroke[0];

    const sizeMult = colorMode === 'svg-to-palette' ? 1 : (sizeMultByIndex[pi] ?? 1);
    const extrudeMult = colorMode === 'svg-to-palette' ? 1 : (extrudeMultByIndex[pi] ?? 1);

    tmpPos.set(x, y, z);
    tmpEuler.set(tiltX, tiltY, theta);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(size * sizeMult, size * sizeMult, extrudeMult);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    if (colorMode === 'svg-to-palette') {
      // Apply the same transform to every tone mesh.
      for (const t of perColorFill) {
        t.inst.setMatrixAt(i, tmpMat);
      }
    } else {
      if (bucketFill) bucketFill.inst.setMatrixAt(bucketFill.count++, tmpMat);
    }

    // Stroke gets the same placement; its Z scale is arbitrary for a planar mesh.
    if (bucketStroke) {
      tmpScale.set(size * sizeMult, size * sizeMult, size * sizeMult);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      bucketStroke.inst.setMatrixAt(bucketStroke.count++, tmpMat);
    }
  }

  for (const it of perColorFill) {
    it.inst.count = it.count;
    it.inst.instanceMatrix.needsUpdate = true;
  }
  for (const it of perColorStroke) {
    it.inst.count = it.count;
    it.inst.instanceMatrix.needsUpdate = true;
  }

  // Outline (optional)
  {
    const outlineMats = new Map<string, THREE.MeshBasicMaterial>();
    const addBucketOutline = (bucket: { paletteIndex: number; inst: THREE.InstancedMesh }) => {
      if (!bucket?.inst || bucket.inst.count <= 0) return;

      const oc = resolvePaletteConfig(config as any, bucket.paletteIndex).facades.outline;
      if (!oc?.enabled) return;

      const opacity = clamp01(Number(oc.opacity) || 1);
      const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
      if (!(thickness > 0) || opacity <= 0) return;

      const matKey = `${String(oc.color)}:${opacity.toFixed(4)}`;
      let outlineMat = outlineMats.get(matKey);
      if (!outlineMat) {
        outlineMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(oc.color),
          side: THREE.BackSide,
          transparent: opacity < 1,
          opacity,
          depthWrite: false
        });
        outlineMats.set(matKey, outlineMat);
      }

      const outInst = new THREE.InstancedMesh(bucket.inst.geometry, outlineMat, bucket.inst.count);
      outInst.castShadow = false;
      outInst.receiveShadow = false;
      const s = new THREE.Vector3(1 + thickness, 1 + thickness, 1 + thickness);
      for (let j = 0; j < bucket.inst.count; j++) {
        bucket.inst.getMatrixAt(j, tmpMat);
        tmpMat.scale(s);
        outInst.setMatrixAt(j, tmpMat);
      }
      outInst.instanceMatrix.needsUpdate = true;
      outInst.computeBoundingBox();
      outInst.computeBoundingSphere();
      scene.add(outInst);
    };

    for (const it of perColorFill) addBucketOutline(it);
    for (const it of perColorStroke) addBucketOutline(it);
  }

  // SVG coordinates are Y-down; flip for three's Y-up.
  scene.scale.y = -1;

  if (config.camera.mode !== 'manual') {
    // Auto-fit camera to prevent cropped renders.
    try {
      scene.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(scene);
      const padding = clamp(Number(config.camera.padding), 0.5, 0.999);
      autoFitOrthographicCameraToBox(camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
    } catch {
      // Ignore.
    }
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
