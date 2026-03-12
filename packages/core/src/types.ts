export type TextureType = 'glossy' | 'matte' | 'metallic';

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

export interface WallpaperConfig {
  type: 'popsickle';
  width: number;
  height: number;
  colors: string[];
  texture: TextureType;
  backgroundColor: string;
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
  lighting: LightingConfig;
  camera: CameraConfig;
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
  type: 'popsickle',
  width: 1920,
  height: 1080,
  colors: ['#FF6B6B', '#FF8E53', '#FE6B8B', '#FF8E53', '#FFD93D'],
  texture: 'glossy',
  backgroundColor: '#1a1a2e',
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
  }
};

/**
 * Generate a random value using a weighted normal distribution.
 * The distribution is centered around `normal` with a spread based on min/max.
 */
export function randomWeighted(min: number, max: number, normal: number): number {
  // Use a simple weighted distribution: randomly pick between uniform and normal-biased
  // This gives more weight to values near `normal` while still allowing the full range
  const useNormal = Math.random() < 0.7; // 70% chance to use normal-weighted
  
  if (useNormal) {
    // Box-Muller transform for normal distribution centered at normal
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    // Normalize the range: spread is (max - min) / 4 to keep values mostly in range
    const spread = (max - min) / 4;
    const value = normal + z0 * spread;
    return Math.max(min, Math.min(max, value));
  } else {
    // Uniform distribution
    return min + Math.random() * (max - min);
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
  const baseHue = Math.random() * 360;
  const scheme = Math.random();

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

  const saturationBase = randomWeighted(55, 92, 75);
  const lightnessBase = randomWeighted(45, 68, 56);

  const colors = offsets.map((off, i) => {
    const h = baseHue + off + randomWeighted(-6, 6, 0);
    const s = saturationBase + randomWeighted(-10, 10, 0);
    // Slight stagger to avoid same-looking swatches.
    const l = lightnessBase + randomWeighted(-10, 10, 0) + (i % 2 === 0 ? 4 : -2);
    return hslToHex(h, s, l);
  });

  // Background: same base hue, low saturation, dark.
  const backgroundColor = hslToHex(baseHue + randomWeighted(-10, 10, 0), randomWeighted(8, 22, 14), randomWeighted(6, 14, 10));

  return { colors, backgroundColor };
}

/**
 * Generate a random wallpaper configuration, including colors, without using presets.
 */
export function generateRandomConfigNoPresets(): WallpaperConfig {
  const theme = generateRandomColorTheme(5);

  const textures: TextureType[] = ['glossy', 'matte', 'metallic'];

  return {
    type: 'popsickle',
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    colors: [...theme.colors],
    texture: textures[Math.floor(Math.random() * textures.length)],
    backgroundColor: theme.backgroundColor,
    stickCount: Math.round(randomWeighted(1, 200, 40)),
    stickOverhang: randomWeighted(0, 180, 30),
    rotationCenterOffsetX: randomWeighted(-100, 100, 0),
    rotationCenterOffsetY: randomWeighted(-100, 100, 0),
    stickGap: randomWeighted(0, 5, 0.05),
    stickSize: randomWeighted(0.25, 2.5, 1.0),
    stickRatio: randomWeighted(0.75, 12, 3.0),
    stickThickness: randomWeighted(0.1, 3, 1.0),
    stickRoundness: randomWeighted(0, 1, 0.15),
    stickBevel: randomWeighted(0, 1, 0.35),
    lighting: {
      enabled: Math.random() > 0.2,
      intensity: randomWeighted(0.5, 3, 1.5),
      position: {
        x: randomWeighted(-10, 10, 5),
        y: randomWeighted(-10, 10, 5),
        z: randomWeighted(0, 20, 5)
      },
      ambientIntensity: randomWeighted(0.1, 1, 0.3)
    },
    camera: {
      distance: randomWeighted(5, 50, 17.3),
      azimuth: randomWeighted(0, 360, 45),
      elevation: randomWeighted(-80, 80, 35.3)
    }
  };
}
