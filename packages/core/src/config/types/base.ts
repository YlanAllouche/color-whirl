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

export type GrazingMode = 'add' | 'mix';

/**
 * View-dependent highlight along grazing angles.
 * This unifies the historical rim-light (add) and edge-wear (mix) looks.
 */
export interface GrazingConfig {
  enabled: boolean;
  mode: GrazingMode;
  color: string;
  /** 0..5 (add) or 0..1 (mix) recommended */
  strength: number;
  /** 0.5..8 */
  power: number;
  /** 0..1: only used for mix mode (band width) */
  width: number;
  /** 0..1 */
  noise: number;
}

export interface OutlineConfig {
  enabled: boolean;
  color: string;
  /** 0..0.2 (scale factor, not pixels) */
  thickness: number;
  /** 0..1 */
  opacity: number;
}

/**
 * Surface overrides for the "facades" (historically: edges).
 * For popsicles this mainly targets the side walls.
 */
export interface FacadeSideConfig {
  enabled: boolean;
  tintColor: string;
  /** 0..1 */
  tintAmount: number;
  /** 0..1: lerp from base -> overrides */
  materialAmount: number;
  /** 0..1 */
  roughness: number;
  /** 0..1 */
  metalness: number;
  /** 0..1 */
  clearcoat: number;
  /** 0..3 */
  envIntensityMult: number;
}

export interface FacadesConfig {
  side: FacadeSideConfig;
  grazing: GrazingConfig;
  outline: OutlineConfig;
}

export interface EdgeSeamConfig {
  enabled: boolean;
  color: string;
  /** 0..1 */
  opacity: number;
  /** 0..0.25 (fraction of min half-size) */
  width: number;
  /** 0..1 */
  noise: number;
  /** 0..20 (added to color) */
  emissiveIntensity: number;
}

export interface EdgeBandConfig {
  enabled: boolean;
  color: string;
  /** 0..1 */
  opacity: number;
  /** 0..0.6 (fraction of min half-size) */
  width: number;
  /** 0..1 */
  noise: number;
  /** 0..20 (added to color) */
  emissiveIntensity: number;
}

/**
 * "Edge" settings are reserved for effects at face-contact boundaries.
 * Currently used only for popsicles to optionally hollow the caps.
 */
export interface EdgeConfig {
  /** Popsicle-only: make front/back caps transparent */
  hollow: boolean;
  seam: EdgeSeamConfig;
  band: EdgeBandConfig;
}

export interface BubblesConfig {
  enabled: boolean;
  /**
   * - through: actually carve holes (discard/alpha)
   * - cap: keep surface, shade as a cavity (no see-through)
   */
  mode: 'through' | 'cap';
  interior: {
    /** Whether to render approximated interior surfaces for carved cavities */
    enabled: boolean;
  };
  /** Cell density in world units. Higher = more cavities. */
  frequency: number;
  /** Variation range for the density (0..1). */
  frequencyVariance: number;
  /** Maximum number of nearby cell samples to test (capped in shader). */
  count: number;
  /** Scene units */
  radiusMin: number;
  /** Scene units */
  radiusMax: number;
  /** Scene units: 0 = hard discard */
  softness: number;
  /** 0..1: thickness of the carved wall in shader space */
  wallThickness: number;
  /** Additional offset applied to the hash seed */
  seedOffset: number;
}

export interface EmissionConfig {
  enabled: boolean;
  /** Palette index (0-based) */
  paletteIndex: number;
  /** 0..20 */
  intensity: number;
}

export interface PaletteEmissionOverride {
  /** Override global emission for this palette index */
  enabled?: boolean;
  /** 0..20 (recommended) */
  intensity?: number;
}

export type TextureParamsOverride = {
  drywall?: Partial<TextureParams['drywall']>;
  glass?: Partial<TextureParams['glass']>;
  cel?: Partial<TextureParams['cel']>;
};

export interface PaletteTextureOverride {
  type?: TextureType;
  params?: TextureParamsOverride;
}

export interface PaletteFacadesOverride {
  side?: Partial<FacadeSideConfig>;
  grazing?: Partial<GrazingConfig>;
  outline?: Partial<OutlineConfig>;
}

export interface PaletteEdgeOverride {
  hollow?: boolean;
  seam?: Partial<EdgeSeamConfig>;
  band?: Partial<EdgeBandConfig>;
}

export interface PaletteGeometryOverride {
  popsicle?: {
    /** Multiplies stickSize */
    sizeMult?: number;
    /** Multiplies stickRatio */
    ratioMult?: number;
    /** Multiplies stickThickness */
    thicknessMult?: number;
  };
  spheres3d?: {
    /** Multiplies per-instance sphere radius */
    radiusMult?: number;
  };
  triangles3d?: {
    /** Multiplies prism radius */
    radiusMult?: number;
    /** Multiplies prism height */
    heightMult?: number;
  };
  svg?: {
    /** Multiplies per-instance SVG size (2D r / 3D XY scale) */
    sizeMult?: number;
    /** Multiplies 3D SVG extrusion depth (Z scale) */
    extrudeMult?: number;
  };
}

export interface PaletteOverride {
  /** Whether overrides for this palette index are active */
  enabled: boolean;
  /**
   * 0..1: how often this override applies across occurrences of the palette color.
   * - 1 (default): apply to every occurrence
   * - 0: apply exactly once, picking the occurrence closest to the camera (3D types)
   */
  frequency?: number;
  emission?: PaletteEmissionOverride;
  texture?: PaletteTextureOverride;
  facades?: PaletteFacadesOverride;
  edge?: PaletteEdgeOverride;
  geometry?: PaletteGeometryOverride;
  bubbles?: Partial<BubblesConfig>;
  voronoi?: Partial<VoronoiConfig>;
}

export interface PaletteConfig {
  /** Per-palette overrides. Length may be < colors.length. Missing entries are treated as null. */
  overrides: Array<PaletteOverride | null>;
}

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

export type VoronoiKind = 'cells' | 'edges';
export type VoronoiSpace = 'world' | 'object';
export type VoronoiColorMode = 'darken' | 'lighten' | 'tint';
export type VoronoiMaterialMode = 'none' | 'roughness' | 'normal' | 'both';
export type VoronoiMaterialKind = 'match' | 'cells' | 'edges';

export interface VoronoiConfig {
  enabled: boolean;
  space: VoronoiSpace;
  kind: VoronoiKind;
  /** Cell density. Higher = smaller cells. */
  scale: number;
  seedOffset: number;

  /** 0..1 */
  amount: number;
  /** 0..1: only used for kind='edges' */
  edgeWidth: number;
  /** 0..1 */
  softness: number;

  /** 0..1 */
  colorStrength: number;
  colorMode: VoronoiColorMode;
  tintColor: string;

  /** Controls whether Voronoi affects roughness, normals, both, or color only. */
  materialMode: VoronoiMaterialMode;

  /** Which Voronoi mask drives roughness/normal changes (independent from color). */
  materialKind: VoronoiMaterialKind;

  /** 0..1: adds material roughness variation from the Voronoi mask. */
  roughnessStrength: number;
  /** 0..1: how much the Voronoi field perturbs the shading normal. */
  normalStrength: number;
  /** 0..1: scale of the derivative step used for the Voronoi normal perturbation. */
  normalScale: number;

  /** 0..1: randomly removes parts of walls for a cracked/chipped look. */
  crackleAmount: number;
  /** Noise frequency for crackle (higher = finer chips). */
  crackleScale: number;

  nucleus: {
    enabled: boolean;
    /** 0..1: radius in Voronoi cell units */
    size: number;
    /** 0..1: softness of the nucleus mask */
    softness: number;
    /** 0..1: mix amount toward nucleusColor */
    strength: number;
    color: string;
  };
}

export type CollisionsMode = 'none' | 'carve';
export type CollisionsCarveDirection = 'oneWay' | 'twoWay';
export type CollisionsCarveEdge = 'hard' | 'soft';
export type CollisionsCarveFinish = 'none' | 'wallsCap';

export interface CollisionsCarveConfig {
  direction: CollisionsCarveDirection;
  marginPx: number;
  edge: CollisionsCarveEdge;
  featherPx: number;
  /** How to render the carved volume in 3D (A-mode). */
  finish: CollisionsCarveFinish;
  /** Depth multiplier when finish is enabled and using auto depth. */
  finishAutoDepthMult: number;
}

export interface CollisionsConfig {
  mode: CollisionsMode;
  carve: CollisionsCarveConfig;
}

export interface CameraConfig {
  mode: 'auto' | 'manual';
  /** 0.5..0.999: content viewport occupancy used by Auto mode and Fit action */
  padding: number;
  /** Distance from origin in scene units */
  distance: number;
  /** Manual orthographic zoom multiplier */
  zoom: number;
  /** Manual pan in camera-plane units (X) */
  panX: number;
  /** Manual pan in camera-plane units (Y) */
  panY: number;
  /** Rotation around the Y axis, in degrees */
  azimuth: number;
  /** Rotation above/below the horizon, in degrees */
  elevation: number;
  /** Manual near plane */
  near: number;
  /** Manual far plane */
  far: number;
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

export type PaletteAssignMode = 'cycle' | 'weighted';

export type WallpaperType =
  | 'popsicle'
  | 'spheres3d'
  | 'bands2d'
  | 'flowlines2d'
  | 'diamondgrid2d'
  | 'circles2d'
  | 'polygon2d'
  | 'triangles2d'
  | 'triangles3d'
  | 'hexgrid2d'
  | 'ridges2d'
  | 'svg2d'
  | 'svg3d';

export interface BaseWallpaperConfig {
  type: WallpaperType;
  /** Stable seed for any randomness in generators */
  seed: number;
  width: number;
  height: number;
  colors: string[];
  palette: PaletteConfig;
  texture: TextureType;
  textureParams: TextureParams;
  voronoi: VoronoiConfig;
  backgroundColor: string;
  facades: FacadesConfig;
  edge: EdgeConfig;
  bubbles: BubblesConfig;
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

export const RESOLUTION_PRESETS = {
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  mobile: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  ultrawide: { width: 3440, height: 1440 }
} as const;

export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

export interface ExportOptions {
  format: 'png' | 'jpg' | 'webp' | 'svg';
  quality?: number;
  filename?: string;
}
