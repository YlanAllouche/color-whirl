import type {
  Bands2DMode,
  BaseWallpaperConfig,
  GrazingMode,
  PopsicleConfig,
  Spheres3DShapeConfig,
  SvgColorMode,
  TextureType,
  VoronoiKind,
  VoronoiMaterialKind,
  VoronoiMaterialMode,
  WallpaperConfig,
  WallpaperType
} from './types.js';

import {
  DEFAULT_CIRCLES2D_CONFIG,
  DEFAULT_CONFIG_BY_TYPE,
  DEFAULT_POPSICLE_CONFIG,
  DEFAULT_POLYGON2D_CONFIG,
  DEFAULT_RIDGES2D_CONFIG,
  DEFAULT_SPHERES3D_CONFIG,
  DEFAULT_SVG2D_CONFIG,
  DEFAULT_SVG3D_CONFIG,
  DEFAULT_SVG_SOURCE,
  DEFAULT_TRIANGLES3D_CONFIG
} from './defaults.js';

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: any, patch: any): any {
  if (Array.isArray(base)) {
    return Array.isArray(patch) ? patch.slice() : base.slice();
  }

  if (isPlainObject(base)) {
    const out: Record<string, any> = {};
    const patchObj = isPlainObject(patch) ? patch : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(patchObj)]);
    for (const key of keys) {
      out[key] = deepMerge(base[key], patchObj[key]);
    }
    return out;
  }

  return patch == null ? base : patch;
}

/** Generate a random value using a weighted normal distribution. */
export type RNG = () => number;

export function createRng(seed: number): RNG {
  // mulberry32
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample a triangular distribution over [min, max] with a peak at `mode`.
 * This is a simple "biased random" sampler where `mode` acts as the normal value.
 */
export function randomTriangular(rng: RNG, min: number, mode: number, max: number): number {
  const a = Number(min);
  const b = Number(max);
  const c = clamp(Number(mode), Math.min(a, b), Math.max(a, b));

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || a === b) return a;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const m = clamp(c, lo, hi);
  const u = clamp(rng(), 0, 1);
  const fc = (m - lo) / (hi - lo);
  if (u < fc) {
    return lo + Math.sqrt(u * (hi - lo) * (m - lo));
  }
  return hi - Math.sqrt((1 - u) * (hi - lo) * (hi - m));
}

// Back-compat alias (historical name)
export function randomWeighted(rng: RNG, min: number, max: number, normal: number): number {
  return randomTriangular(rng, min, normal, max);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hslToHex(h: number, s: number, l: number): string {
  // h: 0-360, s/l: 0-100
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  const toHex = (v: number) => clamp(v, 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface RandomColorTheme {
  colors: string[];
  backgroundColor: string;
}

/**
 * Generate a random (non-preset) but coherent color theme.
 * Produces `count` foreground colors plus a matching background color.
 */
export function generateRandomColorTheme(count: number = 5): RandomColorTheme {
  const seed = Math.floor(Math.random() * 0xffffffff);
  return generateRandomColorThemeFromSeed(seed, count);
}

export function generateRandomColorThemeFromSeed(seed: number, count: number = 5): RandomColorTheme {
  const rng = createRng(seed);

  const baseHue = rng() * 360;
  const scheme = rng();

  // Hue offsets for different harmony schemes.
  let hueOffsets: number[];
  if (scheme < 0.4) {
    // Analogous
    hueOffsets = [-25, -10, 0, 10, 25];
  } else if (scheme < 0.7) {
    // Triadic-ish
    hueOffsets = [0, 120, 240, 30, 150];
  } else if (scheme < 0.9) {
    // Complementary + accents
    hueOffsets = [0, 180, 12, 192, -12];
  } else {
    // Split-complementary
    hueOffsets = [0, 150, 210, 20, 170];
  }

  // Trim/extend to requested count.
  const offsets = Array.from({ length: count }, (_, i) => hueOffsets[i % hueOffsets.length]);

  const saturationBase = randomWeighted(rng, 55, 92, 75);
  const lightnessBase = randomWeighted(rng, 45, 68, 56);

  const colors = offsets.map((off, i) => {
    const h = baseHue + off + randomWeighted(rng, -6, 6, 0);
    const s = saturationBase + randomWeighted(rng, -10, 10, 0);
    // Slight stagger to avoid same-looking swatches.
    const l = lightnessBase + randomWeighted(rng, -10, 10, 0) + (i % 2 === 0 ? 4 : -2);
    return hslToHex(h, s, l);
  });

  // Background: same base hue, low saturation, dark.
  const backgroundColor = hslToHex(
    baseHue + randomWeighted(rng, -10, 10, 0),
    randomWeighted(rng, 8, 22, 14),
    randomWeighted(rng, 6, 14, 10)
  );

  return { colors, backgroundColor };
}

/** Generate a random wallpaper configuration, including colors, without using presets. */
export function generateRandomConfigNoPresets(): WallpaperConfig {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return generateRandomConfigNoPresetsFromSeed(seed, 'popsicle');
}

export function generateRandomConfigNoPresetsFromSeed(seed: number, type: WallpaperType = 'popsicle'): WallpaperConfig {
  const rng = createRng(seed);

  const theme = generateRandomColorThemeFromSeed(seed ^ 0x9e3779b9, 5);

  const textures: TextureType[] = ['glossy', 'matte', 'metallic', 'drywall', 'glass', 'mirror', 'cel'];
  const texture = textures[Math.floor(rng() * textures.length)];

  // Opacity distribution:
  // - Very likely fully opaque (1)
  // - Somewhat likely slightly translucent
  // - Extremely unlikely to be very transparent
  const randomStickOpacity = (): number => {
    const r = rng();
    if (r < 0.9) return 1.0;
    // Mostly imperceptible translucency.
    if (r < 0.995) return clamp(randomWeighted(rng, 0.92, 1.0, 0.992), 0, 1);
    // Rare: noticeable translucency.
    if (r < 0.9995) return clamp(randomWeighted(rng, 0.5, 0.92, 0.85), 0, 1);
    // Extremely rare: quite transparent.
    return clamp(randomWeighted(rng, 0.15, 0.5, 0.35), 0, 1);
  };

  const tri = (min: number, mode: number, max: number): number => randomTriangular(rng, min, mode, max);
  const chance = (p: number): boolean => rng() < clamp(p, 0, 1);

  // Heavily bias toward smaller counts, while keeping large values possible.
  const skewCountLow = (
    min: number,
    normal: number,
    softMax: number,
    hardMax: number,
    tailChance: number = 0.03
  ): number => {
    const t = clamp(tailChance, 0, 1);
    if (rng() >= t) {
      return Math.round(clamp(randomWeighted(rng, min, softMax, normal), min, hardMax));
    }
    const tailMode = clamp(softMax + (hardMax - softMax) * 0.35, softMax, hardMax);
    return Math.round(clamp(randomWeighted(rng, softMax, hardMax, tailMode), min, hardMax));
  };

  const emissionPaletteIndex = Math.floor(rng() * Math.max(1, theme.colors.length));
  const emissionIntensityBase = clamp(tri(0, DEFAULT_POPSICLE_CONFIG.emission.intensity, 14), 0, 20);
  const emissionIntensitySeed = emissionIntensityBase > 0 ? emissionIntensityBase : DEFAULT_POPSICLE_CONFIG.emission.intensity;
  const fallbackGlobalEmission = chance(0.08);
  const bloomEnabled = chance(0.35);

  const is3DType = type === 'popsicle' || type === 'spheres3d' || type === 'triangles3d' || type === 'svg3d';

  // Rare: procedural cavity cutouts (raster-only; best-effort for other renderers).
  const bubblesEnabled = (type === 'popsicle' || type === 'spheres3d') && chance(0.035);

  // Collisions are allowed for 2D types but are disabled for 3D random configs.
  // (3D carve collisions are both expensive and historically problematic.)
  const collisionsMode = !is3DType && chance(0.12) ? 'carve' : 'none';
  const collisionsEdge = chance(0.28) ? 'soft' : 'hard';
  const collisionsFeather =
    collisionsMode === 'carve' && collisionsEdge === 'soft'
      ? Math.round(tri(0, DEFAULT_POPSICLE_CONFIG.collisions.carve.featherPx, 16))
      : 0;

  const base: BaseWallpaperConfig = {
    type,
    seed,
    width: DEFAULT_POPSICLE_CONFIG.width,
    height: DEFAULT_POPSICLE_CONFIG.height,
    colors: [...theme.colors],
    palette: { overrides: [] },
    texture,
    textureParams: {
      drywall: {
        grainAmount: clamp(tri(0.0, DEFAULT_POPSICLE_CONFIG.textureParams.drywall.grainAmount, 1.0), 0, 1),
        grainScale: clamp(tri(0.6, DEFAULT_POPSICLE_CONFIG.textureParams.drywall.grainScale, 6.5), 0.1, 50)
      },
      glass: {
        style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)]
      },
      cel: {
        bands: Math.max(2, Math.min(8, Math.round(tri(2, DEFAULT_POPSICLE_CONFIG.textureParams.cel.bands, 8)))),
        halftone: chance(0.25)
      }
    },
    voronoi: (() => {
      const enabled = is3DType && chance(0.22);
      const textureBias =
        texture === 'mirror'
          ? { roughness: 0.52, normal: 0.42, amount: 0.86, scale: 5.4 }
          : texture === 'metallic'
            ? { roughness: 0.48, normal: 0.38, amount: 0.84, scale: 5.2 }
            : texture === 'glossy'
              ? { roughness: 0.46, normal: 0.36, amount: 0.82, scale: 4.9 }
              : texture === 'glass'
                ? { roughness: 0.34, normal: 0.28, amount: 0.74, scale: 4.4 }
                : {
                    roughness: DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength,
                    normal: DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength,
                    amount: DEFAULT_POPSICLE_CONFIG.voronoi.amount,
                    scale: DEFAULT_POPSICLE_CONFIG.voronoi.scale
                  };
      const kind: VoronoiKind = enabled ? (chance(0.78) ? 'edges' : 'cells') : DEFAULT_POPSICLE_CONFIG.voronoi.kind;
      const materialKind: VoronoiMaterialKind =
        !enabled
          ? DEFAULT_POPSICLE_CONFIG.voronoi.materialKind
          : kind === 'cells'
            ? (chance(0.62) ? 'edges' : chance(0.75) ? 'match' : 'cells')
            : (chance(0.78) ? 'match' : chance(0.85) ? 'edges' : 'cells');

      const crackleEnabled = enabled && (kind === 'edges' || materialKind === 'edges') && chance(0.22);
      const nucleusEnabled = enabled && chance(kind === 'cells' ? 0.65 : 0.25);

      const materialMode: VoronoiMaterialMode =
        !enabled
          ? DEFAULT_POPSICLE_CONFIG.voronoi.materialMode
          : texture === 'glass'
            ? (chance(0.72) ? 'normal' : chance(0.8) ? 'both' : chance(0.9) ? 'roughness' : 'none')
            : texture === 'matte'
              ? (chance(0.7) ? 'roughness' : chance(0.75) ? 'both' : chance(0.9) ? 'normal' : 'none')
              : texture === 'mirror'
                ? (chance(0.66) ? 'normal' : chance(0.72) ? 'both' : chance(0.9) ? 'roughness' : 'none')
                : (() => {
                    const r = rng();
                    if (r < 0.5) return 'both';
                    if (r < 0.82) return 'roughness';
                    if (r < 0.98) return 'normal';
                    return 'none';
                  })();

      return {
        ...DEFAULT_POPSICLE_CONFIG.voronoi,
        enabled,
        space: chance(0.72) ? 'world' : 'object',
        kind,
        scale: clamp(tri(0.8, textureBias.scale, 16), 0.1, 80),
        seedOffset: Math.round(tri(-50, 0, 50)),
        amount: enabled ? clamp(tri(0.18, textureBias.amount, 0.96), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.amount,
        edgeWidth: clamp(tri(0.01, DEFAULT_POPSICLE_CONFIG.voronoi.edgeWidth, 0.48), 0, 1),
        softness: clamp(tri(0.0, DEFAULT_POPSICLE_CONFIG.voronoi.softness, 0.78), 0, 1),
        colorStrength: enabled
          ? clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength, 1.0), 0, 1)
          : DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength,
        colorMode: (['darken', 'lighten', 'tint'] as const)[chance(0.6) ? 0 : Math.floor(rng() * 3)],
        tintColor: '#ffffff',
        materialMode,
        materialKind,
        roughnessStrength: enabled
          ? clamp(tri(0.08, textureBias.roughness, 0.78), 0, 1)
          : DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength,
        normalStrength: enabled
          ? clamp(tri(0.06, textureBias.normal, 0.68), 0, 1)
          : DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength,
        normalScale: clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.normalScale, 0.88), 0, 1),
        crackleAmount: crackleEnabled ? clamp(tri(0.05, 0.28, 0.85), 0, 1) : 0,
        crackleScale: crackleEnabled
          ? clamp(tri(2, DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale, 60), 0, 200)
          : DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale,
        nucleus: {
          ...DEFAULT_POPSICLE_CONFIG.voronoi.nucleus,
          enabled: nucleusEnabled,
          size: nucleusEnabled
            ? clamp(tri(0.03, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size, 0.18), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size,
          softness: nucleusEnabled
            ? clamp(tri(0.05, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness, 0.85), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness,
          strength: nucleusEnabled
            ? clamp(tri(0.25, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength, 1.0), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength,
          color: '#ffffff'
        }
      };
    })(),
    backgroundColor: theme.backgroundColor,
    facades: (() => {
      const tintEnabled = chance(0.18);
      const materialEnabled = chance(0.18);
      const wearEnabled = chance(0.12);
      const rimEnabled = chance(0.25);

      const sideEnabled = tintEnabled || materialEnabled;
      const grazingEnabled = wearEnabled || rimEnabled;
      const grazingMode: GrazingMode =
        rimEnabled && !wearEnabled ? 'add' : wearEnabled && !rimEnabled ? 'mix' : chance(0.5) ? 'add' : 'mix';

      return {
        side: {
          enabled: sideEnabled,
          tintColor: DEFAULT_POPSICLE_CONFIG.facades.side.tintColor,
          tintAmount: tintEnabled ? clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.tintAmount, 0.9), 0, 1) : 0,
          materialAmount: materialEnabled ? 1.0 : 0.0,
          roughness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.roughness, 1), 0, 1),
          metalness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.metalness, 1), 0, 1),
          clearcoat: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.clearcoat, 1), 0, 1),
          envIntensityMult: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.envIntensityMult, 3), 0, 3)
        },
        grazing: {
          enabled: grazingEnabled,
          mode: grazingMode,
          color: DEFAULT_POPSICLE_CONFIG.facades.grazing.color,
          strength:
            grazingMode === 'add'
              ? clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.grazing.strength, 2.5), 0, 5)
              : clamp(tri(0, 0.35, 1), 0, 1),
          power:
            grazingMode === 'add'
              ? clamp(tri(0.5, DEFAULT_POPSICLE_CONFIG.facades.grazing.power, 8), 0.5, 8)
              : clamp(tri(0.5, 2.0, 8), 0.5, 8),
          width: clamp(tri(0, 0.5, 1), 0, 1),
          noise: wearEnabled ? clamp(tri(0, 0.6, 1), 0, 1) : 0
        },
        outline: {
          enabled: chance(0.1),
          color: DEFAULT_POPSICLE_CONFIG.facades.outline.color,
          thickness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.outline.thickness, 0.12), 0, 0.2),
          opacity: clamp(tri(0.2, DEFAULT_POPSICLE_CONFIG.facades.outline.opacity, 1.0), 0, 1)
        }
      };
    })(),
    edge: {
      hollow: false,
      seam: { ...DEFAULT_POPSICLE_CONFIG.edge.seam },
      band: { ...DEFAULT_POPSICLE_CONFIG.edge.band }
    },
    bubbles: {
      enabled: bubblesEnabled,
      // Keep random configs conservative: cap mode is experimental/heavy.
      mode: 'through',
      interior: { enabled: true },
      // frequency controls density; count is the sample budget in shader.
      frequency: bubblesEnabled ? clamp(tri(1.1, 1.8, 3.2), 0.1, 20) : DEFAULT_POPSICLE_CONFIG.bubbles.frequency,
      frequencyVariance: bubblesEnabled ? clamp(tri(0.0, 0.22, 0.4), 0, 1) : DEFAULT_POPSICLE_CONFIG.bubbles.frequencyVariance,
      count: bubblesEnabled ? Math.max(3, Math.min(8, Math.round(tri(4, 6, 8)))) : DEFAULT_POPSICLE_CONFIG.bubbles.count,
      radiusMin: bubblesEnabled ? clamp(tri(0.06, 0.12, 0.22), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.bubbles.radiusMin,
      radiusMax: bubblesEnabled ? clamp(tri(0.18, 0.32, 0.55), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.bubbles.radiusMax,
      softness: bubblesEnabled ? clamp(tri(0.0, 0.05, 0.12), 0.0, 2) : DEFAULT_POPSICLE_CONFIG.bubbles.softness,
      wallThickness: bubblesEnabled ? clamp(tri(0.04, 0.08, 0.2), 0.0, 0.3) : DEFAULT_POPSICLE_CONFIG.bubbles.wallThickness,
      seedOffset: bubblesEnabled ? Math.round(tri(-50, 0, 50)) : DEFAULT_POPSICLE_CONFIG.bubbles.seedOffset
    },
    emission: {
      enabled: fallbackGlobalEmission,
      paletteIndex: emissionPaletteIndex,
      intensity: emissionIntensityBase
    },
    bloom: {
      enabled: bloomEnabled,
      strength: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.bloom.strength, 2.5), 0, 10),
      radius: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.bloom.radius, 1.2), 0, 10),
      threshold: clamp(tri(0.5, DEFAULT_POPSICLE_CONFIG.bloom.threshold, 0.99), 0, 1)
    },
    collisions: {
      mode: collisionsMode,
      carve: {
        direction: collisionsMode === 'carve' && chance(0.18) ? 'twoWay' : 'oneWay',
        marginPx: collisionsMode === 'carve' ? Math.round(tri(0, DEFAULT_POPSICLE_CONFIG.collisions.carve.marginPx, 24)) : 0,
        edge: collisionsMode === 'carve' ? collisionsEdge : DEFAULT_POPSICLE_CONFIG.collisions.carve.edge,
        featherPx: collisionsFeather,
        // 3D-only feature; keep random configs conservative.
        finish: 'none',
        finishAutoDepthMult: DEFAULT_POPSICLE_CONFIG.collisions.carve.finishAutoDepthMult
      }
    },
    lighting: {
      enabled: chance(0.8),
      intensity: tri(0.2, DEFAULT_POPSICLE_CONFIG.lighting.intensity, 3.5),
      position: {
        x: tri(-10, DEFAULT_POPSICLE_CONFIG.lighting.position.x, 10),
        y: tri(-10, DEFAULT_POPSICLE_CONFIG.lighting.position.y, 10),
        z: tri(0, DEFAULT_POPSICLE_CONFIG.lighting.position.z, 20)
      },
      ambientIntensity: tri(0.0, DEFAULT_POPSICLE_CONFIG.lighting.ambientIntensity, 1.0)
    },
    camera: {
      distance: tri(5, DEFAULT_POPSICLE_CONFIG.camera.distance, 50),
      azimuth: tri(0, DEFAULT_POPSICLE_CONFIG.camera.azimuth, 360),
      elevation: tri(-80, DEFAULT_POPSICLE_CONFIG.camera.elevation, 80)
    },
    environment: {
      enabled: chance(0.85),
      intensity: tri(0.0, DEFAULT_POPSICLE_CONFIG.environment.intensity, 2.8),
      rotation: tri(0, DEFAULT_POPSICLE_CONFIG.environment.rotation, 360),
      style: (['studio', 'overcast', 'sunset'] as const)[chance(0.7) ? 0 : chance(0.65) ? 1 : 2]
    },
    shadows: {
      enabled: chance(0.75),
      type: chance(0.2) ? 'vsm' : 'pcfsoft',
      mapSize: ([512, 1024, 2048, 4096] as const)[Math.max(0, Math.min(3, Math.round(tri(0, 2, 3))))],
      bias: tri(-0.005, DEFAULT_POPSICLE_CONFIG.shadows.bias, 0.001),
      normalBias: tri(0.0, DEFAULT_POPSICLE_CONFIG.shadows.normalBias, 0.08)
    },
    rendering: {
      toneMapping: chance(0.88) ? 'aces' : 'none',
      exposure: tri(0.6, DEFAULT_POPSICLE_CONFIG.rendering.exposure, 1.8)
    },
    // Do not randomize geometry.quality here (parameter-like).
    geometry: { ...DEFAULT_POPSICLE_CONFIG.geometry }
  };

  // Palette overrides: strongly biased toward none.
  // Occasionally enables a single accent color emission and/or a per-color texture.
  const paletteCount = Math.max(0, base.colors.length);
  const paletteOverrides: Array<any> = [];

  const setOverride = (pi: number, patch: any) => {
    if (pi < 0 || pi >= paletteCount) return;
    const existing = paletteOverrides[pi] && typeof paletteOverrides[pi] === 'object' ? paletteOverrides[pi] : { enabled: true };
    const merged = deepMerge(existing, patch ?? {});
    merged.enabled = true;
    paletteOverrides[pi] = merged;
  };

  const allowOverrides = chance(0.06);
  if (allowOverrides && paletteCount > 0) {
    const emissionIndices = new Set<number>();
    const addEmissionTarget = () => {
      if (paletteCount === 0) return;
      if (emissionIndices.size >= paletteCount) return;
      let idx = Math.floor(rng() * paletteCount);
      let tries = 0;
      while (emissionIndices.has(idx) && tries < 5) {
        idx = Math.floor(rng() * paletteCount);
        tries++;
      }
      emissionIndices.add(idx);
    };

    if (chance(0.55)) addEmissionTarget();
    if (chance(0.22) && paletteCount > 1) addEmissionTarget();
    if (chance(0.08) && paletteCount > 2) addEmissionTarget();

    let emissionOrder = 0;
    for (const idx of emissionIndices) {
      const intensity =
        emissionOrder === 0
          ? clamp(tri(0.6, emissionIntensitySeed, 14), 0, 20)
          : clamp(emissionIntensitySeed * tri(0.35, 0.7, 1.0), 0, 20);
      setOverride(idx, { emission: { enabled: true, intensity } });
      emissionOrder++;
    }

    // Very rare: per-color texture for 3D types.
    if (is3DType && chance(0.12)) {
      const idx = Math.floor(rng() * paletteCount);
      const t: TextureType = chance(0.55) ? 'glass' : chance(0.6) ? 'mirror' : chance(0.5) ? 'metallic' : 'matte';
      const params: any =
        t === 'glass'
          ? { glass: { style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)] } }
          : undefined;
      setOverride(idx, { texture: { type: t, params } });
    }

    // Rare: per-color geometry multipliers (subtle accent near 1.0).
    if (chance(0.18)) {
      const idx = Math.floor(rng() * paletteCount);
      const mult = () => clamp(tri(0.85, 1.0, 1.18), 0.5, 2.0);

      if (type === 'popsicle') {
        setOverride(idx, {
          geometry: {
            popsicle: {
              sizeMult: mult(),
              ratioMult: mult(),
              thicknessMult: mult()
            }
          }
        });
      } else if (type === 'spheres3d') {
        setOverride(idx, { geometry: { spheres3d: { radiusMult: mult() } } });
      } else if (type === 'triangles3d') {
        setOverride(idx, { geometry: { triangles3d: { radiusMult: mult(), heightMult: mult() } } });
      } else if (type === 'svg2d') {
        setOverride(idx, { geometry: { svg: { sizeMult: mult() } } });
      } else if (type === 'svg3d') {
        setOverride(idx, { geometry: { svg: { sizeMult: mult(), extrudeMult: mult() } } });
      }
    }

    // Rare: per-color voronoi override (accent texture).
    if (is3DType && (base as any).voronoi?.enabled && chance(0.12)) {
      const idx = Math.floor(rng() * paletteCount);
      setOverride(idx, {
        voronoi: {
          enabled: false
        }
      });
    }

    if (is3DType && chance(0.16)) {
      const idx = Math.floor(rng() * paletteCount);
      setOverride(idx, {
        voronoi: {
          enabled: true,
          amount: clamp(tri(0.05, 0.65, 1.0), 0, 1),
          scale: clamp(tri(0.6, 3.5, 18), 0.1, 80),
          kind: rng() < 0.7 ? 'edges' : 'cells',
          materialKind: rng() < 0.7 ? 'match' : rng() < 0.85 ? 'edges' : 'cells',
          crackleAmount: rng() < 0.22 ? clamp(tri(0.05, 0.25, 0.85), 0, 1) : 0,
          crackleScale: clamp(tri(2, DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale, 60), 0, 200),
          nucleus: {
            enabled: rng() < 0.25,
            size: clamp(tri(0.03, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size, 0.18), 0, 1),
            softness: clamp(tri(0.05, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness, 0.85), 0, 1),
            strength: clamp(tri(0.25, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength, 1.0), 0, 1),
            color: '#ffffff'
          },
          colorStrength: clamp(tri(0.05, 0.25, 1.0), 0, 1),
          colorMode: rng() < 0.6 ? 'darken' : rng() < 0.5 ? 'lighten' : 'tint',
          materialMode: rng() < 0.2 ? 'none' : rng() < 0.5 ? 'roughness' : rng() < 0.75 ? 'normal' : 'both',
          tintColor: '#ffffff'
        }
      });
    }
  }

  (base as any).palette.overrides = paletteOverrides;

  const paletteEmissionActive = paletteOverrides.some(
    (ov) => !!ov && typeof ov === 'object' && !!ov.emission?.enabled && Number(ov.emission?.intensity) > 0
  );
  const fallbackEmissionActive = !!(base as any).emission.enabled && Number((base as any).emission.intensity) > 0;

  if (paletteEmissionActive) {
    (base as any).emission = { ...(base as any).emission, enabled: false, intensity: 0 };
    (base as any).bloom = { ...(base as any).bloom, enabled: true };
  }

  const emissionInfluencesBloom = paletteEmissionActive || fallbackEmissionActive;

  switch (type) {
    case 'spheres3d':
      {
        const shape: Spheres3DShapeConfig = (() => {
          const polyChance = 0.32;
          const boxChance = 0.22;
          const roll = rng();
          if (roll < polyChance) {
            const roundness = clamp(tri(0.35, 0.75, 1.0), 0, 1);
            const faceting = clamp(tri(0.5, 0.85, 1.0), 0, 1);
            return { kind: 'geodesicPoly' as const, roundness, faceting };
          }

          if (roll < polyChance + boxChance) {
            // Bias to "good looking": fairly round + some faceting; allow rare cubes.
            const cubeish = chance(0.08);
            const roundness = cubeish ? clamp(tri(0.0, 0.12, 0.55), 0, 1) : clamp(tri(0.35, 0.9, 1.0), 0, 1);
            const faceting = cubeish ? clamp(tri(0.75, 1.0, 1.0), 0, 1) : clamp(tri(0.05, 0.55, 1.0), 0, 1);
            return { kind: 'spherifiedBox' as const, roundness, faceting };
          }

          return { kind: 'uvSphere' as const, roundness: 1, faceting: 0 };
        })();

        return {
          ...base,
          type: 'spheres3d',
          spheres: {
            count: skewCountLow(20, DEFAULT_SPHERES3D_CONFIG.spheres.count, 380, 1000, 0.03),
            distribution: (['jitteredGrid', 'scatter', 'layeredDepth'] as const)[Math.floor(rng() * 3)],
            radiusMin: randomWeighted(rng, 0.04, 0.18, 0.08),
            radiusMax: randomWeighted(rng, 0.12, 0.55, 0.26),
            spread: randomWeighted(rng, 1.0, 6.0, 4.2),
            depth: randomWeighted(rng, 0.5, 7.0, 4.0),
            layers: Math.max(1, Math.min(8, Math.round(randomWeighted(rng, 1, 8, 3)))),
            paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
            opacity: randomStickOpacity(),
            shape
          }
        };
      }
    case 'bands2d':
      {
        const panelEnabled = chance(0.55);

        const modeRoll = rng();
        const mode: Bands2DMode =
          panelEnabled
            ? modeRoll < 0.75
              ? 'chevron'
              : modeRoll < 0.95
                ? 'waves'
                : 'straight'
            : modeRoll < 0.42
              ? 'waves'
              : modeRoll < 0.7
                ? 'chevron'
                : 'straight';

        const bandWidthPx = Math.max(8, Math.round(randomWeighted(rng, 10, 260, 120)));
        const gapPx = Math.max(0, Math.round(randomWeighted(rng, 0, 120, 28)));
        const angleDeg = randomWeighted(rng, 0, 360, 22);

        const pickPanelRect = (): { x: number; y: number; w: number; h: number } => {
          const r = rng();
          // Biased archetypes to often hit the target-like compositions.
          if (r < 0.42) {
            // Center card (wide_lines-like)
            const w = clamp(tri(0.22, 0.34, 0.52), 0.08, 0.95);
            const h = clamp(tri(0.18, 0.34, 0.6), 0.08, 0.95);
            const x = clamp(0.5 - w * 0.5 + tri(-0.06, 0, 0.06), 0, 1 - w);
            const y = clamp(0.5 - h * 0.5 + tri(-0.08, 0, 0.08), 0, 1 - h);
            return { x, y, w, h };
          }
          if (r < 0.72) {
            // Left strip (nordic-like)
            const w = clamp(tri(0.12, 0.18, 0.28), 0.06, 0.6);
            const x = clamp(tri(0.02, 0.14, 0.32), 0, 1 - w);
            return { x, y: 0, w, h: 1 };
          }
          if (r < 0.82) {
            // Right strip
            const w = clamp(tri(0.12, 0.18, 0.28), 0.06, 0.6);
            const x = clamp(1 - w - tri(0.02, 0.06, 0.28), 0, 1 - w);
            return { x, y: 0, w, h: 1 };
          }
          if (r < 0.91) {
            // Top banner
            const h = clamp(tri(0.12, 0.18, 0.32), 0.06, 0.6);
            const y = clamp(tri(0.02, 0.06, 0.22), 0, 1 - h);
            return { x: 0, y, w: 1, h };
          }
          // Bottom banner
          const h = clamp(tri(0.12, 0.18, 0.32), 0.06, 0.6);
          const y = clamp(1 - h - tri(0.02, 0.06, 0.22), 0, 1 - h);
          return { x: 0, y, w: 1, h };
        };

        const rectFrac = pickPanelRect();

        return {
          ...base,
          type: 'bands2d',
          emission: { ...base.emission, enabled: false, intensity: 0 },
          bloom: { ...base.bloom, enabled: false },
          collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
          bands: {
            mode,
            seedOffset: Math.round(tri(-50, 0, 50)),
            angleDeg,
            bandWidthPx,
            gapPx,
            offsetPx: Math.round(randomWeighted(rng, -400, 400, 0)),
            jitterPx: Math.round(randomWeighted(rng, 0, 120, 0)),
            panel: {
              enabled: panelEnabled,
              rectFrac,
              radiusPx: Math.round(tri(0, 0, 80)),
              fill: {
                enabled: panelEnabled && chance(0.18),
                color: theme.backgroundColor,
                opacity: clamp(tri(0.25, 0.85, 1.0), 0, 1)
              }
            },
            fill: { enabled: true, opacity: clamp(tri(0.35, 1.0, 1.0), 0, 1) },
            stroke: {
              enabled: rng() < 0.22,
              widthPx: Math.round(randomWeighted(rng, 1, 10, 2)),
              color: '#0b0b10',
              opacity: clamp(tri(0.1, 0.65, 1.0), 0, 1)
            },
            waves: {
              amplitudePx: Math.round(randomWeighted(rng, 0, 140, 36)),
              wavelengthPx: Math.round(randomWeighted(rng, 120, 1200, 520)),
              noiseAmount: clamp(tri(0, 0.25, 1), 0, 1),
              noiseScale: clamp(tri(0.2, 0.9, 3.5), 0.01, 50)
            },
            chevron: {
              amplitudePx: Math.round(randomWeighted(rng, 0, 220, 68)),
              wavelengthPx: Math.round(randomWeighted(rng, 80, 700, 260)),
              sharpness: clamp(tri(0.6, 1.4, 4.0), 0.1, 8),
              sharedPhase: panelEnabled ? chance(0.9) : chance(0.75)
            },
            paletteMode: rng() < 0.55 ? 'cycle' : 'weighted',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
          }
        };
      }
    case 'flowlines2d':
      {
        return {
          ...base,
          type: 'flowlines2d',
          emission: { ...base.emission, enabled: false, intensity: 0 },
          bloom: { ...base.bloom, enabled: false },
          collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
          flowlines: {
            seedOffset: Math.round(tri(-50, 0, 50)),
            frequency: clamp(tri(0.4, 2.4, 6.5), 0.05, 50),
            octaves: Math.max(1, Math.min(8, Math.round(tri(1, 3, 7)))),
            warpAmount: clamp(tri(0.0, 0.55, 2.2), 0, 10),
            warpFrequency: clamp(tri(0.2, 1.8, 4.2), 0.01, 50),
            strength: clamp(tri(0.25, 1.0, 2.2), 0, 20),
            epsilonPx: clamp(tri(0.4, 1.0, 2.0), 0.1, 6),
            spawn: rng() < 0.8 ? 'grid' : 'random',
            density: clamp(tri(0.2, 0.9, 1.0), 0, 1),
            spacingPx: clamp(tri(2, 6, 14), 2, 80),
            marginPx: clamp(tri(0, 18, 80), 0, 400),
            stepPx: clamp(tri(0.4, 1.15, 2.8), 0.05, 20),
            maxSteps: Math.max(12, Math.min(1200, Math.round(tri(40, 240, 680)))),
            maxLines: Math.max(0, Math.min(20000, Math.round(randomWeighted(rng, 50, 6000, 2600)))),
            minLengthPx: clamp(tri(0, 26, 120), 0, 2000),
            jitter: clamp(tri(0, 1.0, 1.0), 0, 1),
            stroke: {
              widthPx: clamp(tri(0.3, 1.2, 3.6), 0.05, 50),
              opacity: clamp(tri(0.05, 0.22, 0.55), 0, 1),
              taper: clamp(tri(0.0, 0.25, 0.7), 0, 1)
            },
            paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
            colorJitter: clamp(tri(0, 0.12, 0.45), 0, 1)
          }
        };
      }
    case 'diamondgrid2d':
      {
        const tw = Math.round(randomWeighted(rng, 40, 260, 120));
        const th = Math.round(clamp(tw * clamp(tri(0.35, 0.5, 0.7), 0.1, 2), 20, 180));
        return {
          ...base,
          type: 'diamondgrid2d',
          emission: { ...base.emission, enabled: false, intensity: 0 },
          bloom: { ...base.bloom, enabled: false },
          collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
          diamondgrid: {
            tileWidthPx: tw,
            tileHeightPx: th,
            marginPx: Math.round(randomWeighted(rng, 0, 14, 2)),
            originPx: { x: 0, y: 0 },
            overscanPx: Math.round(randomWeighted(rng, 0, 220, 64)),
            fillOpacity: clamp(tri(0.35, 0.96, 1.0), 0, 1),
            stroke: {
              enabled: rng() < 0.3,
              widthPx: Math.round(randomWeighted(rng, 1, 10, 2)),
              color: '#0b0b10',
              opacity: clamp(tri(0.15, 0.6, 1.0), 0, 1),
              join: 'round'
            },
            coloring: { paletteMode: rng() < 0.65 ? 'weighted' : 'cycle', colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08] },
            bevel: {
              enabled: rng() < 0.92,
              amount: clamp(tri(0, 0.48, 1.0), 0, 1),
              lightDeg: randomWeighted(rng, 0, 360, 315),
              variation: clamp(tri(0, 0.15, 0.6), 0, 1)
            },
            sparkles: {
              enabled: rng() < 0.24,
              density: clamp(tri(0, 0.035, 0.12), 0, 1),
              countMax: Math.max(1, Math.min(6, Math.round(tri(1, 2, 6)))),
              sizeMinPx: clamp(tri(0.75, 1.6, 3.0), 0.1, 200),
              sizeMaxPx: clamp(tri(3, 9, 18), 0.1, 600),
              opacity: clamp(tri(0.08, 0.28, 0.75), 0, 1),
              color: '#ffffff'
            }
          }
        };
      }
    case 'circles2d':
      return {
        ...base,
        bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
        type: 'circles2d',
        circles: {
          mode: rng() < 0.7 ? 'scatter' : 'grid',
          count: skewCountLow(10, DEFAULT_CIRCLES2D_CONFIG.circles.count, 420, 1200, 0.03),
          rMinPx: Math.round(randomWeighted(rng, 6, 40, 18)),
          rMaxPx: Math.round(randomWeighted(rng, 30, 280, 150)),
          jitter: clamp(randomWeighted(rng, 0, 1, 1), 0, 1),
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, 0.95), 0, 1),
          stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
          paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
          croissant: {
            enabled: rng() < 0.35,
            innerScale: clamp(randomWeighted(rng, 0.5, 0.92, 0.72), 0.01, 0.99),
            offset: clamp(randomWeighted(rng, 0.05, 0.8, 0.35), 0, 1),
            angleJitterDeg: randomWeighted(rng, 0, 360, 180)
          }
        }
      };
    case 'polygon2d':
      {
        const starGrid = chance(0.22);
        const mode = starGrid ? 'grid' : 'scatter';
        const shape = starGrid ? 'star' : rng() < 0.12 ? 'star' : 'polygon';
        const edges = Math.max(3, Math.min(16, Math.round(randomWeighted(rng, 3, 12, 6))));
        const rMinPx = Math.round(randomWeighted(rng, 6, 40, 18));
        const rMaxPx = Math.round(randomWeighted(rng, 30, 280, 130));
        const cellPx = Math.round(randomWeighted(rng, 18, 140, 54));
        return {
          ...base,
          bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
          type: 'polygon2d',
          polygons: {
            mode,
            shape,
            count: starGrid
              ? skewCountLow(20, 900, 2600, 9000, 0.02)
              : skewCountLow(10, DEFAULT_POLYGON2D_CONFIG.polygons.count, 420, 1600, 0.03),
            edges,
            rMinPx,
            rMaxPx,
            jitter: clamp(randomWeighted(rng, 0, 1, 1), 0, 1),
            rotateJitterDeg: starGrid ? randomWeighted(rng, 0, 25, 6) : randomWeighted(rng, 0, 360, 180),
            grid: {
              kind: starGrid ? 'diamond' : rng() < 0.4 ? 'diamond' : 'square',
              cellPx,
              jitter: clamp(randomWeighted(rng, 0, 1, 0.65), 0, 1)
            },
            star: {
              innerScale: clamp(tri(0.25, 0.5, 0.8), 0.05, 0.95)
            },
            fillOpacity: clamp(randomWeighted(rng, starGrid ? 0.05 : 0.2, 1, starGrid ? 0.32 : 0.95), 0, 1),
            stroke: {
              enabled: rng() < (starGrid ? 0.75 : 0.25),
              widthPx: starGrid ? 1 : 2,
              color: '#ffffff',
              opacity: clamp(tri(0.08, 0.55, 1.0), 0, 1)
            },
            paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
          }
        };
      }
    case 'triangles2d':
      return {
        ...base,
        bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
        type: 'triangles2d',
        triangles: {
          mode: (['tessellation', 'scatter', 'lowpoly'] as const)[Math.floor(rng() * 3)],
          density: clamp(randomWeighted(rng, 0.3, 3.0, 1.0), 0.05, 50),
          scalePx: Math.round(randomWeighted(rng, 28, 220, 90)),
          jitter: clamp(randomWeighted(rng, 0, 1, 0.15), 0, 1),
          rotateJitterDeg: randomWeighted(rng, 0, 180, 25),
          insetPx: Math.round(randomWeighted(rng, 0, 120, 0)),
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, 0.95), 0, 1),
          stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.6 },
          paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
          shading: {
            enabled: rng() < 0.85,
            lightDeg: randomWeighted(rng, 0, 360, 35),
            strength: clamp(randomWeighted(rng, 0, 1, 0.25), 0, 1)
          }
        }
      };
    case 'triangles3d':
      {
        const bulgeX = clamp(tri(-1, 0, 1), -1, 1);
        const bulgeY = chance(0.65) ? bulgeX : clamp(tri(-1, 0, 1), -1, 1);

        return {
          ...base,
          type: 'triangles3d',
          prisms: {
            mode: 'stackedPrisms',
            count: skewCountLow(10, DEFAULT_TRIANGLES3D_CONFIG.prisms.count, 360, 1500, 0.03),
            base: (['prism', 'pyramidTri', 'pyramidSquare'] as const)[Math.floor(rng() * 3)],
            radius: randomWeighted(rng, 0.06, 0.6, 0.22),
            height: randomWeighted(rng, 0.06, 1.2, 0.5),
            taper: (() => {
              // Strongly bias toward prisms; occasional frustums/pyramids.
              const r = rng();
              if (r < 0.72) return clamp(tri(0.85, 1.0, 1.0), 0, 1);
              if (r < 0.95) return clamp(tri(0.35, 0.85, 1.0), 0, 1);
              return clamp(tri(0.0, 0.15, 0.5), 0, 1);
            })(),
            wallBulgeX: bulgeX,
            wallBulgeY: bulgeY,
            spread: randomWeighted(rng, 0.8, 6.5, 4.4),
            jitter: clamp(randomWeighted(rng, 0, 1, 0.65), 0, 1),
            paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
            opacity: randomStickOpacity()
          }
        };
      }
    case 'svg2d':
      return {
        ...base,
        bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
        type: 'svg2d',
        svg: {
          source: DEFAULT_SVG_SOURCE,
          renderMode: 'auto',
          colorMode: rng() < 0.12 ? 'svg-to-palette' : 'palette',
          maxTones: Math.max(2, Math.min(12, Math.round(tri(2, 8, 12)))),
          count: chance(0.15) ? 1 : skewCountLow(2, DEFAULT_SVG2D_CONFIG.svg.count, 420, 1600, 0.03),
          rMinPx: Math.round(randomWeighted(rng, 6, 40, DEFAULT_SVG2D_CONFIG.svg.rMinPx)),
          rMaxPx: Math.round(randomWeighted(rng, 30, 280, DEFAULT_SVG2D_CONFIG.svg.rMaxPx)),
          jitter: clamp(randomWeighted(rng, 0, 1, DEFAULT_SVG2D_CONFIG.svg.jitter), 0, 1),
          rotateJitterDeg: randomWeighted(rng, 0, 360, DEFAULT_SVG2D_CONFIG.svg.rotateJitterDeg),
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, DEFAULT_SVG2D_CONFIG.svg.fillOpacity), 0, 1),
          stroke: { enabled: rng() < 0.35, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
          paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
        }
      };
    case 'svg3d':
      {
        const logoMode = chance(0.18);
        const colorMode: SvgColorMode = rng() < 0.12 ? 'svg-to-palette' : 'palette';
        const count = logoMode ? 1 : chance(0.15) ? 1 : skewCountLow(2, DEFAULT_SVG3D_CONFIG.svg.count, 360, 1500, 0.03);
        const spread = logoMode ? 0 : randomWeighted(rng, 0.8, 6.5, DEFAULT_SVG3D_CONFIG.svg.spread);
        const depth = logoMode ? 0 : randomWeighted(rng, 0.5, 7.0, DEFAULT_SVG3D_CONFIG.svg.depth);
        const tiltDeg = logoMode ? 0 : chance(0.75) ? 0 : Math.round(clamp(randomWeighted(rng, 0, 45, 8), 0, 80));

        const rotateDeg = 0;
        const rotateJitterDeg = logoMode ? 0 : clamp(randomWeighted(rng, 0, 360, DEFAULT_SVG3D_CONFIG.svg.rotateJitterDeg), 0, 3600);

        const logoSize = logoMode ? clamp(randomWeighted(rng, 0.35, 1.8, 0.85), 0.05, 3.0) : 0;
        const sizeMin = logoMode ? logoSize : randomWeighted(rng, 0.05, 0.32, DEFAULT_SVG3D_CONFIG.svg.sizeMin);
        const sizeMax = logoMode ? logoSize : randomWeighted(rng, 0.14, 0.9, DEFAULT_SVG3D_CONFIG.svg.sizeMax);

        return {
          ...base,
          type: 'svg3d',
          svg: {
            source: DEFAULT_SVG_SOURCE,
            renderMode: 'auto',
            colorMode,
            maxTones: Math.max(2, Math.min(12, Math.round(tri(2, 8, 12)))),
            count,
            spread,
            depth,
            tiltDeg,
            rotateDeg,
            rotateJitterDeg,
            sizeMin,
            sizeMax,
            extrudeDepth: randomWeighted(rng, 0.02, 0.6, DEFAULT_SVG3D_CONFIG.svg.extrudeDepth),
            stroke: {
              enabled: logoMode ? true : rng() < 0.45,
              radius: clamp(tri(0.006, DEFAULT_SVG3D_CONFIG.svg.stroke.radius, 0.06), 0.001, 0.2),
              segments: Math.max(1, Math.min(12, Math.round(tri(2, DEFAULT_SVG3D_CONFIG.svg.stroke.segments, 10)))),
              opacity: randomStickOpacity()
            },
            bevel: {
              enabled: chance(0.7),
              size: clamp(tri(0.0, DEFAULT_SVG3D_CONFIG.svg.bevel.size, 0.14), 0, 0.2),
              segments: Math.max(0, Math.min(6, Math.round(tri(0, DEFAULT_SVG3D_CONFIG.svg.bevel.segments, 4))))
            },
            paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
            opacity: randomStickOpacity()
          }
        };
      }
    case 'hexgrid2d':
      return {
        ...base,
        emission: { ...(base as any).emission, enabled: false },
        bloom: { ...(base as any).bloom, enabled: false },
        type: 'hexgrid2d',
        hexgrid: {
          radiusPx: Math.round(randomWeighted(rng, 14, 120, 56)),
          marginPx: Math.round(randomWeighted(rng, 0, 10, 2)),
          originPx: { x: 0, y: 0 },
          overscanPx: 32,
          stroke: { enabled: rng() < 0.3, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
          coloring: {
            weightsMode: 'preset',
            preset: (['equal', 'dominant', 'accents', 'rare-accents'] as const)[Math.floor(rng() * 4)],
            weights: [1, 1, 1, 1, 1],
            paletteMode: 'weighted'
          },
          effect: {
            kind: (['none', 'bevel', 'grain', 'gradient'] as const)[Math.floor(rng() * 4)],
            amount: clamp(randomWeighted(rng, 0, 1, 0.45), 0, 1),
            frequency: randomWeighted(rng, 0.2, 3.0, 1.0)
          },
          grouping: {
            // Grouping is visually strong and can be expensive; keep it less common.
            mode: rng() < 0.55 ? 'none' : rng() < 0.7 ? 'noise' : rng() < 0.86 ? 'voronoi' : 'random-walk',
            strength: clamp(randomWeighted(rng, 0, 1, 0.6), 0, 1),
            targetGroupCount: Math.max(1, Math.round(randomWeighted(rng, 1, 80, 24)))
          },
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, 0.96), 0, 1)
        }
      };
    case 'ridges2d':
      {
        // Keep ridges configs conservative: disable collisions/emission (not used by this generator).
        const levels = Math.max(6, Math.min(28, Math.round(tri(6, DEFAULT_RIDGES2D_CONFIG.ridges.levels, 28))));
        const stepPx = Math.max(3, Math.min(16, Math.round(tri(3, DEFAULT_RIDGES2D_CONFIG.ridges.gridStepPx, 16))));
        const oct = Math.max(1, Math.min(8, Math.round(tri(1, DEFAULT_RIDGES2D_CONFIG.ridges.octaves, 7))));
        const detailFrequency = clamp(randomWeighted(rng, 3.5, 12, 7.5), 0.1, 40);
        const detailAmplitude = clamp(randomWeighted(rng, 0.02, 0.36, 0.18), 0, 0.7);
        const contrast = clamp(randomWeighted(rng, 0.75, 1.55, 1.05), 0.2, 3);
        const bias = clamp(randomWeighted(rng, -0.18, 0.18, 0), -0.5, 0.5);
        const levelJitter = clamp(randomWeighted(rng, 0.02, 0.32, 0.1), 0, 0.4);
        const warpDepth = clamp(randomWeighted(rng, 0, 0.72, 0.28), 0, 1);

        return {
          ...base,
          type: 'ridges2d',
          emission: { ...(base as any).emission, enabled: false },
          bloom: { ...(base as any).bloom, enabled: false },
          collisions: { ...(base as any).collisions, mode: 'none', carve: { ...(base as any).collisions.carve, marginPx: 0, featherPx: 0 } },
          ridges: {
            gridStepPx: stepPx,
            frequency: clamp(tri(0.6, DEFAULT_RIDGES2D_CONFIG.ridges.frequency, 5.5), 0.05, 50),
            detailFrequency,
            detailAmplitude,
            octaves: oct,
            warpAmount: clamp(tri(0.0, DEFAULT_RIDGES2D_CONFIG.ridges.warpAmount, 2.4), 0, 50),
            warpDepth,
            warpFrequency: clamp(tri(0.2, DEFAULT_RIDGES2D_CONFIG.ridges.warpFrequency, 4.0), 0.01, 50),
            contrast,
            bias,
            levels,
            levelJitter,
            lineWidthPx: clamp(tri(0.5, DEFAULT_RIDGES2D_CONFIG.ridges.lineWidthPx, 3.0), 0.1, 50),
            lineOpacity: clamp(tri(0.08, DEFAULT_RIDGES2D_CONFIG.ridges.lineOpacity, 0.95), 0, 1),
            smoothing: clamp(tri(0.0, DEFAULT_RIDGES2D_CONFIG.ridges.smoothing, 0.85), 0, 1),
            fillBands: {
              enabled: chance(0.65),
              opacity: clamp(tri(0.04, DEFAULT_RIDGES2D_CONFIG.ridges.fillBands.opacity, 0.45), 0, 1)
            },
            paletteMode: chance(0.65) ? 'weighted' : 'cycle',
            colorWeights: [0.58, 0.18, 0.12, 0.08, 0.04]
          }
        };
      }
    case 'popsicle':
    default:
      {
        const endProfileR = rng();
        const stickEndProfile: PopsicleConfig['stickEndProfile'] =
          endProfileR < 0.72 ? 'rounded' : endProfileR < 0.9 ? 'chamfer' : 'chipped';

        const seamEnabled = rng() < 0.16;
        const bandEnabled = rng() < 0.1;
        const hollow = rng() < 0.1;
        const edgeEmissiveSeam = seamEnabled && rng() < 0.1;
        const edgeEmissiveBand = bandEnabled && rng() < 0.08;
        const pickEdgeColor = () => {
          if (theme.colors.length > 0 && rng() < 0.75) return theme.colors[Math.floor(rng() * theme.colors.length)] ?? '#ffffff';
          return rng() < 0.5 ? '#ffffff' : '#0b0b10';
        };
        return {
          ...base,
          type: 'popsicle',
          stickCount: Math.round(randomWeighted(rng, 1, 200, 40)),
          stickOverhang: randomWeighted(rng, 0, 180, 30),
          rotationCenterOffsetX: randomWeighted(rng, -100, 100, 0),
          rotationCenterOffsetY: randomWeighted(rng, -100, 100, 0),
          stickGap: randomWeighted(rng, 0, 5, 0.05),
          stickSize: randomWeighted(rng, 0.25, 2.5, 1.0),
          stickRatio: randomWeighted(rng, 0.75, 12, 3.0),
          stickThickness: randomWeighted(rng, 0.1, 3, 1.0),
          stickEndProfile,
          // Bias toward simpler square-ish ends.
          stickRoundness: clamp(Math.pow(randomWeighted(rng, 0, 1, 0.18), 1.6), 0, 1),
          stickChipAmount: stickEndProfile === 'chipped' ? randomWeighted(rng, 0, 1, 0.35) : 0,
          stickChipJaggedness: stickEndProfile === 'chipped' ? randomWeighted(rng, 0, 1, 0.55) : 0,
          stickBevel: randomWeighted(rng, 0, 1, 0.35),
          stickOpacity: randomStickOpacity(),
          edge: {
            ...(base as any).edge,
            hollow,
            seam: {
              ...(base as any).edge.seam,
              enabled: seamEnabled,
              color: edgeEmissiveSeam ? pickEdgeColor() : '#0b0b10',
              opacity: seamEnabled ? clamp(tri(0.15, (base as any).edge.seam.opacity, 1.0), 0, 1) : (base as any).edge.seam.opacity,
              width: seamEnabled ? clamp(tri(0, 0.012, 0.08), 0, 0.12) : (base as any).edge.seam.width,
              noise: seamEnabled ? clamp(tri(0, 0.15, 0.9), 0, 1) : (base as any).edge.seam.noise,
              emissiveIntensity: edgeEmissiveSeam ? clamp(tri(0.25, 2.0, 8), 0, 20) : 0
            },
            band: {
              ...(base as any).edge.band,
              enabled: bandEnabled,
              color: edgeEmissiveBand ? pickEdgeColor() : '#ffffff',
              opacity: bandEnabled ? clamp(tri(0.05, (base as any).edge.band.opacity, 0.75), 0, 1) : (base as any).edge.band.opacity,
              width: bandEnabled ? clamp(tri(0, (base as any).edge.band.width, 0.22), 0, 0.25) : (base as any).edge.band.width,
              noise: bandEnabled ? clamp(tri(0, 0.1, 0.75), 0, 1) : (base as any).edge.band.noise,
              emissiveIntensity: edgeEmissiveBand ? clamp(tri(0.25, 1.5, 7), 0, 20) : 0
            }
          }
        };
      }
  }
}
