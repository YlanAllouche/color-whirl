import * as THREE from 'three';
import type { WallpaperConfig, EnvironmentStyle } from '../types.js';
import { createStickMaterial } from '../materials.js';

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
  config: WallpaperConfig,
  options?: { canvas?: HTMLCanvasElement; preserveDrawingBuffer?: boolean; pixelRatio?: number }
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
  const materialCache = new Map<string, THREE.Material>();
  const getMat = (hex: string) => {
    const key = [texture, hex, envIntensity.toFixed(3), safeStickOpacity.toFixed(3), String(config.seed)].join(':');
    const existing = materialCache.get(key);
    if (existing) return existing;
    const m = createStickMaterial({
      texture,
      color: hex,
      envIntensity,
      stickOpacity: safeStickOpacity,
      seed: config.seed,
      textureParams: config.textureParams
    });
    materialCache.set(key, m);
    return m;
  };

  for (let i = 0; i < stickCount; i++) {
    const hex = colors[i % colors.length];
    const mesh = new THREE.Mesh(geo, getMat(hex));
    mesh.castShadow = useShadows;
    mesh.receiveShadow = useShadows;

    const offset = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap);
    mesh.position.set(offset.x, offset.y, offset.z);
    mesh.rotation.z = offset.rotationZ;
    group.add(mesh);
  }

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
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
  } else {
    scene.environment = null;
  }

  // No shadow catcher: keep shadows stick-to-stick only.
  void envDisposable;
  
  return { scene, camera, renderer };
}

export function renderPopsicleToCanvas(
  config: WallpaperConfig,
  canvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const { scene, camera, renderer } = createPopsicleScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
  renderer.render(scene, camera);
  return renderer.domElement;
}
