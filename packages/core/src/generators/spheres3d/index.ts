import * as THREE from 'three';
import type { Spheres3DConfig, EnvironmentStyle, BubblesConfig } from '../../types.js';
import { buildBubbles, buildBubblesSeed, buildBubblesInteriorWalls } from '../../bubbles.js';
import { createSurfaceMaterial } from '../../materials.js';
import { createRng } from '../../types.js';
import { resolvePaletteConfig } from '../../palette.js';
import { renderWithOptionalBloom } from '../postprocessing.js';
import { applyOrthographicCameraFromConfig, autoFitOrthographicCameraToBox } from '../camera-fit.js';
import { getSpheres3DGeometry } from './geometry.js';
import { hash01, normalizeWeights, pickIndex } from './sampling.js';
import {
  chainOnBeforeCompile,
  clamp,
  createProceduralEnvironment,
  degToRad,
  lerp,
  makeSolidRedTexture01
} from './utils.js';

export function createSpheres3DScene(
  config: Spheres3DConfig,
  options?: {
    canvas?: HTMLCanvasElement;
    preserveDrawingBuffer?: boolean;
    pixelRatio?: number;
    collisionMaskScale?: number;
  }
): { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer } {
  const scene = new THREE.Scene();
  scene.background = null;

  if (typeof options?.collisionMaskScale === 'number') {
    (scene.userData as any).__wmCollisionMaskScale = options.collisionMaskScale;
  }

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

  // Lighting
  if (config.lighting.enabled) {
    scene.add(new THREE.AmbientLight(0xffffff, config.lighting.ambientIntensity));
    const key = new THREE.DirectionalLight(0xffffff, config.lighting.intensity);
    key.position.set(config.lighting.position.x, config.lighting.position.y, config.lighting.position.z);
    key.castShadow = useShadows;
    scene.add(key);
    if (useShadows) {
      const map = Math.max(256, Math.min(8192, Math.round(Number(config.shadows.mapSize) || 2048)));
      key.shadow.mapSize.set(map, map);
      key.shadow.bias = Number(config.shadows.bias) || 0;
      key.shadow.normalBias = Number(config.shadows.normalBias) || 0;
    }

    const fill = new THREE.DirectionalLight(0xffffff, config.lighting.intensity * 0.3);
    fill.position.set(-config.lighting.position.x, -config.lighting.position.y, config.lighting.position.z * 0.5);
    scene.add(fill);
  } else {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
  }

  // Environment
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

  const rng = createRng(config.seed);
  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const nColors = colors.length;
  const w = normalizeWeights(config.spheres.colorWeights, nColors);

  const paletteOverrides: any[] = Array.isArray((config as any).palette?.overrides) ? (config as any).palette.overrides : [];
  const hasPaletteOverride = new Array(nColors).fill(false);
  const overrideFrequency = new Array(nColors).fill(1);
  for (let pi = 0; pi < nColors; pi++) {
    const ov = paletteOverrides[pi];
    if (!ov || typeof ov !== 'object' || Array.isArray(ov)) continue;
    if (!(typeof ov.enabled === 'boolean' ? ov.enabled : !!ov.enabled)) continue;
    hasPaletteOverride[pi] = true;
    overrideFrequency[pi] = clamp(Number(ov.frequency ?? 1), 0, 1);
  }

  const resolvedBaseByPalette = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: false }));
  const resolvedOvByPalette = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi, { applyOverrides: true }));
  const radiusMultBaseByIndex = Array.from({ length: nColors }, (_, pi) => resolvedBaseByPalette[pi].multipliers.spheres3d.radiusMult);
  const radiusMultOvByIndex = Array.from({ length: nColors }, (_, pi) => resolvedOvByPalette[pi].multipliers.spheres3d.radiusMult);

  const count = Math.max(0, Math.round(config.spheres.count));
  const spread = Math.max(0, Number(config.spheres.spread) || 0);
  const depth = Math.max(0, Number(config.spheres.depth) || 0);
  const rMin = Math.max(0.0001, Number(config.spheres.radiusMin) || 0.1);
  const rMax = Math.max(rMin, Number(config.spheres.radiusMax) || rMin);

  const opacity = clamp(Number(config.spheres.opacity) || 1, 0, 1);

  const { geometry, flatShading } = getSpheres3DGeometry(config);

  // Assign each occurrence to a palette index.
  const indices: number[] = [];
  for (let i = 0; i < count; i++) indices.push(pickIndex(config.spheres.paletteMode, i, rng, w, nColors));

  // Compute positions (consume rng after palette assignment).
  const distribution = config.spheres.distribution;
  const layers = Math.max(1, Math.round(config.spheres.layers));
  const posByIndex: Array<{ x: number; y: number; z: number; rad: number }> = new Array(count);
  const posForIndex = (i: number): { x: number; y: number; z: number; rad: number } => {
    const rad = rMin + rng() * (rMax - rMin);
    if (distribution === 'layeredDepth') {
      const layer = i % layers;
      const zBase = layers === 1 ? 0 : lerp(-depth * 0.5, depth * 0.5, layer / (layers - 1));
      const z = zBase + (rng() - 0.5) * (depth / layers) * 0.75;
      const x = (rng() - 0.5) * 2 * spread;
      const y = (rng() - 0.5) * 2 * spread;
      return { x, y, z, rad };
    }
    if (distribution === 'jitteredGrid') {
      const gx = Math.max(1, Math.round(Math.sqrt(count * (config.width / Math.max(1, config.height)))));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = (spread * 2) / gx;
      const cellH = (spread * 2) / gy;
      const x = -spread + (cx + 0.5) * cellW + (rng() - 0.5) * cellW * 0.85;
      const y = -spread + (cy + 0.5) * cellH + (rng() - 0.5) * cellH * 0.85;
      const z = (rng() - 0.5) * depth;
      return { x, y, z, rad };
    }
    return { x: (rng() - 0.5) * 2 * spread, y: (rng() - 0.5) * 2 * spread, z: (rng() - 0.5) * depth, rad };
  };
  for (let i = 0; i < count; i++) posByIndex[i] = posForIndex(i);

  // Group occurrences per palette index.
  const occByPalette: number[][] = Array.from({ length: nColors }, () => []);
  for (let i = 0; i < count; i++) occByPalette[indices[i]].push(i);

  // Decide which occurrences receive palette overrides.
  const applyOverrideByIndex = new Array(count).fill(false);
  for (let pi = 0; pi < nColors; pi++) {
    if (!hasPaletteOverride[pi]) continue;
    const freq = overrideFrequency[pi] ?? 1;
    const occ = occByPalette[pi] ?? [];
    if (occ.length === 0) continue;

    if (freq >= 0.999) {
      for (const idx of occ) applyOverrideByIndex[idx] = true;
      continue;
    }

    if (freq <= 0.000001) {
      let best = -1;
      let bestD = Infinity;
      for (const idx of occ) {
        const p = posByIndex[idx];
        const dx = camera.position.x - p.x;
        const dy = camera.position.y - p.y;
        const dz = camera.position.z - p.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
      if (best >= 0) applyOverrideByIndex[best] = true;
      continue;
    }

    for (let oi = 0; oi < occ.length; oi++) {
      const idx = occ[oi];
      if (hash01(config.seed, pi, oi) < freq) applyOverrideByIndex[idx] = true;
    }
  }

  // Create per-palette base/override instanced meshes.
  const baseCountByPalette = new Array(nColors).fill(0);
  const ovCountByPalette = new Array(nColors).fill(0);
  for (let i = 0; i < count; i++) {
    const pi = indices[i];
    if (applyOverrideByIndex[i]) ovCountByPalette[pi]++;
    else baseCountByPalette[pi]++;
  }

  const paletteMeshesByPalette: THREE.InstancedMesh[][] = Array.from({ length: nColors }, () => []);
  const paletteMaterialsByPalette: THREE.Material[][] = Array.from({ length: nColors }, () => []);

  const perPalette: Array<{
    base?: { inst: THREE.InstancedMesh; mat: THREE.Material };
    ov?: { inst: THREE.InstancedMesh; mat: THREE.Material };
  }> = Array.from({ length: nColors }, () => ({}));

  for (let pi = 0; pi < nColors; pi++) {
    const mk = (applyOverrides: boolean) => {
      const mat = createSurfaceMaterial(config, pi, colors[pi], envIntensity, opacity, { applyOverrides });
      if ('flatShading' in (mat as any)) {
        (mat as any).flatShading = flatShading;
        (mat as any).needsUpdate = true;
      }
      return mat;
    };

    if (baseCountByPalette[pi] > 0) {
      const mat = mk(false);
      const inst = new THREE.InstancedMesh(geometry, mat, baseCountByPalette[pi]);
      inst.count = baseCountByPalette[pi];
      inst.castShadow = useShadows;
      inst.receiveShadow = useShadows;
      perPalette[pi].base = { inst, mat };
      paletteMeshesByPalette[pi].push(inst);
      paletteMaterialsByPalette[pi].push(mat);
      scene.add(inst);
    }
    if (ovCountByPalette[pi] > 0) {
      const mat = mk(true);
      const inst = new THREE.InstancedMesh(geometry, mat, ovCountByPalette[pi]);
      inst.count = ovCountByPalette[pi];
      inst.castShadow = useShadows;
      inst.receiveShadow = useShadows;
      perPalette[pi].ov = { inst, mat };
      paletteMeshesByPalette[pi].push(inst);
      paletteMaterialsByPalette[pi].push(mat);
      scene.add(inst);
    }
  }

  // Fill instance matrices.
  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  // Used to filter interior surfaces so they only appear when intersecting a sphere volume.
  const spheresForInterior: Array<{ x: number; y: number; z: number; r: number }> = new Array(count);

  const baseCursor = new Array(nColors).fill(0);
  const ovCursor = new Array(nColors).fill(0);

  for (let i = 0; i < count; i++) {
    const pi = indices[i];
    const applyOv = !!applyOverrideByIndex[i];
    const bucket = applyOv ? perPalette[pi].ov : perPalette[pi].base;
    if (!bucket) continue;
    const slot = applyOv ? ovCursor[pi]++ : baseCursor[pi]++;

    const p = posByIndex[i];
    tmpPos.set(p.x, p.y, p.z);
    tmpQuat.identity();
    const rm = applyOv ? (radiusMultOvByIndex[pi] ?? 1) : (radiusMultBaseByIndex[pi] ?? 1);
    tmpScale.setScalar(p.rad * rm);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    bucket.inst.setMatrixAt(slot, tmpMat);

    spheresForInterior[i] = { x: p.x, y: p.y, z: p.z, r: p.rad * rm };
  }

  for (let pi = 0; pi < nColors; pi++) {
    for (const b of [perPalette[pi].base, perPalette[pi].ov]) {
      if (!b) continue;
      b.inst.instanceMatrix.needsUpdate = true;
      b.inst.computeBoundingBox();
      b.inst.computeBoundingSphere();
    }
  }

  // Optional groups created later (used by collision depth rendering).
  let outlineGroup: THREE.Group | null = null;
  let interiorWallsGroup: THREE.Group | null = null;

  // Palette-group collision masking (3D): build per-group depth textures and apply shader alpha/discard.
  if (config.collisions.mode === 'carve' && nColors <= 8) {
    const depthMat = new THREE.MeshDepthMaterial();
    const dummy = makeSolidRedTexture01();

    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    let screenW = Math.max(1, Math.round(size.x));
    let screenH = Math.max(1, Math.round(size.y));

    const getMaskScale = () => {
      const v = Number((scene.userData as any).__wmCollisionMaskScale ?? 1);
      if (!Number.isFinite(v)) return 1;
      return Math.max(0.2, Math.min(1, v));
    };

    let rtW = Math.max(1, Math.round(screenW * getMaskScale()));
    let rtH = Math.max(1, Math.round(screenH * getMaskScale()));

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

    let depthRTs = Array.from({ length: nColors }, () => makeRT());

    let weights = Array.from({ length: nColors }, (_, i) => Math.max(0, Number(config.spheres.colorWeights[i] ?? 1)));
    if (!(weights.some((x) => x > 0))) weights = Array.from({ length: nColors }, () => 1);

    const marginPx = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
    const featherPx = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;
    const softEdge = config.collisions.carve.edge === 'soft' && featherPx > 0;

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

      const idxs = otherIndicesByPalette[pi];
      const otherDepth = idxs.map((j) => depthRTs[j].depthTexture);
      const matsForPalette = paletteMaterialsByPalette[pi] ?? [];

      const finishEnabled = config.collisions.mode === 'carve' && config.collisions.carve.finish === 'wallsCap' ? 1 : 0;
      const finishDepthPx =
        (Math.max(0, Number(config.collisions.carve.marginPx) || 0) +
          (config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0)) *
        Math.max(0, Number(config.collisions.carve.finishAutoDepthMult) || 0);
      for (const mat of matsForPalette) {
        if (softEdge) {
          mat.transparent = true;
          mat.depthWrite = false;
        }

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
  // Depth textures store 1.0 when nothing is drawn.
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
          `collide-v1:${config.collisions.carve.direction}:${config.collisions.carve.edge}:${marginPx.toFixed(2)}:${featherPx.toFixed(2)}:${otherDepth.length}`
        );
      }
    }

    const paletteMeshes = paletteMeshesByPalette.flat();
    (scene.userData as any).__wmBeforeRender = (r: THREE.WebGLRenderer, s: THREE.Scene, camera: THREE.Camera) => {
      const sz = new THREE.Vector2();
      r.getDrawingBufferSize(sz);
      const nextScreenW = Math.max(1, Math.round(sz.x));
      const nextScreenH = Math.max(1, Math.round(sz.y));
      const nextRTW = Math.max(1, Math.round(nextScreenW * getMaskScale()));
      const nextRTH = Math.max(1, Math.round(nextScreenH * getMaskScale()));

      if (nextRTW !== rtW || nextRTH !== rtH) {
        rtW = nextRTW;
        rtH = nextRTH;
        for (const rt of depthRTs) rt.dispose();
        depthRTs = Array.from({ length: nColors }, () => makeRT());

        for (let pi = 0; pi < nColors; pi++) {
          const idxs = otherIndicesByPalette[pi] ?? [];
          for (const mat of paletteMaterialsByPalette[pi] ?? []) {
            const shader = (mat.userData as any).__wmCollisionShader;
            if (!shader) continue;
            shader.uniforms.wmCollideRes.value.set(nextScreenW, nextScreenH);
            shader.uniforms.wmOtherDepthCount.value = idxs.length;
            shader.uniforms.wmOtherDepth0.value = (depthRTs[idxs[0]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth1.value = (depthRTs[idxs[1]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth2.value = (depthRTs[idxs[2]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth3.value = (depthRTs[idxs[3]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth4.value = (depthRTs[idxs[4]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth5.value = (depthRTs[idxs[5]]?.depthTexture as any) ?? dummy;
            shader.uniforms.wmOtherDepth6.value = (depthRTs[idxs[6]]?.depthTexture as any) ?? dummy;
          }
        }
      }

      // Update uniforms that might be tied to size.
      for (let pi = 0; pi < nColors; pi++) {
        for (const mat of paletteMaterialsByPalette[pi] ?? []) {
          const shader = (mat.userData as any).__wmCollisionShader;
          if (!shader) continue;
          shader.uniforms.wmCollideRes.value.set(nextScreenW, nextScreenH);
        }
      }

      screenW = nextScreenW;
      screenH = nextScreenH;

      const prevTarget = r.getRenderTarget();
      const prevOverride = (s as any).overrideMaterial;
      const vis = paletteMeshes.map((m) => m.visible);
      const clearCol = r.getClearColor(new THREE.Color());
      const clearA = r.getClearAlpha();

      const outlineVis = outlineGroup ? outlineGroup.visible : true;
      const interiorVis = interiorWallsGroup ? interiorWallsGroup.visible : true;

      r.setClearColor(0x000000, 0);
      (s as any).overrideMaterial = depthMat;
      if (outlineGroup) outlineGroup.visible = false;
      if (interiorWallsGroup) interiorWallsGroup.visible = false;

      for (let i = 0; i < nColors; i++) {
        for (const m of paletteMeshes) m.visible = false;
        for (const m of paletteMeshesByPalette[i] ?? []) m.visible = true;
        r.setRenderTarget(depthRTs[i]);
        r.clear(true, true, false);
        r.render(s, camera);
      }
      (s as any).overrideMaterial = prevOverride;
      if (outlineGroup) outlineGroup.visible = outlineVis;
      if (interiorWallsGroup) interiorWallsGroup.visible = interiorVis;
      for (let j = 0; j < paletteMeshes.length; j++) paletteMeshes[j].visible = vis[j];
      r.setRenderTarget(prevTarget);
      r.setClearColor(clearCol, clearA);
    };

    (scene.userData as any).__wmDisposeCollisionMasking = () => {
      try {
        for (const rt of depthRTs) rt.dispose();
        depthMat.dispose();
        dummy.dispose();
      } catch {
        // Ignore
      }
      delete (scene.userData as any).__wmBeforeRender;
    };
  }

  // Outline (optional): per-bucket overrides are supported via frequency selection.
  {
    outlineGroup = new THREE.Group();
    const outlineMats = new Map<string, THREE.MeshBasicMaterial>();

    const addBucketOutline = (bucket: { inst: THREE.InstancedMesh } | undefined, oc: any) => {
      if (!bucket) return;
      if (!oc?.enabled) return;
      const opacity = clamp(Number(oc.opacity) || 1, 0, 1);
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

      const baseInst = bucket.inst;
      const outInst = new THREE.InstancedMesh(geometry, outlineMat, baseInst.count);
      outInst.castShadow = false;
      outInst.receiveShadow = false;
      const s = new THREE.Vector3(1 + thickness, 1 + thickness, 1 + thickness);
      for (let j = 0; j < baseInst.count; j++) {
        baseInst.getMatrixAt(j, tmpMat);
        tmpMat.scale(s);
        outInst.setMatrixAt(j, tmpMat);
      }
      outInst.instanceMatrix.needsUpdate = true;
      outInst.computeBoundingBox();
      outInst.computeBoundingSphere();
      outlineGroup!.add(outInst);
    };

    for (let pi = 0; pi < nColors; pi++) {
      addBucketOutline(perPalette[pi].base, resolvedBaseByPalette[pi].facades.outline);
      addBucketOutline(perPalette[pi].ov, resolvedOvByPalette[pi].facades.outline);
    }

    if (outlineGroup.children.length > 0) {
      scene.add(outlineGroup);
    } else {
      outlineGroup = null;
    }
  }

  scene.updateWorldMatrix(true, true);
  const preCenterBounds = new THREE.Box3().setFromObject(scene);
  const bubblesConfig = (config as any).bubbles as BubblesConfig | undefined;
  if (bubblesConfig?.enabled && bubblesConfig.mode !== 'cap' && bubblesConfig.wallThickness > 0 && bubblesConfig.interior.enabled && !preCenterBounds.isEmpty()) {
    const seedBase = buildBubblesSeed(config.seed, bubblesConfig.seedOffset);
    const bubbles = buildBubbles(bubblesConfig, new THREE.Vector3(1, 1, 1), seedBase, { maxBubbles: 48, bounds: preCenterBounds });
    if (bubbles.length > 0) {
      const radiusMax = Math.max(0, Number(bubblesConfig.radiusMax) || 0);
      const expanded = preCenterBounds.clone().expandByScalar(radiusMax + 0.15);
      const filtered = bubbles.filter((b) => expanded.containsPoint(b.center));
      const intersecting = filtered.filter((b) => {
        const bx = b.center.x;
        const by = b.center.y;
        const bz = b.center.z;
        for (let i = 0; i < spheresForInterior.length; i++) {
          const s = spheresForInterior[i];
          const dx = bx - s.x;
          const dy = by - s.y;
          const dz = bz - s.z;
          if (dx * dx + dy * dy + dz * dz <= s.r * s.r) return true;
        }
        return false;
      });

      // Clamp interior sphere radius so it stays inside a containing sphere.
      const thickness = Math.max(0, Number(bubblesConfig.wallThickness) || 0);
      const softness = Math.max(0, Number(bubblesConfig.softness) || 0);
      const adjusted = intersecting
        .map((b) => {
          const bx = b.center.x;
          const by = b.center.y;
          const bz = b.center.z;
          let bestMargin = -Infinity;
          for (let i = 0; i < spheresForInterior.length; i++) {
            const s = spheresForInterior[i];
            const dx = bx - s.x;
            const dy = by - s.y;
            const dz = bz - s.z;
            const dd = dx * dx + dy * dy + dz * dz;
            if (dd > s.r * s.r) continue;
            const margin = s.r - Math.sqrt(dd);
            if (margin > bestMargin) bestMargin = margin;
          }

          if (!(bestMargin > 0)) return null;

          // buildBubblesInteriorWalls uses (bubble.radius - thickness - softness) for the interior sphere.
          const capR = bestMargin + thickness + softness;
          const nextR = Math.min(b.radius, capR);
          if (!(nextR > thickness + softness + 0.02)) return null;
          return { ...b, radius: nextR };
        })
        .filter((v): v is { center: THREE.Vector3; radius: number } => !!v);

      if (adjusted.length > 0) {
        const walls = buildBubblesInteriorWalls({
          bubbles: adjusted,
          palette: colors,
          wallThickness: bubblesConfig.wallThickness,
          softness: bubblesConfig.softness,
          maxMeshes: 32,
          tintStrength: 0.35,
          opacity: 0.92
        });
        if (walls) {
          interiorWallsGroup = walls;
          scene.add(walls);
        }
      }
    }
  }

  // Center (after outline)
  scene.updateWorldMatrix(true, true);
  const groupBox = new THREE.Box3().setFromObject(scene);
  if (!groupBox.isEmpty()) {
    const center = groupBox.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }

  if (config.camera.mode !== 'manual') {
    // Auto-fit camera to prevent cropped renders.
    try {
      scene.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(scene);
      const padding = clamp(Number(config.camera.padding), 0.5, 0.999);
      autoFitOrthographicCameraToBox(camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
    } catch {
      // Ignore auto-fit failures.
    }
  }

  // Avoid unused warning
  void envDisposable;

  return { scene, camera, renderer };
}

export function renderSpheres3DToCanvas(config: Spheres3DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { scene, camera, renderer } = createSpheres3DScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderWithOptionalBloom({ renderer, scene, camera, width: config.width, height: config.height, bloom: config.bloom });
  (scene.userData as any).__wmDisposeCollisionMasking?.();
  (scene.userData as any).__wmDisposeProceduralEnvironment?.();
  delete (scene.userData as any).__wmDisposeProceduralEnvironment;
  return renderer.domElement;
}
