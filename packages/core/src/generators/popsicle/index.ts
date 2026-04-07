import * as THREE from 'three';
import type { PopsicleConfig, EnvironmentStyle, BubblesConfig } from '../../types.js';
import { buildBubbles, buildBubblesSeed, buildBubblesInteriorWalls } from '../../bubbles.js';
import { createStickMeshMaterial } from '../../materials.js';
import { resolvePaletteConfig } from '../../palette.js';
import { renderWithOptionalBloom } from '../postprocessing.js';
import { autoFitOrthographicCameraToBox } from '../camera-fit.js';
import type { StickDimensions } from './geometry.js';
import { createRoundedBox, getStackingOffset, getStickDimensions } from './geometry.js';
import { hash01 } from './sampling.js';
import {
  cameraZoomFromDistance,
  chainOnBeforeCompile,
  clamp,
  createProceduralEnvironment,
  degToRad,
  makeSolidRedTexture01
} from './utils.js';

export function createPopsicleScene(
  config: PopsicleConfig,
  options?: {
    canvas?: HTMLCanvasElement;
    preserveDrawingBuffer?: boolean;
    pixelRatio?: number;
    collisionMaskScale?: number;
  }
): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
} {
  const {
    width,
    height,
    colors,
    texture,
    backgroundColor,
    stickCount,
    stickOverhang,
    rotationCenterOffsetX,
    rotationCenterOffsetY,
    stickGap,
    stickSize,
    stickRatio,
    stickThickness,
    stickRoundness,
    stickBevel,
    stickOpacity,
    lighting,
    camera: cameraConfig,
    environment,
    shadows,
    rendering,
    geometry
  } = config;

  const safeStickOpacity = clamp(Number.isFinite(stickOpacity) ? stickOpacity : 1.0, 0, 1);

  const scene = new THREE.Scene();
  scene.background = null;

  if (typeof options?.collisionMaskScale === 'number') {
    (scene.userData as any).__wmCollisionMaskScale = options.collisionMaskScale;
  }

  const aspect = width / height;
  const frustumSize = 10;
  const camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  const azimuthRad = degToRad(cameraConfig.azimuth);
  const elevationRad = degToRad(cameraConfig.elevation);
  camera.position.set(
    cameraConfig.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
    cameraConfig.distance * Math.sin(elevationRad),
    cameraConfig.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
  );
  camera.zoom = cameraZoomFromDistance(cameraConfig.distance);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  if (lighting.enabled) {
    const ambientLight = new THREE.AmbientLight(0xffffff, lighting.ambientIntensity);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, lighting.intensity);
    directionalLight.position.set(lighting.position.x, lighting.position.y, lighting.position.z);
    directionalLight.castShadow = !!shadows?.enabled;
    scene.add(directionalLight);
    if (shadows?.enabled) {
      const map = Math.max(256, Math.min(8192, Math.round(Number(shadows.mapSize) || 2048)));
      directionalLight.shadow.mapSize.set(map, map);
      directionalLight.shadow.bias = Number(shadows.bias) || 0;
      directionalLight.shadow.normalBias = Number(shadows.normalBias) || 0;
    }

    const fillLight = new THREE.DirectionalLight(0xffffff, lighting.intensity * 0.3);
    fillLight.position.set(-lighting.position.x, -lighting.position.y, lighting.position.z * 0.5);
    scene.add(fillLight);
  } else {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
  }

  const nColors = Math.max(1, colors.length);

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

  const resolvedBaseByPalette = new Array(nColors);
  const resolvedOvByPalette = new Array(nColors);

  const stickDimensionsByPaletteBase: StickDimensions[] = new Array(nColors);
  const stickDimensionsByPaletteOv: StickDimensions[] = new Array(nColors);
  const geometryByPaletteBase: THREE.BufferGeometry[] = new Array(nColors);
  const geometryByPaletteOv: THREE.BufferGeometry[] = new Array(nColors);

  for (let pi = 0; pi < nColors; pi++) {
    const baseResolved = resolvePaletteConfig(config, pi, { applyOverrides: false });
    const ovResolved = resolvePaletteConfig(config, pi, { applyOverrides: true });
    resolvedBaseByPalette[pi] = baseResolved;
    resolvedOvByPalette[pi] = ovResolved;

    const multBase = baseResolved.multipliers.popsicle;
    const multOv = ovResolved.multipliers.popsicle;

    const dimsBase = getStickDimensions(
      width,
      height,
      stickThickness * (multBase.thicknessMult ?? 1),
      stickSize * (multBase.sizeMult ?? 1),
      stickRatio * (multBase.ratioMult ?? 1)
    );
    const dimsOv = getStickDimensions(
      width,
      height,
      stickThickness * (multOv.thicknessMult ?? 1),
      stickSize * (multOv.sizeMult ?? 1),
      stickRatio * (multOv.ratioMult ?? 1)
    );

    stickDimensionsByPaletteBase[pi] = dimsBase;
    stickDimensionsByPaletteOv[pi] = dimsOv;

    geometryByPaletteBase[pi] = createRoundedBox(
      dimsBase.width,
      dimsBase.height,
      dimsBase.depth,
      config.stickEndProfile,
      stickRoundness,
      config.stickChipAmount,
      config.stickChipJaggedness,
      stickBevel,
      geometry?.quality ?? 0.6,
      config.seed
    );
    geometryByPaletteOv[pi] = createRoundedBox(
      dimsOv.width,
      dimsOv.height,
      dimsOv.depth,
      config.stickEndProfile,
      stickRoundness,
      config.stickChipAmount,
      config.stickChipJaggedness,
      stickBevel,
      geometry?.quality ?? 0.6,
      config.seed
    );
  }

  const envIntensity = environment?.enabled ? Number(environment.intensity) || 0 : 0;
  const useShadows = !!shadows?.enabled;

  const group = new THREE.Group();
  const materialCache = new Map<string, THREE.Material | THREE.Material[]>();
  const materialParamsKey = JSON.stringify({
    t: config.textureParams,
    f: config.facades,
    ed: config.edge,
    b: (config as any).bubbles,
    em: config.emission,
    p: (config as any).palette
  });
  const getMat = (paletteIndex: number, hex: string, stickDimensions: StickDimensions, applyOverrides: boolean) => {
    const key = [
      texture,
      materialParamsKey,
      applyOverrides ? 'ov1' : 'ov0',
      String(paletteIndex),
      hex,
      stickDimensions.width.toFixed(4),
      stickDimensions.height.toFixed(4),
      stickDimensions.depth.toFixed(4),
      envIntensity.toFixed(3),
      safeStickOpacity.toFixed(3),
      String(config.seed)
    ].join(':');
    const existing = materialCache.get(key);
    if (existing) return existing;
    const m = createStickMeshMaterial(config, paletteIndex, hex, envIntensity, safeStickOpacity, stickDimensions, { applyOverrides });
    materialCache.set(key, m);
    return m;
  };

  const baseMeshesByPalette: THREE.Mesh[][] = Array.from({ length: nColors }, () => []);

  const sticksByPalette: number[][] = Array.from({ length: nColors }, () => []);
  for (let i = 0; i < stickCount; i++) sticksByPalette[((i % nColors) + nColors) % nColors].push(i);

  const approxPos: Array<THREE.Vector3> = new Array(stickCount);
  {
    const safeStickGap = Number.isFinite(Number(stickGap)) ? Number(stickGap) : 0;
    let zCursor = 0;
    let prevDepth = 0;
    for (let i = 0; i < stickCount; i++) {
      const paletteIndex = ((i % nColors) + nColors) % nColors;
      const dims = stickDimensionsByPaletteBase[paletteIndex];
      if (i === 0) zCursor = 0;
      else zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeStickGap;
      prevDepth = dims.depth;
      const o = getStackingOffset(i, dims, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, zCursor);
      approxPos[i] = new THREE.Vector3(o.x, o.y, o.z);
    }
  }

  const closestStickByPalette = new Array(nColors).fill(-1);
  for (let pi = 0; pi < nColors; pi++) {
    if (!hasPaletteOverride[pi]) continue;
    if ((overrideFrequency[pi] ?? 1) > 0) continue;
    let best = -1;
    let bestD = Infinity;
    for (const idx of sticksByPalette[pi]) {
      const p = approxPos[idx];
      const d = camera.position.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    closestStickByPalette[pi] = best;
  }

  const applyOverrideByStick = new Array(stickCount).fill(false);
  for (let pi = 0; pi < nColors; pi++) {
    if (!hasPaletteOverride[pi]) continue;
    const freq = overrideFrequency[pi] ?? 1;
    if (freq >= 0.999) {
      for (const idx of sticksByPalette[pi]) applyOverrideByStick[idx] = true;
      continue;
    }
    if (freq <= 0.000001) {
      const idx = closestStickByPalette[pi];
      if (idx >= 0) applyOverrideByStick[idx] = true;
      continue;
    }
    const occ = sticksByPalette[pi] ?? [];
    for (let oi = 0; oi < occ.length; oi++) {
      const idx = occ[oi];
      if (hash01(config.seed, pi, oi) < freq) applyOverrideByStick[idx] = true;
    }
  }

  const safeStickGap = Number.isFinite(Number(stickGap)) ? Number(stickGap) : 0;
  let zCursor = 0;
  let prevDepth = 0;

  for (let i = 0; i < stickCount; i++) {
    const paletteIndex = ((i % nColors) + nColors) % nColors;
    const applyOverrides = !!applyOverrideByStick[i];
    const hex = colors[paletteIndex] ?? '#ffffff';
    const stickDimensions = applyOverrides ? stickDimensionsByPaletteOv[paletteIndex] : stickDimensionsByPaletteBase[paletteIndex];
    const geo = applyOverrides ? geometryByPaletteOv[paletteIndex] : geometryByPaletteBase[paletteIndex];
    const mesh = new THREE.Mesh(geo, getMat(paletteIndex, hex, stickDimensions, applyOverrides));
    (mesh.userData as any).__wmPaletteIndex = paletteIndex;
    (mesh.userData as any).__wmApplyOverrides = applyOverrides;
    mesh.castShadow = useShadows;
    mesh.receiveShadow = useShadows;

    if (i === 0) {
      zCursor = 0;
    } else {
      zCursor += prevDepth * 0.5 + stickDimensions.depth * 0.5 + safeStickGap;
    }
    prevDepth = stickDimensions.depth;

    const offset = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, zCursor);
    mesh.position.set(offset.x, offset.y, offset.z);
    mesh.rotation.z = offset.rotationZ;
    group.add(mesh);

    baseMeshesByPalette[paletteIndex % nColors].push(mesh);
  }

  let outlineGroup: THREE.Group | null = null;
  {
    outlineGroup = new THREE.Group();
    const outlineMats = new Map<string, THREE.MeshBasicMaterial>();

    for (let pi = 0; pi < nColors; pi++) {
      for (const mesh of baseMeshesByPalette[pi] ?? []) {
        const applyOverrides = !!(mesh.userData as any).__wmApplyOverrides;
        const resolved = resolvePaletteConfig(config, pi, { applyOverrides });
        const oc = resolved.facades.outline;
        if (!oc?.enabled) continue;

        const opacity = clamp(Number(oc.opacity) || 1, 0, 1);
        const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
        if (!(thickness > 0) || opacity <= 0) continue;

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

        const o = new THREE.Mesh(mesh.geometry, outlineMat);
        o.position.copy(mesh.position);
        o.rotation.copy(mesh.rotation);
        o.scale.setScalar(1 + thickness);
        o.castShadow = false;
        o.receiveShadow = false;
        outlineGroup.add(o);
      }
    }

    if (outlineGroup.children.length > 0) {
      group.add(outlineGroup);
    } else {
      outlineGroup = null;
    }
  }

  // Center AFTER adding outline so framing accounts for thickness.
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  const finalBounds = new THREE.Box3().setFromObject(group);
  const bubblesConfig = (config as any).bubbles as BubblesConfig | undefined;
  if (bubblesConfig?.enabled && bubblesConfig.mode !== 'cap' && bubblesConfig.wallThickness > 0 && bubblesConfig.interior.enabled) {
    const seedBase = buildBubblesSeed(config.seed, bubblesConfig.seedOffset);
    const bubbles = buildBubbles(bubblesConfig, new THREE.Vector3(1, 1, 1), seedBase, { maxBubbles: 48, bounds: finalBounds });
    const hasBounds = !finalBounds.isEmpty();
    if (bubbles.length > 0 && hasBounds) {
      const radiusMax = Math.max(0, Number(bubblesConfig.radiusMax) || 0);
      const expanded = finalBounds.clone().expandByScalar(radiusMax + 0.15);
      const filtered = bubbles.filter((b) => expanded.containsPoint(b.center));
      if (filtered.length > 0) {
        const walls = buildBubblesInteriorWalls({
          bubbles: filtered,
          palette: colors,
          wallThickness: bubblesConfig.wallThickness,
          softness: bubblesConfig.softness,
          maxMeshes: 20,
          tintStrength: 0.35,
          opacity: 0.92
        });
        if (walls) group.add(walls);
      }
    }
  }

  scene.add(group);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: options?.preserveDrawingBuffer ?? true,
    canvas: options?.canvas
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const tm = rendering?.toneMapping === 'none' ? 'none' : 'aces';
  renderer.toneMapping = tm === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = Number.isFinite(Number(rendering?.exposure)) ? Number(rendering?.exposure) : 1.0;
  (renderer as any).physicallyCorrectLights = true;

  renderer.setClearColor(new THREE.Color(backgroundColor), 1);
  renderer.setSize(width, height);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const pr = Number.isFinite(Number(options?.pixelRatio)) ? Number(options?.pixelRatio) : Math.min(dpr, 2);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = useShadows;
  renderer.shadowMap.type = shadows?.type === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;

  let envDisposable: { dispose: () => void } | null = null;
  if (environment?.enabled) {
    const style: EnvironmentStyle =
      environment.style === 'overcast' || environment.style === 'sunset' ? environment.style : 'studio';
    const rot = Number(environment.rotation) || 0;
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

  // Palette-group collision masking (3D): build per-group depth textures and apply shader discard/finish.
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

    const marginPx = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
    const featherPx = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;
    const softEdge = config.collisions.carve.edge === 'soft' && featherPx > 0;

    const finishEnabled = config.collisions.carve.finish === 'wallsCap' ? 1 : 0;
    const finishDepthPx = (marginPx + featherPx) * Math.max(0, Number(config.collisions.carve.finishAutoDepthMult) || 0);

    // Popsicle has no explicit weights; use palette index as priority.
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

    const patched = new WeakSet<THREE.Material>();
    const patchMaterial = (mat: THREE.Material, pi: number) => {
      if (patched.has(mat)) return;
      patched.add(mat);

      if (softEdge) {
        mat.transparent = true;
        mat.depthWrite = false;
      }

      const idxs = otherIndicesByPalette[pi] ?? [];
      const otherDepth = idxs.map((j) => depthRTs[j].depthTexture);

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
        `collide-v1:${config.collisions.carve.direction}:${config.collisions.carve.edge}:${marginPx.toFixed(2)}:${featherPx.toFixed(2)}:${finishEnabled}:${finishDepthPx.toFixed(2)}:${otherDepth.length}`
      );
    };

    for (let pi = 0; pi < nColors; pi++) {
      for (const mesh of baseMeshesByPalette[pi] ?? []) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) patchMaterial(m, pi);
      }
    }

    const baseMeshes = baseMeshesByPalette.flat();
    (scene.userData as any).__wmBeforeRender = (r: THREE.WebGLRenderer, s: THREE.Scene, cam: THREE.Camera) => {
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

        for (const mesh of baseMeshes) {
          const pi = Number((mesh.userData as any).__wmPaletteIndex ?? 0) % nColors;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const sh = (m.userData as any).__wmCollisionShader;
            if (!sh) continue;
            const idxs = otherIndicesByPalette[pi] ?? [];
            sh.uniforms.wmOtherDepthCount.value = idxs.length;
            sh.uniforms.wmOtherDepth0.value = (depthRTs[idxs[0]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth1.value = (depthRTs[idxs[1]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth2.value = (depthRTs[idxs[2]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth3.value = (depthRTs[idxs[3]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth4.value = (depthRTs[idxs[4]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth5.value = (depthRTs[idxs[5]]?.depthTexture as any) ?? dummy;
            sh.uniforms.wmOtherDepth6.value = (depthRTs[idxs[6]]?.depthTexture as any) ?? dummy;
          }
        }
      }

      for (const mesh of baseMeshes) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sh = (m.userData as any).__wmCollisionShader;
          if (sh?.uniforms?.wmCollideRes) sh.uniforms.wmCollideRes.value.set(nextScreenW, nextScreenH);
        }
      }
      screenW = nextScreenW;
      screenH = nextScreenH;

      const prevTarget = r.getRenderTarget();
      const prevOverride = (s as any).overrideMaterial;
      const clearCol = r.getClearColor(new THREE.Color());
      const clearA = r.getClearAlpha();
      const vis = baseMeshes.map((m) => m.visible);
      const outlineVis = outlineGroup ? outlineGroup.visible : true;

      r.setClearColor(0x000000, 0);
      (s as any).overrideMaterial = depthMat;
      if (outlineGroup) outlineGroup.visible = false;

      for (let pi = 0; pi < nColors; pi++) {
        for (let i = 0; i < baseMeshes.length; i++) baseMeshes[i].visible = false;
        for (const mesh of baseMeshesByPalette[pi] ?? []) mesh.visible = true;
        r.setRenderTarget(depthRTs[pi]);
        r.clear(true, true, false);
        r.render(s, cam);
      }

      (s as any).overrideMaterial = prevOverride;
      if (outlineGroup) outlineGroup.visible = outlineVis;
      for (let i = 0; i < baseMeshes.length; i++) baseMeshes[i].visible = vis[i];
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

  // No shadow catcher: keep shadows stick-to-stick only.
  void envDisposable;

  // Auto-fit camera to prevent cropped renders.
  try {
    scene.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(group);
    const padding = config.bloom?.enabled ? 0.86 : 0.92;
    autoFitOrthographicCameraToBox(camera, bounds, { padding, minNear: 0.001, pushBackIfSlicing: true });
  } catch {
    // Ignore auto-fit failures.
  }

  return { scene, camera, renderer };
}

export function renderPopsicleToCanvas(config: PopsicleConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { scene, camera, renderer } = createPopsicleScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderWithOptionalBloom({
    renderer,
    scene,
    camera,
    width: config.width,
    height: config.height,
    bloom: config.bloom
  });
  (scene.userData as any).__wmDisposeCollisionMasking?.();
  (scene.userData as any).__wmDisposeProceduralEnvironment?.();
  delete (scene.userData as any).__wmDisposeProceduralEnvironment;
  return renderer.domElement;
}
