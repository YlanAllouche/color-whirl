import * as THREE from 'three';
import type { Triangles3DConfig, EnvironmentStyle } from '../../types.js';
import { createSurfaceMaterial } from '../../materials.js';
import { createRng } from '../../types.js';
import { resolvePaletteConfig } from '../../palette.js';
import { renderWithOptionalBloom } from '../postprocessing.js';
import { applyOrthographicCameraFromConfig, autoFitOrthographicCameraToBox } from '../camera-fit.js';
import { createBulgedPrismGeometry } from './geometry.js';
import { normalizeWeights, pickIndex } from './sampling.js';
import {
  chainOnBeforeCompile,
  clamp,
  clamp01,
  createProceduralEnvironment,
  degToRad,
  makeSolidRedTexture01
} from './utils.js';

export function createTriangles3DScene(
  config: Triangles3DConfig,
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
  const w = normalizeWeights(config.prisms.colorWeights, nColors);

  const radiusMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi).multipliers.triangles3d.radiusMult);
  const heightMultByIndex = Array.from({ length: nColors }, (_, pi) => resolvePaletteConfig(config, pi).multipliers.triangles3d.heightMult);

  const count = Math.max(0, Math.round(config.prisms.count));
  const spread = Math.max(0, Number(config.prisms.spread) || 0);
  const jitter = clamp01(Number(config.prisms.jitter) || 0);
  const opacity = clamp(Number(config.prisms.opacity) || 1, 0, 1);

  const radius = Math.max(0.0001, Number(config.prisms.radius) || 0.2);
  const height = Math.max(0.0001, Number(config.prisms.height) || 0.5);

  const curveSegments = Math.round(2 + clamp(config.geometry.quality, 0, 1) * 14);
  const geometry = createBulgedPrismGeometry({
    base: config.prisms.base,
    taper: config.prisms.taper,
    wallBulgeX: config.prisms.wallBulgeX,
    wallBulgeY: config.prisms.wallBulgeY,
    curveSegments
  });
  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  // one instanced mesh per palette color
  const perColor: Array<{ idx: number; inst: THREE.InstancedMesh; mat: THREE.Material; count: number }> = [];
  for (let pi = 0; pi < nColors; pi++) {
    const mat = createSurfaceMaterial(config, pi, colors[pi], envIntensity, opacity);
    const inst = new THREE.InstancedMesh(geometry, mat, count);
    inst.castShadow = useShadows;
    inst.receiveShadow = useShadows;
    perColor.push({ idx: pi, inst, mat, count: 0 });
    scene.add(inst);
  }

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

    let weights = Array.from({ length: nColors }, (_, i) => Math.max(0, Number(config.prisms.colorWeights[i] ?? 1)));
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
      const otherDepth = otherIndicesByPalette[pi].map((j) => depthRTs[j].depthTexture);

      const finishEnabled = config.collisions.mode === 'carve' && config.collisions.carve.finish === 'wallsCap' ? 1 : 0;
      const finishDepthPx =
        (Math.max(0, Number(config.collisions.carve.marginPx) || 0) +
          (config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0)) *
        Math.max(0, Number(config.collisions.carve.finishAutoDepthMult) || 0);

      const mat = perColor[pi].mat;
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

    const paletteMeshes = perColor.map((p) => p.inst);
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
          const mat = perColor[pi].mat;
          const shader = (mat.userData as any).__wmCollisionShader;
          if (!shader) continue;
          shader.uniforms.wmCollideRes.value.set(nextScreenW, nextScreenH);

          const idxs = otherIndicesByPalette[pi] ?? [];
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

      screenW = nextScreenW;
      screenH = nextScreenH;

      for (let pi = 0; pi < nColors; pi++) {
        const mat = perColor[pi].mat;
        const shader = (mat.userData as any).__wmCollisionShader;
        if (!shader) continue;
        shader.uniforms.wmCollideRes.value.set(screenW, screenH);
      }

      const prevTarget = r.getRenderTarget();
      const prevOverride = (s as any).overrideMaterial;
      const vis = paletteMeshes.map((m) => m.visible);
      const clearCol = r.getClearColor(new THREE.Color());
      const clearA = r.getClearAlpha();

      r.setClearColor(0x000000, 0);
      (s as any).overrideMaterial = depthMat;
      for (let i = 0; i < nColors; i++) {
        for (let j = 0; j < nColors; j++) paletteMeshes[j].visible = j === i;
        r.setRenderTarget(depthRTs[i]);
        r.clear(true, true, false);
        r.render(s, camera);
      }
      (s as any).overrideMaterial = prevOverride;
      for (let j = 0; j < nColors; j++) paletteMeshes[j].visible = vis[j];
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

  const assigned: number[] = [];
  for (let i = 0; i < count; i++) assigned.push(pickIndex(config.prisms.paletteMode, i, rng, w, nColors));
  for (const pi of assigned) perColor[pi].count++;
  for (let pi = 0; pi < nColors; pi++) perColor[pi].inst.count = perColor[pi].count;
  const cursor = new Array(nColors).fill(0);

  const mode = config.prisms.mode;
  for (let i = 0; i < count; i++) {
    const pi = assigned[i];
    const slot = cursor[pi]++;

    const rm = radiusMultByIndex[pi] ?? 1;
    const hm = heightMultByIndex[pi] ?? 1;
    const radiusI = radius * rm;
    const heightI = height * hm;

    let x = 0;
    let y = 0;
    let z = 0;
    if (mode === 'tessellation') {
      const gx = Math.max(1, Math.round(Math.sqrt(count)));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = (spread * 2) / gx;
      const cellH = (spread * 2) / gy;
      x = -spread + (cx + 0.5) * cellW;
      y = -spread + (cy + 0.5) * cellH;
      z = (rng() - 0.5) * heightI * 0.5;
    } else {
      x = (rng() - 0.5) * 2 * spread;
      y = (rng() - 0.5) * 2 * spread;
      z = mode === 'stackedPrisms' ? (rng() - 0.5) * (spread * 0.7) : (rng() - 0.5) * heightI;
    }

    x += (rng() - 0.5) * jitter * radiusI * 2;
    y += (rng() - 0.5) * jitter * radiusI * 2;
    z += (rng() - 0.5) * jitter * radiusI;

    const rot = rng() * Math.PI * 2;
    tmpPos.set(x, y, z);
    tmpQuat.setFromEuler(new THREE.Euler(0, rot, 0));
    tmpScale.set(radiusI, heightI, radiusI);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    perColor[pi].inst.setMatrixAt(slot, tmpMat);
  }
  for (let pi = 0; pi < nColors; pi++) {
    perColor[pi].inst.instanceMatrix.needsUpdate = true;
    perColor[pi].inst.computeBoundingBox();
    perColor[pi].inst.computeBoundingSphere();
  }

  // Outline is supported, but is an extra pass (raster-only).
  // Per-palette overrides are supported.
  {
    const outlineMats = new Map<string, THREE.MeshBasicMaterial>();
    for (let pi = 0; pi < nColors; pi++) {
      const oc = resolvePaletteConfig(config, pi).facades.outline;
      if (!oc?.enabled) continue;

      const opacity = clamp(Number(oc.opacity) || 1, 0, 1);
      const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
      if (!(thickness > 0)) continue;

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

      const baseInst = perColor[pi].inst;
      const outInst = new THREE.InstancedMesh(geometry, outlineMat, baseInst.count);
      outInst.castShadow = false;
      outInst.receiveShadow = false;
      for (let j = 0; j < baseInst.count; j++) {
        baseInst.getMatrixAt(j, tmpMat);
        tmpMat.scale(new THREE.Vector3(1 + thickness, 1 + thickness, 1 + thickness));
        outInst.setMatrixAt(j, tmpMat);
      }
      outInst.instanceMatrix.needsUpdate = true;
      outInst.computeBoundingBox();
      outInst.computeBoundingSphere();
      scene.add(outInst);
    }
  }

  // Center (after outline)
  scene.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(scene);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }

  if (config.camera.mode !== 'manual') {
    // Auto-fit camera to prevent cropped renders.
    try {
      scene.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(scene);
      const requestedPadding = clamp(Number(config.camera.padding), 0.5, 0.999);
      const padding = config.bloom?.enabled ? Math.min(requestedPadding, 0.86) : requestedPadding;
      autoFitOrthographicCameraToBox(camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
    } catch {
      // Ignore auto-fit failures.
    }
  }

  void envDisposable;
  return { scene, camera, renderer };
}

export function renderTriangles3DToCanvas(config: Triangles3DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { scene, camera, renderer } = createTriangles3DScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderWithOptionalBloom({ renderer, scene, camera, width: config.width, height: config.height, bloom: config.bloom });
  (scene.userData as any).__wmDisposeCollisionMasking?.();
  (scene.userData as any).__wmDisposeProceduralEnvironment?.();
  delete (scene.userData as any).__wmDisposeProceduralEnvironment;
  return renderer.domElement;
}
