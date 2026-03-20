import * as THREE from 'three';
import type { FacadeSideConfig, GrazingConfig, TextureParams, TextureType, GlassStyle, WallpaperConfig } from './types.js';
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
    const a = typeof prevKey === 'function' ? String(prevKey.call(material)) : '';
    return a ? `${a}|${keyPart}` : keyPart;
  };
  material.needsUpdate = true;
}

function applyGrazing(material: THREE.Material, cfg: GrazingConfig): void {
  if (!cfg.enabled) return;

  const mode = cfg.mode === 'mix' ? 'mix' : 'add';
  const color = new THREE.Color(cfg.color);
  const strength = clamp(cfg.strength, 0, mode === 'add' ? 5 : 1);
  const power = clamp(cfg.power, 0.5, 8);
  const width = clamp(cfg.width, 0, 1);
  const noise = clamp(cfg.noise, 0, 1);

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wmGrazingColor = { value: color };
      shader.uniforms.wmGrazingStrength = { value: strength };
      shader.uniforms.wmGrazingPower = { value: power };
      shader.uniforms.wmGrazingWidth = { value: width };
      shader.uniforms.wmGrazingNoise = { value: noise };
      shader.uniforms.wmGrazingMode = { value: mode === 'add' ? 0 : 1 };

      const uniforms = `
uniform vec3 wmGrazingColor;
uniform float wmGrazingStrength;
uniform float wmGrazingPower;
uniform float wmGrazingWidth;
uniform float wmGrazingNoise;
uniform int wmGrazingMode;
`;

      if (shader.fragmentShader.includes('#include <common>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${uniforms}`);
      } else if (!shader.fragmentShader.includes('uniform vec3 wmGrazingColor')) {
        shader.fragmentShader = uniforms + '\n' + shader.fragmentShader;
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Grazing highlight\nvec3 gN = normalize(normal);\nvec3 gV = normalize(vViewPosition);\n#ifdef ORTHOGRAPHIC_CAMERA\ngV = vec3(0.0, 0.0, 1.0);\n#endif\nfloat gDot = clamp(dot(gN, gV), 0.0, 1.0);\nfloat gEdge = pow(1.0 - gDot, wmGrazingPower);\nfloat gMask = wmGrazingMode == 0 ? gEdge : smoothstep(1.0 - wmGrazingWidth, 1.0, gEdge);\nfloat gRand = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\ngMask *= mix(1.0, gRand, wmGrazingNoise);\nif (wmGrazingMode == 0) {\n  gl_FragColor.rgb += wmGrazingColor * (gMask * wmGrazingStrength);\n} else {\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmGrazingColor, clamp(gMask * wmGrazingStrength, 0.0, 1.0));\n}`
      );
    },
    `grazing-v1:${mode}:${color.getHexString()}:${strength.toFixed(3)}:${power.toFixed(3)}:${width.toFixed(3)}:${noise.toFixed(3)}`
  );
}

export type StickMeshMaterial = THREE.Material | THREE.Material[];

function canHaveColor(m: THREE.Material): m is THREE.Material & { color: THREE.Color } {
  return (m as any).color instanceof THREE.Color;
}

function applySideTint(m: THREE.Material, tintColor: string, amount: number): void {
  if (!canHaveColor(m)) return;
  const a = clamp(amount, 0, 1);
  const base = (m as any).color as THREE.Color;
  const next = base.clone().lerp(new THREE.Color(tintColor), a);
  base.copy(next);
}

function applySideMaterialOverrides(m: THREE.Material, cfg: FacadeSideConfig, envIntensity: number): void {
  if (!cfg.enabled) return;
  const anyMat: any = m as any;
  const t = clamp(cfg.materialAmount, 0, 1);
  if (!(t > 0)) return;

  const lerp = (a: number, b: number, tt: number) => a + (b - a) * tt;
  if (typeof anyMat.roughness === 'number') {
    const target = clamp(cfg.roughness, 0, 1);
    anyMat.roughness = lerp(anyMat.roughness, target, t);
  }
  if (typeof anyMat.metalness === 'number') {
    const target = clamp(cfg.metalness, 0, 1);
    anyMat.metalness = lerp(anyMat.metalness, target, t);
  }
  if (typeof anyMat.clearcoat === 'number') {
    const target = clamp(cfg.clearcoat, 0, 1);
    anyMat.clearcoat = lerp(anyMat.clearcoat, target, t);
  }
  if (typeof anyMat.envMapIntensity === 'number') {
    const mult = clamp(cfg.envIntensityMult, 0, 3);
    const target = envIntensity * mult;
    anyMat.envMapIntensity = lerp(anyMat.envMapIntensity, target, t);
  }
}

export function createStickMeshMaterial(
  config: WallpaperConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  stickOpacity: number,
  stickDimensions?: { width: number; height: number; depth: number }
): StickMeshMaterial {
  const emit =
    config.emission.enabled &&
    Math.round(config.emission.paletteIndex) === Math.round(paletteIndex) &&
    Number.isFinite(Number(config.emission.intensity)) &&
    Number(config.emission.intensity) > 0;
  const emissive = emit
    ? { enabled: true, intensity: Number(config.emission.intensity), color }
    : { enabled: false, intensity: 0, color };

  const face = createStickMaterial({
    texture: config.texture,
    color,
    envIntensity,
    stickOpacity,
    seed: config.seed,
    textureParams: config.textureParams,
    emissive
  });

  const applyEdgeFx = (m: THREE.Material, surfaceKind: 'cap' | 'side') => {
    const seam = config.edge?.seam;
    const band = config.edge?.band;
    if (!seam?.enabled && !band?.enabled) return;
    if (!stickDimensions) return;

    const halfW = Math.max(1e-6, stickDimensions.width / 2);
    const halfH = Math.max(1e-6, stickDimensions.height / 2);
    const halfD = Math.max(1e-6, stickDimensions.depth / 2);
    const minHalf = Math.max(1e-6, Math.min(halfW, halfH, halfD));

    const stickRoundness = clamp(Number((config as any).stickRoundness) || 0, 0, 1);
    const corner = Math.max(0, Math.min(Math.min(halfW, halfH), Math.min(halfW, halfH) * stickRoundness));
    const profileRaw = String((config as any).stickEndProfile ?? 'rounded');
    const profile = profileRaw === 'chamfer' ? 1 : profileRaw === 'chipped' ? 2 : 0;

    const seamWidth = clamp(Number(seam?.width) || 0, 0, 0.25) * minHalf;
    const seamOpacity = clamp(Number(seam?.opacity) || 0, 0, 1);
    const seamNoise = clamp(Number(seam?.noise) || 0, 0, 1);
    const seamEm = clamp(Number(seam?.emissiveIntensity) || 0, 0, 20);
    const seamColor = new THREE.Color(typeof seam?.color === 'string' ? seam.color : '#0b0b10');

    const bandWidth = clamp(Number(band?.width) || 0, 0, 0.6) * minHalf;
    const bandOpacity = clamp(Number(band?.opacity) || 0, 0, 1);
    const bandNoise = clamp(Number(band?.noise) || 0, 0, 1);
    const bandEm = clamp(Number(band?.emissiveIntensity) || 0, 0, 20);
    const bandColor = new THREE.Color(typeof band?.color === 'string' ? band.color : '#ffffff');

    const key =
      `edgefx-v2:${surfaceKind}:${profile}:${corner.toFixed(4)}:${halfW.toFixed(4)}:${halfH.toFixed(4)}:${halfD.toFixed(4)}:` +
      `${seam?.enabled ? 1 : 0}:${seamColor.getHexString()}:${seamOpacity.toFixed(3)}:${seamWidth.toFixed(4)}:${seamNoise.toFixed(3)}:${seamEm.toFixed(3)}:` +
      `${band?.enabled ? 1 : 0}:${bandColor.getHexString()}:${bandOpacity.toFixed(3)}:${bandWidth.toFixed(4)}:${bandNoise.toFixed(3)}:${bandEm.toFixed(3)}`;

    chainOnBeforeCompile(
      m,
      (shader) => {
        shader.uniforms.wmEdgeHalfSize = { value: new THREE.Vector3(halfW, halfH, halfD) };
        shader.uniforms.wmEdgeSurfaceKind = { value: surfaceKind === 'cap' ? 0 : 1 };
        shader.uniforms.wmStickHalfXY = { value: new THREE.Vector2(halfW, halfH) };
        shader.uniforms.wmStickCorner = { value: corner };
        shader.uniforms.wmStickProfile = { value: profile };

        shader.uniforms.wmEdgeSeamEnabled = { value: seam?.enabled ? 1 : 0 };
        shader.uniforms.wmEdgeSeamColor = { value: seamColor };
        shader.uniforms.wmEdgeSeamOpacity = { value: seamOpacity };
        shader.uniforms.wmEdgeSeamWidth = { value: seamWidth };
        shader.uniforms.wmEdgeSeamNoise = { value: seamNoise };
        shader.uniforms.wmEdgeSeamEmissive = { value: seamEm };

        shader.uniforms.wmEdgeBandEnabled = { value: band?.enabled ? 1 : 0 };
        shader.uniforms.wmEdgeBandColor = { value: bandColor };
        shader.uniforms.wmEdgeBandOpacity = { value: bandOpacity };
        shader.uniforms.wmEdgeBandWidth = { value: bandWidth };
        shader.uniforms.wmEdgeBandNoise = { value: bandNoise };
        shader.uniforms.wmEdgeBandEmissive = { value: bandEm };

        const vtx = `\nvarying vec3 wmObjPos;\n`;
        if (shader.vertexShader.includes('#include <common>')) {
          shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${vtx}`);
        } else if (!shader.vertexShader.includes('varying vec3 wmObjPos')) {
          shader.vertexShader = vtx + shader.vertexShader;
        }

        if (shader.vertexShader.includes('#include <begin_vertex>')) {
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nwmObjPos = position;`);
        }

        const fragUniforms = `
uniform vec3 wmEdgeHalfSize;
uniform int wmEdgeSurfaceKind;
uniform vec2 wmStickHalfXY;
uniform float wmStickCorner;
uniform int wmStickProfile;
uniform int wmEdgeSeamEnabled;
uniform vec3 wmEdgeSeamColor;
uniform float wmEdgeSeamOpacity;
uniform float wmEdgeSeamWidth;
uniform float wmEdgeSeamNoise;
uniform float wmEdgeSeamEmissive;
uniform int wmEdgeBandEnabled;
uniform vec3 wmEdgeBandColor;
uniform float wmEdgeBandOpacity;
uniform float wmEdgeBandWidth;
uniform float wmEdgeBandNoise;
uniform float wmEdgeBandEmissive;
varying vec3 wmObjPos;
`;

        if (shader.fragmentShader.includes('#include <common>')) {
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fragUniforms}`);
        } else if (!shader.fragmentShader.includes('uniform vec3 wmEdgeHalfSize')) {
          shader.fragmentShader = fragUniforms + '\n' + shader.fragmentShader;
        }

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>\n\n// Edge effects (cap perimeter + side seams)\nvec3 aPos3 = abs(wmObjPos);\nvec2 aXY = abs(wmObjPos.xy);\nfloat dzEdge = max(0.0, wmEdgeHalfSize.z - aPos3.z);\nfloat n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n\nfloat capMargin = 0.0;\n{\n  float hx = wmStickHalfXY.x;\n  float hy = wmStickHalfXY.y;\n  float c = clamp(wmStickCorner, 0.0, min(hx, hy));\n  if (wmStickProfile == 0) {\n    vec2 q = aXY - (vec2(hx, hy) - vec2(c));\n    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - c;\n    capMargin = max(0.0, -sd);\n  } else {\n    float m1 = hx - aXY.x;\n    float m2 = hy - aXY.y;\n    float m3 = ((hx + hy - c) - (aXY.x + aXY.y)) * 0.70710678;\n    capMargin = max(0.0, min(m1, min(m2, m3)));\n  }\n}\n\nfloat base = wmEdgeSurfaceKind == 0 ? capMargin : dzEdge;\n\nif (wmEdgeBandEnabled == 1 && wmEdgeBandWidth > 0.0) {\n  float bm = 1.0 - smoothstep(wmEdgeBandWidth, wmEdgeBandWidth * 2.0, base);\n  bm *= mix(1.0, n, wmEdgeBandNoise);\n  float bAmt = clamp(bm * wmEdgeBandOpacity, 0.0, 1.0);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmEdgeBandColor, bAmt);\n  gl_FragColor.rgb += wmEdgeBandColor * (bm * wmEdgeBandEmissive);\n}\nif (wmEdgeSeamEnabled == 1 && wmEdgeSeamWidth > 0.0) {\n  float sm = 1.0 - smoothstep(wmEdgeSeamWidth, wmEdgeSeamWidth * 2.0, base);\n  sm *= mix(1.0, n, wmEdgeSeamNoise);\n  float sAmt = clamp(sm * wmEdgeSeamOpacity, 0.0, 1.0);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmEdgeSeamColor, sAmt);\n  gl_FragColor.rgb += wmEdgeSeamColor * (sm * wmEdgeSeamEmissive);\n}`
        );
      },
      key
    );
  };

  const grazing = config.facades?.grazing;
  if (grazing?.enabled && grazing.mode !== 'mix') {
    applyGrazing(face, grazing);
  }

  const sideCfg = config.facades?.side;
  const needsSideOverrides =
    !!sideCfg?.enabled && (clamp(Number(sideCfg.tintAmount) || 0, 0, 1) > 0 || clamp(Number(sideCfg.materialAmount) || 0, 0, 1) > 0);

  const wantsHollow = !!config.edge?.hollow;
  const edgeEnabled = !!config.edge?.seam?.enabled || !!config.edge?.band?.enabled;
  const needsSplitMaterial = wantsHollow || needsSideOverrides || (grazing?.enabled && grazing.mode === 'mix') || edgeEnabled;

  if (!needsSplitMaterial) {
    applyEdgeFx(face, 'cap');
    return face;
  }

  const side = face.clone();
  if (grazing?.enabled && grazing.mode === 'mix') {
    applyGrazing(side, grazing);
  }

  if (sideCfg?.enabled) {
    applySideTint(side, sideCfg.tintColor, sideCfg.tintAmount);
    applySideMaterialOverrides(side, sideCfg, envIntensity);
  }

  if (wantsHollow) {
    const anySide: any = side as any;
    if (typeof anySide.side === 'number') {
      anySide.side = THREE.DoubleSide;
      side.needsUpdate = true;
    }
  }

  const cap = wantsHollow
    ? (() => {
        const m = face.clone();
        const anyMat: any = m as any;
        anyMat.transparent = true;
        anyMat.opacity = 0;
        anyMat.depthWrite = false;
        if (typeof anyMat.colorWrite === 'boolean') anyMat.colorWrite = false;
        return m;
      })()
    : face;

  // Apply edge effects late so they exist on both cap and side materials.
  // (Material.clone() does not reliably preserve onBeforeCompile/customProgramCacheKey across runtimes.)
  applyEdgeFx(cap, 'cap');
  applyEdgeFx(side, 'side');

  return [cap, side];
}

export function createSurfaceMaterial(
  config: WallpaperConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  opacity: number
): THREE.Material {
  const emit =
    config.emission.enabled &&
    Math.round(config.emission.paletteIndex) === Math.round(paletteIndex) &&
    Number.isFinite(Number(config.emission.intensity)) &&
    Number(config.emission.intensity) > 0;
  const emissive = emit
    ? { enabled: true, intensity: Number(config.emission.intensity), color }
    : { enabled: false, intensity: 0, color };

  const m = createStickMaterial({
    texture: config.texture,
    color,
    envIntensity,
    stickOpacity: Math.max(0, Math.min(1, opacity)),
    seed: config.seed,
    textureParams: config.textureParams,
    emissive
  });
  if (config.facades?.grazing?.enabled) applyGrazing(m, config.facades.grazing);
  return m;
}

export function createStickMaterial(options: {
  texture: TextureType;
  color: string;
  envIntensity: number;
  stickOpacity: number;
  seed: number;
  textureParams: TextureParams;
  emissive?: { enabled: boolean; intensity: number; color: string };
}): THREE.Material {
  const { texture, color, envIntensity, stickOpacity, seed, textureParams, emissive } = options;

  const withEmission = (m: THREE.Material): THREE.Material => {
    if (!emissive?.enabled) return m;
    const anyMat: any = m as any;
    if (anyMat.emissive instanceof THREE.Color) {
      anyMat.emissive.set(emissive.color);
    } else if ('emissive' in anyMat) {
      anyMat.emissive = new THREE.Color(emissive.color);
    }
    if (typeof anyMat.emissiveIntensity === 'number') {
      anyMat.emissiveIntensity = Math.max(0, Number(emissive.intensity) || 0);
    }
    return m;
  };

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
    return withEmission(m);
  }

  if (texture === 'mirror') {
    return withEmission(
      new THREE.MeshPhysicalMaterial({
      ...basePhysical,
      roughness: 0.0,
      metalness: 1.0,
      clearcoat: 0.0,
      reflectivity: 1.0,
      envMapIntensity: envIntensity * 2.0,
      ior: 2.0
      })
    );
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

    return withEmission(
      new THREE.MeshPhysicalMaterial({
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
      })
    );
  }

  if (texture === 'drywall') {
    const amt = clamp(textureParams.drywall.grainAmount, 0, 1);
    const scale = clamp(textureParams.drywall.grainScale, 0.1, 50);
    const maps = createDrywallMaps(seed, amt);
    maps.normalMap.repeat.set(scale, scale);
    maps.roughnessMap.repeat.set(scale, scale);

    return withEmission(
      new THREE.MeshPhysicalMaterial({
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
      })
    );
  }

  switch (texture) {
    case 'glossy':
      return withEmission(
        new THREE.MeshPhysicalMaterial({
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
        })
      );
    case 'metallic':
      return withEmission(
        new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.25,
        metalness: 0.95,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
        envMapIntensity: envIntensity * 1.6,
        ior: 2.0
        })
      );
    case 'matte':
    default:
      return withEmission(
        new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.9,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.3,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xffffff),
        reflectivity: 0.2,
        envMapIntensity: envIntensity * 0.35
        })
      );
  }
}
