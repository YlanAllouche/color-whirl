import * as THREE from 'three';
import type { PopsicleConfig, EnvironmentStyle } from '../types.js';
import { createStickMeshMaterial } from '../materials.js';
import { renderWithOptionalBloom } from './postprocessing.js';

interface StickDimensions {
  width: number;
  height: number;
  depth: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getStickDimensions(
  canvasWidth: number,
  canvasHeight: number,
  stickThickness: number,
  stickSize: number,
  stickRatio: number
): StickDimensions {
  const aspect = canvasWidth / canvasHeight;
  
  // Normalize to frustum size (10 units) with aspect ratio correction
  const baseSize = 8; // Use 80% of the 10-unit frustum

  const safeSize = clamp(Number.isFinite(stickSize) ? stickSize : 1.0, 0.01, 100);
  const safeRatio = clamp(Number.isFinite(stickRatio) ? stickRatio : 3.0, 0.05, 100);

  // Start from the historical defaults (expressed as fractions of viewport width/height),
  // then apply ratio while keeping the overall footprint (area) stable.
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

function createRoundedBox(
  width: number,
  height: number,
  depth: number,
  roundness: number,
  bevel: number,
  quality: number
): THREE.BufferGeometry {
  const safeRoundness = Math.max(0, Math.min(1, roundness));
  const safeBevel = Math.max(0, Math.min(1, bevel));
  const q = Math.max(0, Math.min(1, quality));

  const maxRadius = Math.min(width, height) / 2;
  const radius = maxRadius * safeRoundness;

  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  if (radius <= 0) {
    shape.moveTo(x, y);
    shape.lineTo(x + width, y);
    shape.lineTo(x + width, y + height);
    shape.lineTo(x, y + height);
    shape.closePath();
  } else {
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
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

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose()
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cameraZoomFromDistance(distance: number): number {
  // Orthographic cameras don't "zoom" with distance; map distance to zoom instead.
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

function getStackingOffset(
  index: number,
  stickDimensions: StickDimensions,
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number
): { x: number; y: number; z: number; rotationZ: number } {
  // Helix with configurable overhang angle and rotation center offset
  // stickOverhang: degrees each stick rotates from the previous
  const rotationAngle = index * degToRad(stickOverhang);
  
  // Rotation center offset: -100% = far left/bottom, 0% = center, +100% = far right/top
  // We need to apply the rotation around a point other than (0,0)
  const offsetXPercent = rotationCenterOffsetX / 100;
  const offsetYPercent = rotationCenterOffsetY / 100;
  
  // Calculate the rotation pivot point relative to stick center
  // The stick extends from -height/2 to +height/2 in its local Y axis
  const pivotX = offsetXPercent * (stickDimensions.width / 2);
  const pivotY = offsetYPercent * (stickDimensions.height / 2);
  
  // Apply rotation around the pivot point
  // First translate to pivot, rotate, then translate back
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);
  
  // Position offset from rotation around pivot
  const offsetX = pivotX * (1 - cos) + pivotY * sin;
  const offsetY = pivotY * (1 - cos) - pivotX * sin;
  
  return {
    x: offsetX,
    y: offsetY,
    z: index * (stickDimensions.depth + stickGap),
    rotationZ: rotationAngle
  };
}

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
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
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
    directionalLight.position.set(
      lighting.position.x,
      lighting.position.y,
      lighting.position.z
    );
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
  
  const stickDimensions = getStickDimensions(width, height, stickThickness, stickSize, stickRatio);
  const geo = createRoundedBox(
    stickDimensions.width,
    stickDimensions.height,
    stickDimensions.depth,
    stickRoundness,
    stickBevel,
    geometry?.quality ?? 0.6
  );

  const envIntensity = environment?.enabled ? Number(environment.intensity) || 0 : 0;
  const useShadows = !!shadows?.enabled;

  const group = new THREE.Group();
  const materialCache = new Map<string, THREE.Material | THREE.Material[]>();
  const materialParamsKey = JSON.stringify({ t: config.textureParams, f: config.facades, ed: config.edge, em: config.emission });
  const getMat = (paletteIndex: number, hex: string) => {
    const key = [
      texture,
      materialParamsKey,
      String(paletteIndex),
      hex,
      envIntensity.toFixed(3),
      safeStickOpacity.toFixed(3),
      String(config.seed)
    ].join(':');
    const existing = materialCache.get(key);
    if (existing) return existing;
    const m = createStickMeshMaterial(config, paletteIndex, hex, envIntensity, safeStickOpacity, stickDimensions);
    materialCache.set(key, m);
    return m;
  };

  const nColors = Math.max(1, colors.length);
  const baseMeshesByPalette: THREE.Mesh[][] = Array.from({ length: nColors }, () => []);

  for (let i = 0; i < stickCount; i++) {
    const paletteIndex = i % colors.length;
    const hex = colors[paletteIndex];
    const mesh = new THREE.Mesh(geo, getMat(paletteIndex, hex));
    (mesh.userData as any).__wmPaletteIndex = paletteIndex;
    mesh.castShadow = useShadows;
    mesh.receiveShadow = useShadows;

    const offset = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap);
    mesh.position.set(offset.x, offset.y, offset.z);
    mesh.rotation.z = offset.rotationZ;
    group.add(mesh);

    baseMeshesByPalette[paletteIndex % nColors].push(mesh);
  }

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  let outlineGroup: THREE.Group | null = null;
  if (config.facades.outline.enabled) {
    const oc = config.facades.outline;
    const outlineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(oc.color),
      side: THREE.BackSide,
      transparent: oc.opacity < 1,
      opacity: clamp(Number(oc.opacity) || 1, 0, 1),
      depthWrite: false
    });
    const thickness = Math.max(0, Math.min(0.2, Number(oc.thickness) || 0));
    outlineGroup = new THREE.Group();
    for (const child of group.children) {
      if (!(child as any).isMesh) continue;
      const mesh = child as THREE.Mesh;
      const o = new THREE.Mesh(mesh.geometry, outlineMat);
      o.position.copy(mesh.position);
      o.rotation.copy(mesh.rotation);
      o.scale.setScalar(1 + thickness);
      o.castShadow = false;
      o.receiveShadow = false;
      outlineGroup.add(o);
    }
    group.add(outlineGroup);
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
    const style: EnvironmentStyle = environment.style === 'overcast' || environment.style === 'sunset' ? environment.style : 'studio';
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
  
  return { scene, camera, renderer };
}

export function renderPopsicleToCanvas(
  config: PopsicleConfig,
  canvas?: HTMLCanvasElement
): HTMLCanvasElement {
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
