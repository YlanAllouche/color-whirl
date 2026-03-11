export type TextureType = 'glossy' | 'matte' | 'metallic';

export type Direction = 
  | 'top-bottom' 
  | 'left-right' 
  | 'top-right-to-bottom-left' 
  | 'bottom-left-to-top-right';

export type StackingMode = 'perfect' | 'helix';

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
  direction: Direction;
  stacking: StackingMode;
  stickCount: number;
  /** Stick overhang angle per stick in degrees (e.g., each stick rotates 15° from the previous) */
  stickOverhang: number;
  /** Rotation center offset as percentage of stick length (-100 to +100, default 0 = center) */
  rotationCenterOffsetX: number;
  rotationCenterOffsetY: number;
  stickGap: number;
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

export const COLOR_PALETTES = {
  sunset: ['#FF6B6B', '#FF8E53', '#FE6B8B', '#FF8E53', '#FFD93D'],
  ocean: ['#0077BE', '#0099CC', '#00BBDD', '#4ECDC4', '#44A08D'],
  forest: ['#2D5016', '#3E6B1F', '#4F7D28', '#61A534', '#7CB342'],
  monochrome: ['#000000', '#333333', '#666666', '#999999', '#CCCCCC'],
  candy: ['#FF006E', '#8338EC', '#3A86FF', '#06FFB4', '#FFBE0B'],
  neon: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000']
} as const;

export type ColorPalette = keyof typeof COLOR_PALETTES;

export interface ExportOptions {
  format: 'png' | 'jpg' | 'webp' | 'svg';
  quality?: number;
  filename?: string;
}

export const DEFAULT_CONFIG: WallpaperConfig = {
  type: 'popsickle',
  width: 1920,
  height: 1080,
  colors: [...COLOR_PALETTES.sunset],
  texture: 'glossy',
  backgroundColor: '#1a1a2e',
  direction: 'top-bottom',
  stacking: 'helix',
  stickCount: 12,
  stickOverhang: 30,
  rotationCenterOffsetX: 0,
  rotationCenterOffsetY: 0,
  stickGap: 0.05,
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
