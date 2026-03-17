import * as THREE from 'three';
import type { EdgesConfig, RimLightConfig, EdgeWearConfig, TextureParams, TextureType, GlassStyle, WallpaperConfig } from './types.js';
import { createRng } from './types.js';

type DrywallMaps = { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture };

const drywallCache = new Map<string, DrywallMaps>();
const toonGradientCache = new Map<string, THREE.DataTexture>();

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getToonGradientMap(bands: number): THREE.DataTexture {
  const b = Math.max(2, Math.min(16, Math.round(bands)));
  const key = String(b);
  const existing = toonGradientCache.get(key);
  if (existing) return existing;

  // 1D gradient map: repeated band steps.
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const stepped = Math.floor(t * b) / Math.max(1, b - 1);
    const v = Math.round(clamp(stepped, 0, 1) * 255);
    const i = x * 4;
    data[i + 0] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  toonGradientCache.set(key, tex);
  return tex;
}

function createDrywallMaps(seed: number, grainAmount: number): DrywallMaps {
  const amt = clamp(grainAmount, 0, 1);
  const key = `${seed >>> 0}:${amt.toFixed(3)}`;
  const existing = drywallCache.get(key);
  if (existing) return existing;

  const rng = createRng((seed ^ 0xA3C59AC3) >>> 0);

  const size = 256;
  const gridSize = 64;
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const smoothstep = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const sampleGrid = (u: number, v: number): number => {
    const x = u * gridSize;
    const y = v * gridSize;
    const x0 = Math.floor(x) % gridSize;
    const y0 = Math.floor(y) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;
    const tx = smoothstep(x - Math.floor(x));
    const ty = smoothstep(y - Math.floor(y));
    const g00 = grid[y0 * gridSize + x0];
    const g10 = grid[y0 * gridSize + x1];
    const g01 = grid[y1 * gridSize + x0];
    const g11 = grid[y1 * gridSize + x1];
    return lerp(lerp(g00, g10, tx), lerp(g01, g11, tx), ty);
  };

  const heightAt = (u: number, v: number): number => {
    // Orange-peel-ish: a couple low/mid octaves plus a small high-frequency grit.
    let h = 0;
    let amp = 1;
    let freq = 1;
    for (let o = 0; o < 4; o++) {
      h += amp * sampleGrid(u * freq, v * freq);
      amp *= 0.55;
      freq *= 2.05;
    }
    const grit = sampleGrid(u * 10.0, v * 10.0);
    h = h * 0.82 + grit * 0.18;
    return h;
  };

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      height[y * size + x] = heightAt(u, v);
    }
  }

  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const strength = 0.65 + amt * 2.35;

  const idx = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height[idx(x - 1, y)];
      const hR = height[idx(x + 1, y)];
      const hD = height[idx(x, y - 1)];
      const hU = height[idx(x, y + 1)];

      const dx = (hR - hL) * 0.5;
      const dy = (hU - hD) * 0.5;

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      const i = (y * size + x) * 4;
      normalData[i + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[i + 3] = 255;

      const h = height[y * size + x];
      const r = clamp(0.35 + (0.55 + amt * 0.35) * h, 0, 1);
      const rv = Math.round(r * 255);
      roughData[i + 0] = rv;
      roughData[i + 1] = rv;
      roughData[i + 2] = rv;
      roughData[i + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.needsUpdate = true;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.needsUpdate = true;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const maps: DrywallMaps = { normalMap, roughnessMap };
  drywallCache.set(key, maps);
  return maps;
}

function applyHalftone(material: THREE.Material): void {
  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Halftone overlay\nfloat ht = 0.0;\nvec2 p = gl_FragCoord.xy * 0.065;\nfloat a = sin(p.x) * sin(p.y);\nht = smoothstep(0.25, 0.75, a);\ngl_FragColor.rgb *= mix(1.0, 0.86, ht);`
      );
    },
    'halftone-v1'
  );
}

function chainOnBeforeCompile(
  material: THREE.Material,
  fn: (shader: any) => void,
  keyPart: string
): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    (prev as any)?.(shader, renderer);
    fn(shader);
  };

  const prevKey = (material as any).customProgramCacheKey;
  (material as any).customProgramCacheKey = () => {
    const a = typeof prevKey === 'function' ? String(prevKey()) : '';
    return a ? `${a}|${keyPart}` : keyPart;
  };
  material.needsUpdate = true;
}

function applyRimLight(material: THREE.Material, cfg: RimLightConfig): void {
  if (!cfg.enabled) return;
  const rimColor = new THREE.Color(cfg.color);
  const intensity = clamp(cfg.intensity, 0, 5);
  const power = clamp(cfg.power, 0.5, 8);

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.rimColor = { value: rimColor };
      shader.uniforms.rimIntensity = { value: intensity };
      shader.uniforms.rimPower = { value: power };
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Rim light\nvec3 rimN = normalize(normal);\nvec3 rimV = normalize(vViewPosition);\nfloat rimDot = clamp(dot(rimN, rimV), 0.0, 1.0);\nfloat rim = pow(1.0 - rimDot, rimPower) * rimIntensity;\ngl_FragColor.rgb += rimColor * rim;`
      );
    },
    `rim-v1:${rimColor.getHexString()}:${intensity.toFixed(3)}:${power.toFixed(3)}`
  );
}

function applyEdgeWear(material: THREE.Material, cfg: EdgeWearConfig): void {
  if (!cfg.enabled) return;
  const intensity = clamp(cfg.intensity, 0, 1);
  const width = clamp(cfg.width, 0, 1);
  const noise = clamp(cfg.noise, 0, 1);
  const wearColor = new THREE.Color(cfg.colorShift);

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wearColor = { value: wearColor };
      shader.uniforms.wearIntensity = { value: intensity };
      shader.uniforms.wearWidth = { value: width };
      shader.uniforms.wearNoise = { value: noise };

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Edge wear (view-dependent)\nvec3 wearN = normalize(normal);\nvec3 wearV = normalize(vViewPosition);\nfloat wearDot = clamp(dot(wearN, wearV), 0.0, 1.0);\nfloat wearEdge = pow(1.0 - wearDot, 2.0);\nfloat wearMask = smoothstep(1.0 - wearWidth, 1.0, wearEdge) * wearIntensity;\nfloat wearRand = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\nwearMask *= mix(1.0, wearRand, wearNoise);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, wearColor, clamp(wearMask, 0.0, 1.0));`
      );
    },
    `wear-v1:${wearColor.getHexString()}:${intensity.toFixed(3)}:${width.toFixed(3)}:${noise.toFixed(3)}`
  );
}

export type StickMeshMaterial = THREE.Material | THREE.Material[];

function canHaveColor(m: THREE.Material): m is THREE.Material & { color: THREE.Color } {
  return (m as any).color instanceof THREE.Color;
}

function applyEdgeTint(m: THREE.Material, tintColor: string, amount: number): void {
  if (!canHaveColor(m)) return;
  const a = clamp(amount, 0, 1);
  const base = (m as any).color as THREE.Color;
  const next = base.clone().lerp(new THREE.Color(tintColor), a);
  base.copy(next);
}

function applyEdgeMaterialOverrides(m: THREE.Material, cfg: EdgesConfig, envIntensity: number): void {
  if (!cfg.material.enabled) return;
  const anyMat: any = m as any;
  if (typeof anyMat.roughness === 'number') anyMat.roughness = clamp(cfg.material.roughness, 0, 1);
  if (typeof anyMat.metalness === 'number') anyMat.metalness = clamp(cfg.material.metalness, 0, 1);
  if (typeof anyMat.clearcoat === 'number') anyMat.clearcoat = clamp(cfg.material.clearcoat, 0, 1);
  if (typeof anyMat.envMapIntensity === 'number') {
    const mult = clamp(cfg.material.envIntensityMult, 0, 3);
    anyMat.envMapIntensity = envIntensity * mult;
  }
}

export function createStickMeshMaterial(config: WallpaperConfig, color: string, envIntensity: number, stickOpacity: number): StickMeshMaterial {
  const face = createStickMaterial({
    texture: config.texture,
    color,
    envIntensity,
    stickOpacity,
    seed: config.seed,
    textureParams: config.textureParams
  });

  applyRimLight(face, config.edges.rimLight);

  const needsEdgeMat = config.edges.tint.enabled || config.edges.material.enabled || config.edges.wear.enabled;
  if (!needsEdgeMat) return face;

  const edge = face.clone();
  applyRimLight(edge, config.edges.rimLight);
  if (config.edges.tint.enabled) {
    applyEdgeTint(edge, config.edges.tint.color, config.edges.tint.amount);
  }
  applyEdgeMaterialOverrides(edge, config.edges, envIntensity);
  applyEdgeWear(edge, config.edges.wear);

  return [face, edge];
}

export function createStickMaterial(options: {
  texture: TextureType;
  color: string;
  envIntensity: number;
  stickOpacity: number;
  seed: number;
  textureParams: TextureParams;
}): THREE.Material {
  const { texture, color, envIntensity, stickOpacity, seed, textureParams } = options;

  const basePhysical: THREE.MeshPhysicalMaterialParameters = {
    color,
    transparent: stickOpacity < 1,
    opacity: stickOpacity,
    dithering: true
  };

  if (texture === 'cel') {
    const m = new THREE.MeshToonMaterial({
      color,
      transparent: stickOpacity < 1,
      opacity: stickOpacity
    });
    m.gradientMap = getToonGradientMap(textureParams.cel.bands);
    if (textureParams.cel.halftone) applyHalftone(m);
    return m;
  }

  if (texture === 'mirror') {
    return new THREE.MeshPhysicalMaterial({
      ...basePhysical,
      roughness: 0.0,
      metalness: 1.0,
      clearcoat: 0.0,
      reflectivity: 1.0,
      envMapIntensity: envIntensity * 2.0,
      ior: 2.0
    });
  }

  if (texture === 'glass') {
    const style: GlassStyle = textureParams.glass.style;
    const preset =
      style === 'frosted'
        ? { roughness: 0.35, thickness: 1.2, ior: 1.5 }
        : style === 'thick'
          ? { roughness: 0.06, thickness: 3.0, ior: 1.55 }
          : style === 'stylized'
            ? { roughness: 0.14, thickness: 1.8, ior: 1.42 }
            : { roughness: 0.02, thickness: 1.0, ior: 1.5 };

    return new THREE.MeshPhysicalMaterial({
      ...basePhysical,
      transparent: true,
      transmission: 1.0,
      thickness: preset.thickness,
      ior: preset.ior,
      roughness: preset.roughness,
      metalness: 0.0,
      clearcoat: style === 'stylized' ? 0.8 : 0.2,
      clearcoatRoughness: style === 'frosted' ? 0.65 : 0.1,
      envMapIntensity: envIntensity
    });
  }

  if (texture === 'drywall') {
    const amt = clamp(textureParams.drywall.grainAmount, 0, 1);
    const scale = clamp(textureParams.drywall.grainScale, 0.1, 50);
    const maps = createDrywallMaps(seed, amt);
    maps.normalMap.repeat.set(scale, scale);
    maps.roughnessMap.repeat.set(scale, scale);

    return new THREE.MeshPhysicalMaterial({
      ...basePhysical,
      roughness: 0.92,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.15,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0xffffff),
      reflectivity: 0.05,
      envMapIntensity: envIntensity * 0.22,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.15 + amt * 0.75, 0.15 + amt * 0.75),
      roughnessMap: maps.roughnessMap
    });
  }

  switch (texture) {
    case 'glossy':
      return new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        reflectivity: 1.0,
        envMapIntensity: envIntensity,
        ior: 1.5,
        transmission: 0.0,
        thickness: 0.1
      });
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.25,
        metalness: 0.95,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
        envMapIntensity: envIntensity * 1.6,
        ior: 2.0
      });
    case 'matte':
    default:
      return new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.9,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.3,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xffffff),
        reflectivity: 0.2,
        envMapIntensity: envIntensity * 0.35
      });
  }
}
