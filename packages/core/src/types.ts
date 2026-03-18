export type TextureType = 'glossy' | 'matte' | 'metallic' | 'drywall' | 'glass' | 'mirror' | 'cel';

export type GlassStyle = 'simple' | 'frosted' | 'thick' | 'stylized';

export interface TextureParams {
  drywall: {
    /** 0..1 */
    grainAmount: number;
    /** Controls texture repeat in UV space */
    grainScale: number;
  };
  glass: {
    style: GlassStyle;
  };
  cel: {
    /** Number of toon bands (2..8 recommended) */
    bands: number;
    halftone: boolean;
  };
}

export interface RimLightConfig {
  enabled: boolean;
  color: string;
  /** 0..5 */
  intensity: number;
  /** 0.5..8 */
  power: number;
}

export interface OutlineConfig {
  enabled: boolean;
  color: string;
  /** 0..0.2 (scale factor, not pixels) */
  thickness: number;
  /** 0..1 */
  opacity: number;
}

export interface EdgeTintConfig {
  enabled: boolean;
  color: string;
  /** 0..1 */
  amount: number;
}

export interface EdgeMaterialConfig {
  enabled: boolean;
  /** 0..1 */
  roughness: number;
  /** 0..1 */
  metalness: number;
  /** 0..1 */
  clearcoat: number;
  /** 0..3 */
  envIntensityMult: number;
}

export interface EdgeWearConfig {
  enabled: boolean;
  /** 0..1 */
  intensity: number;
  /** 0..1 */
  width: number;
  /** 0..1 */
  noise: number;
  colorShift: string;
}

export interface EdgesConfig {
  tint: EdgeTintConfig;
  material: EdgeMaterialConfig;
  wear: EdgeWearConfig;
  rimLight: RimLightConfig;
  outline: OutlineConfig;
}

export interface EmissionConfig {
  enabled: boolean;
  /** Palette index (0-based) */
  paletteIndex: number;
  /** 0..20 */
  intensity: number;
}

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

export type CollisionsMode = 'none' | 'carve';
export type CollisionsCarveDirection = 'oneWay' | 'twoWay';
export type CollisionsCarveEdge = 'hard' | 'soft';

export interface CollisionsCarveConfig {
  direction: CollisionsCarveDirection;
  marginPx: number;
  edge: CollisionsCarveEdge;
  featherPx: number;
}

export interface CollisionsConfig {
  mode: CollisionsMode;
  carve: CollisionsCarveConfig;
}

export interface CameraConfig {
  /** Distance from origin in scene units */
  distance: number;
  /** Rotation around the Y axis, in degrees */
  azimuth: number;
  /** Rotation above/below the horizon, in degrees */
  elevation: number;
}

export interface LightingConfig {
  enabled: boolean;
  intensity: number;
  position: { x: number; y: number; z: number };
  ambientIntensity: number;
}

export type EnvironmentStyle = 'studio' | 'overcast' | 'sunset';

export interface EnvironmentConfig {
  enabled: boolean;
  /** Overall intensity for image-based lighting reflections */
  intensity: number;
  /** Rotation around the Y axis, in degrees */
  rotation: number;
  style: EnvironmentStyle;
}

export type ShadowType = 'pcfsoft' | 'vsm';

export interface ShadowConfig {
  enabled: boolean;
  type: ShadowType;
  /** Shadow map size (power of two recommended) */
  mapSize: number;
  bias: number;
  normalBias: number;
}

export type ToneMappingType = 'aces' | 'none';

export interface RenderingConfig {
  toneMapping: ToneMappingType;
  exposure: number;
}

export interface GeometryConfig {
  /** 0..1: controls bevel/curve segments for smoother shading */
  quality: number;
}

export type WallpaperType =
  | 'popsicle'
  | 'spheres3d'
  | 'circles2d'
  | 'polygon2d'
  | 'triangles2d'
  | 'triangles3d'
  | 'hexgrid2d';

export interface BaseWallpaperConfig {
  type: WallpaperType;
  /** Stable seed for any randomness in generators */
  seed: number;
  width: number;
  height: number;
  colors: string[];
  texture: TextureType;
  textureParams: TextureParams;
  backgroundColor: string;
  edges: EdgesConfig;
  emission: EmissionConfig;
  bloom: BloomConfig;
  collisions: CollisionsConfig;
  lighting: LightingConfig;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  shadows: ShadowConfig;
  rendering: RenderingConfig;
  geometry: GeometryConfig;
}

export interface PopsicleConfig extends BaseWallpaperConfig {
  type: 'popsicle';
  stickCount: number;
  /** Stick overhang angle per stick in degrees (e.g., each stick rotates 15° from the previous) */
  stickOverhang: number;
  /** Rotation center offset as percentage of stick length (-100 to +100, default 0 = center) */
  rotationCenterOffsetX: number;
  rotationCenterOffsetY: number;
  stickGap: number;
  /** Overall scale multiplier for stick dimensions */
  stickSize: number;
  /** Stick aspect ratio (length/width) */
  stickRatio: number;
  stickThickness: number;
  /** 0 = square ends, 1 = fully rounded pill ends */
  stickRoundness: number;
  /** 0 = no bevel, 1 = strongest bevel */
  stickBevel: number;
  /** 0..1: stick material opacity; 1 = fully opaque */
  stickOpacity: number;
}

export type SphereDistribution = 'jitteredGrid' | 'scatter' | 'layeredDepth';
export type PaletteAssignMode = 'cycle' | 'weighted';

export interface Spheres3DConfig extends BaseWallpaperConfig {
  type: 'spheres3d';
  spheres: {
    count: number;
    distribution: SphereDistribution;
    /** Scene units */
    radiusMin: number;
    /** Scene units */
    radiusMax: number;
    /** Scene units: XY spread */
    spread: number;
    /** Scene units: Z spread */
    depth: number;
    /** Used when distribution=layeredDepth */
    layers: number;
    paletteMode: PaletteAssignMode;
    /** Per-palette weights (used when paletteMode=weighted). Length may be < colors.length. */
    colorWeights: number[];
    /** 0..1 */
    opacity: number;
  };
}

export type Circles2DMode = 'scatter' | 'grid';

export interface Circles2DConfig extends BaseWallpaperConfig {
  type: 'circles2d';
  circles: {
    mode: Circles2DMode;
    count: number;
    rMinPx: number;
    rMaxPx: number;
    /** 0..1 */
    jitter: number;
    /** 0..1 */
    fillOpacity: number;
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
    };
    paletteMode: PaletteAssignMode;
    colorWeights: number[];
    croissant: {
      enabled: boolean;
      /** 0..1: inner radius as fraction of outer radius */
      innerScale: number;
      /** 0..1: inner center offset as fraction of outer radius */
      offset: number;
      angleJitterDeg: number;
    };
  };
}

export interface Polygon2DConfig extends BaseWallpaperConfig {
  type: 'polygon2d';
  polygons: {
    count: number;
    /** Polygon edge count (>= 3) */
    edges: number;
    rMinPx: number;
    rMaxPx: number;
    /** 0..1 */
    jitter: number;
    rotateJitterDeg: number;
    /** 0..1 */
    fillOpacity: number;
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
    };
    paletteMode: PaletteAssignMode;
    colorWeights: number[];
  };
}

export type Triangles2DMode = 'tessellation' | 'scatter' | 'lowpoly';

export interface Triangles2DConfig extends BaseWallpaperConfig {
  type: 'triangles2d';
  triangles: {
    mode: Triangles2DMode;
    /** Roughly controls count; interpretation depends on mode */
    density: number;
    /** Pixel size */
    scalePx: number;
    /** 0..1 */
    jitter: number;
    rotateJitterDeg: number;
    insetPx: number;
    /** 0..1 */
    fillOpacity: number;
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
    };
    paletteMode: PaletteAssignMode;
    colorWeights: number[];
    shading: {
      enabled: boolean;
      lightDeg: number;
      /** 0..1 */
      strength: number;
    };
  };
}

export type Triangles3DMode = 'tessellation' | 'scatter' | 'stackedPrisms';

export interface Triangles3DConfig extends BaseWallpaperConfig {
  type: 'triangles3d';
  prisms: {
    mode: Triangles3DMode;
    count: number;
    /** Scene units */
    radius: number;
    /** Scene units */
    height: number;
    /** -1..1: concave (<0) to convex (>0) prism walls */
    wallBulge: number;
    /** Scene units */
    spread: number;
    /** 0..1 */
    jitter: number;
    paletteMode: PaletteAssignMode;
    colorWeights: number[];
    /** 0..1 */
    opacity: number;
  };
}

export type HexColorWeightsMode = 'auto' | 'preset' | 'custom';
export type HexColorWeightsPreset = 'equal' | 'dominant' | 'accents' | 'rare-accents';
export type HexEffectKind = 'none' | 'bevel' | 'grain' | 'gradient';
export type HexGroupingMode = 'none' | 'voronoi' | 'noise' | 'random-walk';

export interface HexGrid2DConfig extends BaseWallpaperConfig {
  type: 'hexgrid2d';
  hexgrid: {
    radiusPx: number;
    marginPx: number;
    originPx: { x: number; y: number };
    overscanPx: number;
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
      join: 'round' | 'miter' | 'bevel';
    };
    coloring: {
      weightsMode: HexColorWeightsMode;
      preset: HexColorWeightsPreset;
      weights: number[];
      paletteMode: PaletteAssignMode;
    };
    effect: {
      kind: HexEffectKind;
      /** 0..1 */
      amount: number;
      frequency: number;
    };
    grouping: {
      mode: HexGroupingMode;
      /** 0..1 */
      strength: number;
      targetGroupCount: number;
    };
    /** 0..1 */
    fillOpacity: number;
  };
}

export type WallpaperConfig =
  | PopsicleConfig
  | Spheres3DConfig
  | Circles2DConfig
  | Polygon2DConfig
  | Triangles2DConfig
  | Triangles3DConfig
  | HexGrid2DConfig;

export const RESOLUTION_PRESETS = {
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  'mobile': { width: 1080, height: 1920 },
  'square': { width: 1080, height: 1080 },
  'ultrawide': { width: 3440, height: 1440 }
} as const;

export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

export interface ExportOptions {
  format: 'png' | 'jpg' | 'webp' | 'svg';
  quality?: number;
  filename?: string;
}

export const DEFAULT_POPSICLE_CONFIG: PopsicleConfig = {
  type: 'popsicle',
  seed: 1,
  width: 1920,
  height: 1080,
  colors: ['#FF6B6B', '#FF8E53', '#FE6B8B', '#FF8E53', '#FFD93D'],
  texture: 'glossy',
  textureParams: {
    drywall: { grainAmount: 0.65, grainScale: 2.5 },
    glass: { style: 'simple' },
    cel: { bands: 4, halftone: false }
  },
  backgroundColor: '#1a1a2e',
  edges: {
    tint: { enabled: false, color: '#ffffff', amount: 0.25 },
    material: { enabled: false, roughness: 0.35, metalness: 0.0, clearcoat: 0.0, envIntensityMult: 1.0 },
    wear: { enabled: false, intensity: 0.35, width: 0.5, noise: 0.6, colorShift: '#ffffff' },
    rimLight: { enabled: false, color: '#ffffff', intensity: 0.6, power: 2.5 },
    outline: { enabled: false, color: '#0b0b10', thickness: 0.03, opacity: 1.0 }
  },
  emission: {
    enabled: false,
    paletteIndex: 0,
    intensity: 2.5
  },
  bloom: {
    enabled: false,
    strength: 0.9,
    radius: 0.35,
    threshold: 0.85
  },
  collisions: {
    mode: 'none',
    carve: {
      direction: 'oneWay',
      marginPx: 0,
      edge: 'hard',
      featherPx: 0
    }
  },
  stickCount: 12,
  stickOverhang: 30,
  rotationCenterOffsetX: 0,
  rotationCenterOffsetY: 0,
  stickGap: 0.05,
  stickSize: 1.0,
  stickRatio: 3.0,
  stickThickness: 1.0,
  stickRoundness: 0.15,
  stickBevel: 0.35,
  stickOpacity: 1.0,
  lighting: {
    enabled: true,
    intensity: 1.5,
    position: { x: 5, y: 5, z: 5 },
    ambientIntensity: 0.3
  },
  camera: {
    // Roughly matches the previous hard-coded (10, 10, 10) isometric camera.
    distance: 17.3,
    azimuth: 45,
    elevation: 35.3
  },
  environment: {
    enabled: true,
    intensity: 1.2,
    rotation: 0,
    style: 'studio'
  },
  shadows: {
    enabled: true,
    type: 'pcfsoft',
    mapSize: 2048,
    bias: -0.0005,
    normalBias: 0.02
  },
  rendering: {
    toneMapping: 'aces',
    exposure: 1.0
  },
  geometry: {
    quality: 0.6
  }
};

// Back-compat alias (historical name)
export const DEFAULT_CONFIG: PopsicleConfig = DEFAULT_POPSICLE_CONFIG;

export const DEFAULT_SPHERES3D_CONFIG: Spheres3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'spheres3d',
  spheres: {
    count: 160,
    distribution: 'jitteredGrid',
    radiusMin: 0.08,
    radiusMax: 0.26,
    spread: 4.2,
    depth: 4.0,
    layers: 3,
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_CIRCLES2D_CONFIG: Circles2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'circles2d',
  circles: {
    mode: 'scatter',
    count: 220,
    rMinPx: 18,
    rMaxPx: 150,
    jitter: 1.0,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    croissant: { enabled: false, innerScale: 0.72, offset: 0.35, angleJitterDeg: 180 }
  }
};

export const DEFAULT_POLYGON2D_CONFIG: Polygon2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'polygon2d',
  polygons: {
    count: 200,
    edges: 6,
    rMinPx: 18,
    rMaxPx: 130,
    jitter: 1.0,
    rotateJitterDeg: 180,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_TRIANGLES2D_CONFIG: Triangles2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'triangles2d',
  triangles: {
    mode: 'tessellation',
    density: 1.0,
    scalePx: 90,
    jitter: 0.15,
    rotateJitterDeg: 25,
    insetPx: 0,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6 },
    paletteMode: 'cycle',
    colorWeights: [1, 1, 1, 1, 1],
    shading: { enabled: true, lightDeg: 35, strength: 0.25 }
  }
};

export const DEFAULT_TRIANGLES3D_CONFIG: Triangles3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'triangles3d',
  prisms: {
    mode: 'stackedPrisms',
    count: 160,
    radius: 0.22,
    height: 0.5,
    wallBulge: 0,
    spread: 4.4,
    jitter: 0.65,
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_HEXGRID2D_CONFIG: HexGrid2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'hexgrid2d',
  hexgrid: {
    radiusPx: 56,
    marginPx: 2,
    originPx: { x: 0, y: 0 },
    overscanPx: 32,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
    coloring: { weightsMode: 'preset', preset: 'accents', weights: [1, 1, 1, 1, 1], paletteMode: 'weighted' },
    effect: { kind: 'bevel', amount: 0.45, frequency: 1.0 },
    grouping: { mode: 'noise', strength: 0.6, targetGroupCount: 24 },
    fillOpacity: 0.96
  }
};

export const DEFAULT_CONFIG_BY_TYPE: Record<WallpaperType, WallpaperConfig> = {
  popsicle: DEFAULT_POPSICLE_CONFIG,
  spheres3d: DEFAULT_SPHERES3D_CONFIG,
  circles2d: DEFAULT_CIRCLES2D_CONFIG,
  polygon2d: DEFAULT_POLYGON2D_CONFIG,
  triangles2d: DEFAULT_TRIANGLES2D_CONFIG,
  triangles3d: DEFAULT_TRIANGLES3D_CONFIG,
  hexgrid2d: DEFAULT_HEXGRID2D_CONFIG
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  // Wallpaper configs are plain JSON-like data.
  return JSON.parse(JSON.stringify(value)) as T;
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

export function normalizeWallpaperConfig(input: any): WallpaperConfig {
  const rawType = typeof input?.type === 'string' ? String(input.type) : 'popsicle';
  const type = (rawType in DEFAULT_CONFIG_BY_TYPE ? rawType : 'popsicle') as WallpaperType;

  const base = cloneJson(DEFAULT_CONFIG_BY_TYPE[type]);
  const merged = deepMerge(base, input ?? {});
  merged.type = type;

  // Light validation for new fields (keep back-compat with missing/invalid values).
  const cm = merged.collisions?.mode;
  if (cm !== 'none' && cm !== 'carve') merged.collisions.mode = 'none';

  const dir = merged.collisions?.carve?.direction;
  if (dir !== 'oneWay' && dir !== 'twoWay') merged.collisions.carve.direction = 'oneWay';

  const edge = merged.collisions?.carve?.edge;
  if (edge !== 'hard' && edge !== 'soft') merged.collisions.carve.edge = 'hard';

  if (!Number.isFinite(Number(merged.collisions?.carve?.marginPx))) merged.collisions.carve.marginPx = 0;
  if (!Number.isFinite(Number(merged.collisions?.carve?.featherPx))) merged.collisions.carve.featherPx = 0;

  return merged as WallpaperConfig;
}

/**
 * Generate a random value using a weighted normal distribution.
 * The distribution is centered around `normal` with a spread based on min/max.
 */
export type RNG = () => number;

export function createRng(seed: number): RNG {
  // mulberry32
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomWeighted(rng: RNG, min: number, max: number, normal: number): number {
  // Use a simple weighted distribution: randomly pick between uniform and normal-biased
  // This gives more weight to values near `normal` while still allowing the full range
  const useNormal = rng() < 0.7; // 70% chance to use normal-weighted
  
  if (useNormal) {
    // Box-Muller transform for normal distribution centered at normal
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    // Normalize the range: spread is (max - min) / 4 to keep values mostly in range
    const spread = (max - min) / 4;
    const value = normal + z0 * spread;
    return Math.max(min, Math.min(max, value));
  } else {
    // Uniform distribution
    return min + rng() * (max - min);
  }
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

/**
 * Generate a random wallpaper configuration, including colors, without using presets.
 */
export function generateRandomConfigNoPresets(): WallpaperConfig {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return generateRandomConfigNoPresetsFromSeed(seed, 'popsicle');
}

export function generateRandomConfigNoPresetsFromSeed(seed: number, type: WallpaperType = 'popsicle'): WallpaperConfig {
  const rng = createRng(seed);

  const theme = generateRandomColorThemeFromSeed(seed ^ 0x9e3779b9, 5);

  const textures: TextureType[] = ['glossy', 'matte', 'metallic', 'drywall', 'glass', 'mirror'];

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
  
  const base: BaseWallpaperConfig = {
    type,
    seed,
    width: DEFAULT_POPSICLE_CONFIG.width,
    height: DEFAULT_POPSICLE_CONFIG.height,
    colors: [...theme.colors],
    texture: textures[Math.floor(rng() * textures.length)],
    textureParams: {
      drywall: {
        grainAmount: clamp(randomWeighted(rng, 0.15, 1.0, 0.65), 0, 1),
        grainScale: clamp(randomWeighted(rng, 0.6, 6.0, 2.5), 0.1, 50)
      },
      glass: {
        style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)]
      },
      cel: {
        bands: Math.max(2, Math.min(8, Math.round(randomWeighted(rng, 2, 8, 4)))),
        halftone: rng() < 0.25
      }
    },
    backgroundColor: theme.backgroundColor,
    edges: {
      tint: { ...DEFAULT_POPSICLE_CONFIG.edges.tint },
      material: { ...DEFAULT_POPSICLE_CONFIG.edges.material },
      wear: { ...DEFAULT_POPSICLE_CONFIG.edges.wear },
      rimLight: { ...DEFAULT_POPSICLE_CONFIG.edges.rimLight },
      outline: { ...DEFAULT_POPSICLE_CONFIG.edges.outline }
    },
    emission: { ...DEFAULT_POPSICLE_CONFIG.emission },
    bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom },
    collisions: { ...DEFAULT_POPSICLE_CONFIG.collisions, carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve } },
    lighting: {
      enabled: rng() > 0.2,
      intensity: randomWeighted(rng, 0.5, 3, 1.5),
      position: {
        x: randomWeighted(rng, -10, 10, 5),
        y: randomWeighted(rng, -10, 10, 5),
        z: randomWeighted(rng, 0, 20, 5)
      },
      ambientIntensity: randomWeighted(rng, 0.1, 1, 0.3)
    },
    camera: {
      distance: randomWeighted(rng, 5, 50, 17.3),
      azimuth: randomWeighted(rng, 0, 360, 45),
      elevation: randomWeighted(rng, -80, 80, 35.3)
    },
    environment: { ...DEFAULT_POPSICLE_CONFIG.environment },
    shadows: { ...DEFAULT_POPSICLE_CONFIG.shadows },
    rendering: { ...DEFAULT_POPSICLE_CONFIG.rendering },
    geometry: { ...DEFAULT_POPSICLE_CONFIG.geometry }
  };

  switch (type) {
    case 'spheres3d':
      return {
        ...base,
        type: 'spheres3d',
        spheres: {
          count: Math.round(randomWeighted(rng, 20, 1000, 220)),
          distribution: (['jitteredGrid', 'scatter', 'layeredDepth'] as const)[Math.floor(rng() * 3)],
          radiusMin: randomWeighted(rng, 0.04, 0.18, 0.08),
          radiusMax: randomWeighted(rng, 0.12, 0.55, 0.26),
          spread: randomWeighted(rng, 1.0, 6.0, 4.2),
          depth: randomWeighted(rng, 0.5, 7.0, 4.0),
          layers: Math.max(1, Math.min(8, Math.round(randomWeighted(rng, 1, 8, 3)))),
          paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
          opacity: randomStickOpacity()
        }
      };
    case 'circles2d':
      return {
        ...base,
        type: 'circles2d',
        circles: {
          mode: rng() < 0.7 ? 'scatter' : 'grid',
          count: Math.round(randomWeighted(rng, 10, 1200, 260)),
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
      return {
        ...base,
        type: 'polygon2d',
        polygons: {
          count: Math.round(randomWeighted(rng, 10, 1600, 240)),
          edges: Math.max(3, Math.min(16, Math.round(randomWeighted(rng, 3, 12, 6)))),
          rMinPx: Math.round(randomWeighted(rng, 6, 40, 18)),
          rMaxPx: Math.round(randomWeighted(rng, 30, 280, 130)),
          jitter: clamp(randomWeighted(rng, 0, 1, 1), 0, 1),
          rotateJitterDeg: randomWeighted(rng, 0, 360, 180),
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, 0.95), 0, 1),
          stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
          paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
        }
      };
    case 'triangles2d':
      return {
        ...base,
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
          shading: { enabled: rng() < 0.85, lightDeg: randomWeighted(rng, 0, 360, 35), strength: clamp(randomWeighted(rng, 0, 1, 0.25), 0, 1) }
        }
      };
    case 'triangles3d':
      return {
        ...base,
        type: 'triangles3d',
        prisms: {
          mode: 'stackedPrisms',
          count: Math.round(randomWeighted(rng, 10, 1500, 200)),
          radius: randomWeighted(rng, 0.06, 0.6, 0.22),
          height: randomWeighted(rng, 0.06, 1.2, 0.5),
          wallBulge: 0,
          spread: randomWeighted(rng, 0.8, 6.5, 4.4),
          jitter: clamp(randomWeighted(rng, 0, 1, 0.65), 0, 1),
          paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
          opacity: randomStickOpacity()
        }
      };
    case 'hexgrid2d':
      return {
        ...base,
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
          effect: { kind: (['none', 'bevel', 'grain', 'gradient'] as const)[Math.floor(rng() * 4)], amount: clamp(randomWeighted(rng, 0, 1, 0.45), 0, 1), frequency: randomWeighted(rng, 0.2, 3.0, 1.0) },
          grouping: {
            mode: (['none', 'voronoi', 'noise', 'random-walk'] as const)[Math.floor(rng() * 4)],
            strength: clamp(randomWeighted(rng, 0, 1, 0.6), 0, 1),
            targetGroupCount: Math.max(1, Math.round(randomWeighted(rng, 1, 80, 24)))
          },
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, 0.96), 0, 1)
        }
      };
    case 'popsicle':
    default:
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
        stickRoundness: randomWeighted(rng, 0, 1, 0.15),
        stickBevel: randomWeighted(rng, 0, 1, 0.35),
        stickOpacity: randomStickOpacity()
      };
  }
}
