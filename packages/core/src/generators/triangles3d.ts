import * as THREE from 'three';
import type { Triangles3DConfig, EnvironmentStyle, PaletteAssignMode } from '../types.js';
import { createSurfaceMaterial } from '../materials.js';
import { createRng } from '../types.js';
import { renderWithOptionalBloom } from './postprocessing.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
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
  return wNorm.length - 1;
}

function pickIndex(mode: PaletteAssignMode, i: number, rng: () => number, w: number[], n: number): number {
  if (mode === 'cycle') return i % n;
  return sampleWeightedIndex01(rng(), w);
}

export function createTriangles3DScene(
  config: Triangles3DConfig,
  options?: { canvas?: HTMLCanvasElement; preserveDrawingBuffer?: boolean; pixelRatio?: number }
): { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer } {
  const scene = new THREE.Scene();
  scene.background = null;

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
  } else {
    scene.environment = null;
  }

  const envIntensity = config.environment.enabled ? Number(config.environment.intensity) || 0 : 0;
  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const nColors = colors.length;
  const rng = createRng(config.seed);
  const w = normalizeWeights(config.prisms.colorWeights, nColors);

  const count = Math.max(0, Math.round(config.prisms.count));
  const spread = Math.max(0, Number(config.prisms.spread) || 0);
  const jitter = clamp01(Number(config.prisms.jitter) || 0);
  const opacity = clamp(Number(config.prisms.opacity) || 1, 0, 1);

  const radius = Math.max(0.0001, Number(config.prisms.radius) || 0.2);
  const height = Math.max(0.0001, Number(config.prisms.height) || 0.5);

  const geometry = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false);
  geometry.rotateY(Math.PI / 6);
  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  // one instanced mesh per palette color
  const perColor: Array<{ inst: THREE.InstancedMesh; count: number }> = [];
  for (let pi = 0; pi < nColors; pi++) {
    const mat = createSurfaceMaterial(config, pi, colors[pi], envIntensity, opacity);
    const inst = new THREE.InstancedMesh(geometry, mat, count);
    inst.castShadow = useShadows;
    inst.receiveShadow = useShadows;
    perColor.push({ inst, count: 0 });
    scene.add(inst);
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
      z = (rng() - 0.5) * height * 0.5;
    } else {
      x = (rng() - 0.5) * 2 * spread;
      y = (rng() - 0.5) * 2 * spread;
      z = mode === 'stackedPrisms' ? (rng() - 0.5) * (spread * 0.7) : (rng() - 0.5) * height;
    }

    x += (rng() - 0.5) * jitter * radius * 2;
    y += (rng() - 0.5) * jitter * radius * 2;
    z += (rng() - 0.5) * jitter * radius;

    const rot = rng() * Math.PI * 2;
    tmpPos.set(x, y, z);
    tmpQuat.setFromEuler(new THREE.Euler(0, rot, 0));
    tmpScale.set(radius, height, radius);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    perColor[pi].inst.setMatrixAt(slot, tmpMat);
  }
  for (let pi = 0; pi < nColors; pi++) perColor[pi].inst.instanceMatrix.needsUpdate = true;

  // Outline is supported, but is an extra pass (raster-only).
  if (config.edges.outline.enabled) {
    const outlineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(config.edges.outline.color),
      side: THREE.BackSide,
      transparent: config.edges.outline.opacity < 1,
      opacity: clamp(Number(config.edges.outline.opacity) || 1, 0, 1),
      depthWrite: false
    });
    const thickness = Math.max(0, Math.min(0.2, Number(config.edges.outline.thickness) || 0));
    for (let pi = 0; pi < nColors; pi++) {
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
      scene.add(outInst);
    }
  }

  // Center (after outline)
  const box = new THREE.Box3().setFromObject(scene);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }

  void envDisposable;
  return { scene, camera, renderer };
}

export function renderTriangles3DToCanvas(config: Triangles3DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { scene, camera, renderer } = createTriangles3DScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderWithOptionalBloom({ renderer, scene, camera, width: config.width, height: config.height, bloom: config.bloom });
  return renderer.domElement;
}
