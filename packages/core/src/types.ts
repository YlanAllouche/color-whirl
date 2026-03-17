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

export interface WallpaperConfig {
  type: 'popsicle';
  /** Stable seed for any randomness in generators */
  seed: number;
  width: number;
  height: number;
  colors: string[];
  texture: TextureType;
  textureParams: TextureParams;
  backgroundColor: string;
  edges: EdgesConfig;
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
  lighting: LightingConfig;
  camera: CameraConfig;
  environment: EnvironmentConfig;
  shadows: ShadowConfig;
  rendering: RenderingConfig;
  geometry: GeometryConfig;
}

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

export const DEFAULT_CONFIG: WallpaperConfig = {
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
  return generateRandomConfigNoPresetsFromSeed(seed);
}

export function generateRandomConfigNoPresetsFromSeed(seed: number): WallpaperConfig {
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
  
  return {
    type: 'popsicle',
    seed,
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
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
      tint: { ...DEFAULT_CONFIG.edges.tint },
      material: { ...DEFAULT_CONFIG.edges.material },
      wear: { ...DEFAULT_CONFIG.edges.wear },
      rimLight: { ...DEFAULT_CONFIG.edges.rimLight },
      outline: { ...DEFAULT_CONFIG.edges.outline }
    },
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
    stickOpacity: randomStickOpacity(),
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
    // Render pipeline settings are not randomized.
    environment: { ...DEFAULT_CONFIG.environment },
    shadows: { ...DEFAULT_CONFIG.shadows },
    rendering: { ...DEFAULT_CONFIG.rendering },
    geometry: { ...DEFAULT_CONFIG.geometry }
  };
}
