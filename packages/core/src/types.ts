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

export interface GruyereConfig {
  enabled: boolean;
  /** Cell density in world units. Higher = more cavities. */
  frequency: number;
  /** Maximum number of nearby cell samples to test (capped in shader). */
  count: number;
  /** Scene units */
  radiusMin: number;
  /** Scene units */
  radiusMax: number;
  /** Scene units: 0 = hard discard */
  softness: number;
  /** 0..1: cavity influence (1 = full hole) */
  strength: number;
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

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
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
  texture: TextureType;
  textureParams: TextureParams;
  backgroundColor: string;
  facades: FacadesConfig;
  edge: EdgeConfig;
  gruyere: GruyereConfig;
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
  stickEndProfile: 'rounded' | 'chamfer' | 'chipped';
  /** 0 = square ends, 1 = strongest effect (profile-dependent) */
  stickRoundness: number;
  /** 0..1: only used when stickEndProfile=chipped */
  stickChipAmount: number;
  /** 0..1: only used when stickEndProfile=chipped */
  stickChipJaggedness: number;
  /** 0 = no bevel, 1 = strongest bevel */
  stickBevel: number;
  /** 0..1: stick material opacity; 1 = fully opaque */
  stickOpacity: number;
}

export type SphereDistribution = 'jitteredGrid' | 'scatter' | 'layeredDepth';
export type PaletteAssignMode = 'cycle' | 'weighted';

export type Spheres3DShapeKind = 'uvSphere' | 'spherifiedBox';

export interface Spheres3DShapeConfig {
  kind: Spheres3DShapeKind;
  /** 0..1: 0 = cube, 1 = sphere (only used when kind=spherifiedBox) */
  roundness: number;
  /** 0..1: 0 = smooth, 1 = faceted (only used when kind=spherifiedBox) */
  faceting: number;
}

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

    shape: Spheres3DShapeConfig;
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
    /** Base polygon for each prism/pyramid */
    base: 'triangle' | 'square';
    /** Scene units */
    radius: number;
    /** Scene units */
    height: number;
    /** 0..1: 1 = prism, 0 = pyramid apex */
    taper: number;
    /** -1..1: concave (<0) to convex (>0) walls (X axis influence) */
    wallBulgeX: number;
    /** -1..1: concave (<0) to convex (>0) walls (Y axis influence) */
    wallBulgeY: number;
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

export interface Ridges2DConfig extends BaseWallpaperConfig {
  type: 'ridges2d';
  ridges: {
    /** Sampling resolution in pixels (higher = faster, lower = more detail) */
    gridStepPx: number;
    /** Base noise frequency in "noise space" (roughly features per min(width,height)) */
    frequency: number;
    /** Fractal octaves (1..8 recommended) */
    octaves: number;
    /** Domain warp amount in noise-space units */
    warpAmount: number;
    /** Domain warp frequency multiplier */
    warpFrequency: number;
    /** Number of contour levels */
    levels: number;
    lineWidthPx: number;
    /** 0..1 */
    lineOpacity: number;
    /** 0..1: affects field smoothing + polyline smoothing */
    smoothing: number;
    fillBands: {
      enabled: boolean;
      /** 0..1 */
      opacity: number;
    };
    paletteMode: PaletteAssignMode;
    /** Per-palette weights (used when paletteMode=weighted). Length may be < colors.length. */
    colorWeights: number[];
  };
}

export interface Svg2DConfig extends BaseWallpaperConfig {
  type: 'svg2d';
  svg: {
    /** Raw SVG source string */
    source: string;
    count: number;
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

export interface Svg3DConfig extends BaseWallpaperConfig {
  type: 'svg3d';
  svg: {
    /** Raw SVG source string */
    source: string;
    count: number;
    /** Scene units: XY spread */
    spread: number;
    /** Scene units: Z spread */
    depth: number;
    /** Scene units: overall XY size */
    sizeMin: number;
    /** Scene units: overall XY size */
    sizeMax: number;
    /** Scene units: extrusion depth (independent of size) */
    extrudeDepth: number;
    bevel: {
      enabled: boolean;
      /** 0..0.2: bevel size as fraction of base shape */
      size: number;
      segments: number;
    };
    paletteMode: PaletteAssignMode;
    colorWeights: number[];
    /** 0..1 */
    opacity: number;
  };
}

export type WallpaperConfig =
  | PopsicleConfig
  | Spheres3DConfig
  | Circles2DConfig
  | Polygon2DConfig
  | Triangles2DConfig
  | Triangles3DConfig
  | HexGrid2DConfig
  | Ridges2DConfig
  | Svg2DConfig
  | Svg3DConfig;

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
  facades: {
    side: {
      enabled: false,
      tintColor: '#ffffff',
      tintAmount: 0.25,
      materialAmount: 1.0,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.0,
      envIntensityMult: 1.0
    },
    grazing: {
      enabled: false,
      mode: 'add',
      color: '#ffffff',
      strength: 0.6,
      power: 2.5,
      width: 0.5,
      noise: 0
    },
    outline: { enabled: false, color: '#0b0b10', thickness: 0.03, opacity: 1.0 }
  },
  edge: {
    hollow: false,
    seam: {
      enabled: false,
      color: '#0b0b10',
      opacity: 0.65,
      width: 0.02,
      noise: 0,
      emissiveIntensity: 0
    },
    band: {
      enabled: false,
      color: '#ffffff',
      opacity: 0.25,
      width: 0.06,
      noise: 0,
      emissiveIntensity: 0
    }
  },
  gruyere: {
    enabled: false,
    frequency: 1.8,
    count: 8,
    radiusMin: 0.12,
    radiusMax: 0.38,
    softness: 0.06,
    strength: 1.0,
    seedOffset: 0
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
      featherPx: 0,
      finish: 'none',
      finishAutoDepthMult: 1
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
  stickEndProfile: 'rounded',
  stickRoundness: 0.15,
  stickChipAmount: 0.35,
  stickChipJaggedness: 0.55,
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
    opacity: 1.0,
    shape: {
      kind: 'uvSphere',
      roundness: 1,
      faceting: 0
    }
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
    base: 'triangle',
    radius: 0.22,
    height: 0.5,
    taper: 1,
    wallBulgeX: 0,
    wallBulgeY: 0,
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

export const DEFAULT_RIDGES2D_CONFIG: Ridges2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'ridges2d',
  // A more "paper"-like default background for topo lines.
  backgroundColor: '#f2eee4',
  // Earthy inks; weighted palette tends to pick the darkest for contour lines.
  colors: ['#263a2f', '#3f6b55', '#7ea66a', '#d0c29c', '#8b5a3c'],
  ridges: {
    gridStepPx: 6,
    frequency: 2.4,
    octaves: 5,
    warpAmount: 0.85,
    warpFrequency: 1.6,
    levels: 14,
    lineWidthPx: 1.25,
    lineOpacity: 0.6,
    smoothing: 0.35,
    fillBands: { enabled: true, opacity: 0.18 },
    paletteMode: 'weighted',
    colorWeights: [0.58, 0.18, 0.12, 0.08, 0.04]
  }
};

export const DEFAULT_SVG_SOURCE =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-app-window-icon lucide-app-window"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>`;

export const DEFAULT_SVG2D_CONFIG: Svg2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg2d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    count: 220,
    rMinPx: 18,
    rMaxPx: 150,
    jitter: 1.0,
    rotateJitterDeg: 180,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_SVG3D_CONFIG: Svg3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg3d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    count: 160,
    spread: 4.4,
    depth: 4.0,
    sizeMin: 0.14,
    sizeMax: 0.5,
    extrudeDepth: 0.22,
    bevel: { enabled: true, size: 0.06, segments: 2 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_CONFIG_BY_TYPE: Record<WallpaperType, WallpaperConfig> = {
  popsicle: DEFAULT_POPSICLE_CONFIG,
  spheres3d: DEFAULT_SPHERES3D_CONFIG,
  circles2d: DEFAULT_CIRCLES2D_CONFIG,
  polygon2d: DEFAULT_POLYGON2D_CONFIG,
  triangles2d: DEFAULT_TRIANGLES2D_CONFIG,
  triangles3d: DEFAULT_TRIANGLES3D_CONFIG,
  hexgrid2d: DEFAULT_HEXGRID2D_CONFIG,
  ridges2d: DEFAULT_RIDGES2D_CONFIG,
  svg2d: DEFAULT_SVG2D_CONFIG,
  svg3d: DEFAULT_SVG3D_CONFIG
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

  // Back-compat: migrate historical `edges` -> `facades`.
  const legacyEdges = (merged as any).edges;
  if (legacyEdges && typeof legacyEdges === 'object') {
    const e: any = legacyEdges;
    const cur: any = (merged as any).facades ?? cloneJson((base as any).facades);

    const tintEnabled = !!e?.tint?.enabled;
    const matEnabled = !!e?.material?.enabled;
    const wearEnabled = !!e?.wear?.enabled;
    const rimEnabled = !!e?.rimLight?.enabled;

    const sideEnabled = tintEnabled || matEnabled;
    const grazingEnabled = wearEnabled || rimEnabled;

    const grazingMode: GrazingMode = rimEnabled && !wearEnabled ? 'add' : wearEnabled && !rimEnabled ? 'mix' : 'add';

    (merged as any).facades = {
      ...cur,
      side: {
        ...cur.side,
        enabled: sideEnabled,
        tintColor: typeof e?.tint?.color === 'string' ? e.tint.color : cur.side.tintColor,
        tintAmount: tintEnabled ? Number(e?.tint?.amount ?? cur.side.tintAmount) : 0,
        materialAmount: matEnabled ? 1.0 : 0.0,
        roughness: Number(e?.material?.roughness ?? cur.side.roughness),
        metalness: Number(e?.material?.metalness ?? cur.side.metalness),
        clearcoat: Number(e?.material?.clearcoat ?? cur.side.clearcoat),
        envIntensityMult: Number(e?.material?.envIntensityMult ?? cur.side.envIntensityMult)
      },
      grazing: {
        ...cur.grazing,
        enabled: grazingEnabled,
        mode: grazingMode,
        color:
          typeof e?.rimLight?.color === 'string'
            ? e.rimLight.color
            : typeof e?.wear?.colorShift === 'string'
              ? e.wear.colorShift
              : cur.grazing.color,
        strength: rimEnabled ? Number(e?.rimLight?.intensity ?? cur.grazing.strength) : Number(e?.wear?.intensity ?? cur.grazing.strength),
        power: rimEnabled ? Number(e?.rimLight?.power ?? cur.grazing.power) : 2.0,
        width: Number(e?.wear?.width ?? cur.grazing.width),
        noise: Number(e?.wear?.noise ?? cur.grazing.noise)
      },
      outline: {
        ...cur.outline,
        enabled: !!e?.outline?.enabled,
        color: typeof e?.outline?.color === 'string' ? e.outline.color : cur.outline.color,
        thickness: Number(e?.outline?.thickness ?? cur.outline.thickness),
        opacity: Number(e?.outline?.opacity ?? cur.outline.opacity)
      }
    };

    delete (merged as any).edges;
  }

  // Light validation for new fields (keep back-compat with missing/invalid values).
  const cm = merged.collisions?.mode;
  if (cm !== 'none' && cm !== 'carve') merged.collisions.mode = 'none';

  const dir = merged.collisions?.carve?.direction;
  if (dir !== 'oneWay' && dir !== 'twoWay') merged.collisions.carve.direction = 'oneWay';

  const edge = merged.collisions?.carve?.edge;
  if (edge !== 'hard' && edge !== 'soft') merged.collisions.carve.edge = 'hard';

  if (!Number.isFinite(Number(merged.collisions?.carve?.marginPx))) merged.collisions.carve.marginPx = 0;
  if (!Number.isFinite(Number(merged.collisions?.carve?.featherPx))) merged.collisions.carve.featherPx = 0;

  // Edge config validation.
  if (typeof (merged as any).edge?.hollow !== 'boolean') {
    (merged as any).edge = { ...(merged as any).edge, hollow: !!(merged as any).edge?.hollow };
  }

  // Gruyere config validation.
  const baseGruyere: any = (base as any).gruyere;
  const gAny: any = (merged as any).gruyere;
  if (!gAny || typeof gAny !== 'object') {
    (merged as any).gruyere = cloneJson(baseGruyere);
  } else {
    gAny.enabled = typeof gAny.enabled === 'boolean' ? gAny.enabled : !!gAny.enabled;
    const freq = Number(gAny.frequency);
    gAny.frequency = Number.isFinite(freq) ? clamp(freq, 0, 20) : Number(baseGruyere.frequency) || 0;
    const cnt = Number(gAny.count);
    gAny.count = Number.isFinite(cnt) ? Math.max(0, Math.min(16, Math.round(cnt))) : Math.round(Number(baseGruyere.count) || 0);
    const rMin = Number(gAny.radiusMin);
    const rMax = Number(gAny.radiusMax);
    gAny.radiusMin = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseGruyere.radiusMin) || 0);
    gAny.radiusMax = Number.isFinite(rMax) ? Math.max(gAny.radiusMin, rMax) : Math.max(gAny.radiusMin, Number(baseGruyere.radiusMax) || gAny.radiusMin);
    const soft = Number(gAny.softness);
    gAny.softness = Number.isFinite(soft) ? clamp(soft, 0, 2) : Math.max(0, Number(baseGruyere.softness) || 0);
    const str = Number(gAny.strength);
    gAny.strength = Number.isFinite(str) ? clamp(str, 0, 1) : clamp(Number(baseGruyere.strength) || 0, 0, 1);
    const so = Number(gAny.seedOffset);
    gAny.seedOffset = Number.isFinite(so) ? so : Number(baseGruyere.seedOffset) || 0;
  }

  const edgeObj: any = (merged as any).edge;
  if (!edgeObj || typeof edgeObj !== 'object') {
    (merged as any).edge = cloneJson((base as any).edge);
  } else {
    if (!edgeObj.seam || typeof edgeObj.seam !== 'object') edgeObj.seam = cloneJson((base as any).edge.seam);
    if (!edgeObj.band || typeof edgeObj.band !== 'object') edgeObj.band = cloneJson((base as any).edge.band);
  }

  // Back-compat: triangles3d prisms.wallBulge -> wallBulgeX/wallBulgeY.
  if ((merged as any).type === 'triangles3d') {
    const prisms: any = (merged as any).prisms;
    if (prisms && typeof prisms === 'object') {
      const legacy = prisms.wallBulge;
      const hasLegacy = typeof legacy === 'number' && Number.isFinite(legacy);
      const hasX = typeof prisms.wallBulgeX === 'number' && Number.isFinite(prisms.wallBulgeX);
      const hasY = typeof prisms.wallBulgeY === 'number' && Number.isFinite(prisms.wallBulgeY);

      if (hasLegacy && (!hasX || !hasY)) {
        prisms.wallBulgeX = hasX ? prisms.wallBulgeX : legacy;
        prisms.wallBulgeY = hasY ? prisms.wallBulgeY : legacy;
      }
      if ('wallBulge' in prisms) delete prisms.wallBulge;

      // Light validation for new triangles3d fields.
      if (prisms.base !== 'triangle' && prisms.base !== 'square') prisms.base = 'triangle';
      const t = Number(prisms.taper);
      prisms.taper = Number.isFinite(t) ? clamp(t, 0, 1) : 1;
      const bx = Number(prisms.wallBulgeX);
      const by = Number(prisms.wallBulgeY);
      prisms.wallBulgeX = Number.isFinite(bx) ? clamp(bx, -1, 1) : 0;
      prisms.wallBulgeY = Number.isFinite(by) ? clamp(by, -1, 1) : 0;
    }
  }

  // Basic svg config validation.
  if ((merged as any).type === 'svg2d' || (merged as any).type === 'svg3d') {
    const baseSvg: any = (base as any).svg;
    const sAny: any = (merged as any).svg;

    if (!sAny || typeof sAny !== 'object') {
      (merged as any).svg = cloneJson(baseSvg);
    } else {
      if (typeof sAny.source !== 'string') sAny.source = String(sAny.source ?? baseSvg?.source ?? '');
      const cnt = Number(sAny.count);
      sAny.count = Number.isFinite(cnt) ? Math.max(0, Math.round(cnt)) : Math.round(Number(baseSvg?.count) || 0);
      if ((merged as any).type === 'svg2d') {
        const rMin = Number(sAny.rMinPx);
        const rMax = Number(sAny.rMaxPx);
        sAny.rMinPx = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseSvg?.rMinPx) || 0);
        sAny.rMaxPx = Number.isFinite(rMax) ? Math.max(sAny.rMinPx, rMax) : Math.max(sAny.rMinPx, Number(baseSvg?.rMaxPx) || sAny.rMinPx);
        sAny.jitter = Number.isFinite(Number(sAny.jitter)) ? clamp(Number(sAny.jitter), 0, 1) : clamp(Number(baseSvg?.jitter) || 0, 0, 1);
        sAny.rotateJitterDeg = Number.isFinite(Number(sAny.rotateJitterDeg)) ? Number(sAny.rotateJitterDeg) : Number(baseSvg?.rotateJitterDeg) || 0;
        sAny.fillOpacity = Number.isFinite(Number(sAny.fillOpacity)) ? clamp(Number(sAny.fillOpacity), 0, 1) : clamp(Number(baseSvg?.fillOpacity) || 0, 0, 1);
        if (!sAny.stroke || typeof sAny.stroke !== 'object') sAny.stroke = cloneJson(baseSvg?.stroke);
        sAny.paletteMode = sAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
        if (!Array.isArray(sAny.colorWeights)) sAny.colorWeights = Array.isArray(baseSvg?.colorWeights) ? baseSvg.colorWeights.slice() : [];
      } else {
        const spread = Number(sAny.spread);
        const depth = Number(sAny.depth);
        sAny.spread = Number.isFinite(spread) ? Math.max(0, spread) : Math.max(0, Number(baseSvg?.spread) || 0);
        sAny.depth = Number.isFinite(depth) ? Math.max(0, depth) : Math.max(0, Number(baseSvg?.depth) || 0);
        const sMin = Number(sAny.sizeMin);
        const sMax = Number(sAny.sizeMax);
        sAny.sizeMin = Number.isFinite(sMin) ? Math.max(0.0001, sMin) : Math.max(0.0001, Number(baseSvg?.sizeMin) || 0.0001);
        sAny.sizeMax = Number.isFinite(sMax) ? Math.max(sAny.sizeMin, sMax) : Math.max(sAny.sizeMin, Number(baseSvg?.sizeMax) || sAny.sizeMin);
        const ed = Number(sAny.extrudeDepth);
        sAny.extrudeDepth = Number.isFinite(ed) ? Math.max(0.000001, ed) : Math.max(0.000001, Number(baseSvg?.extrudeDepth) || 0.000001);
        if (!sAny.bevel || typeof sAny.bevel !== 'object') sAny.bevel = cloneJson(baseSvg?.bevel);
        sAny.bevel.enabled = typeof sAny.bevel.enabled === 'boolean' ? sAny.bevel.enabled : !!sAny.bevel.enabled;
        const bs = Number(sAny.bevel.size);
        sAny.bevel.size = Number.isFinite(bs) ? clamp(bs, 0, 0.2) : clamp(Number(baseSvg?.bevel?.size) || 0, 0, 0.2);
        const seg = Number(sAny.bevel.segments);
        sAny.bevel.segments = Number.isFinite(seg) ? Math.max(0, Math.min(8, Math.round(seg))) : Math.max(0, Math.min(8, Math.round(Number(baseSvg?.bevel?.segments) || 0)));
        sAny.paletteMode = sAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
        if (!Array.isArray(sAny.colorWeights)) sAny.colorWeights = Array.isArray(baseSvg?.colorWeights) ? baseSvg.colorWeights.slice() : [];
        const op = Number(sAny.opacity);
        sAny.opacity = Number.isFinite(op) ? clamp(op, 0, 1) : clamp(Number(baseSvg?.opacity) || 1, 0, 1);
      }
    }
  }

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

  const textures: TextureType[] = ['glossy', 'matte', 'metallic', 'drywall', 'glass', 'mirror', 'cel'];

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

  const emissionEnabled = chance(0.22);
  const bloomEnabled = chance(0.35);

  const is3DType = type === 'popsicle' || type === 'spheres3d' || type === 'triangles3d' || type === 'svg3d';

  // Rare: procedural cavity cutouts (raster-only; best-effort for other renderers).
  const gruyereEnabled = (type === 'popsicle' || type === 'spheres3d') && chance(0.035);

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
    texture: textures[Math.floor(rng() * textures.length)],
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
    backgroundColor: theme.backgroundColor,
    facades: (() => {
      const tintEnabled = chance(0.18);
      const materialEnabled = chance(0.18);
      const wearEnabled = chance(0.12);
      const rimEnabled = chance(0.25);

      const sideEnabled = tintEnabled || materialEnabled;
      const grazingEnabled = wearEnabled || rimEnabled;
      const grazingMode: GrazingMode = rimEnabled && !wearEnabled ? 'add' : wearEnabled && !rimEnabled ? 'mix' : chance(0.5) ? 'add' : 'mix';

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
          enabled: chance(0.10),
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
    gruyere: {
      enabled: gruyereEnabled,
      // frequency controls density; count is the sample budget in shader.
      frequency: gruyereEnabled ? clamp(tri(1.1, 1.8, 3.2), 0.1, 20) : DEFAULT_POPSICLE_CONFIG.gruyere.frequency,
      count: gruyereEnabled ? Math.max(3, Math.min(8, Math.round(tri(4, 6, 8)))) : DEFAULT_POPSICLE_CONFIG.gruyere.count,
      radiusMin: gruyereEnabled ? clamp(tri(0.06, 0.12, 0.22), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.gruyere.radiusMin,
      radiusMax: gruyereEnabled ? clamp(tri(0.18, 0.32, 0.55), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.gruyere.radiusMax,
      softness: gruyereEnabled ? clamp(tri(0.0, 0.05, 0.12), 0.0, 2) : DEFAULT_POPSICLE_CONFIG.gruyere.softness,
      strength: gruyereEnabled ? clamp(tri(0.75, 1.0, 1.0), 0.0, 1) : DEFAULT_POPSICLE_CONFIG.gruyere.strength,
      seedOffset: gruyereEnabled ? Math.round(tri(-50, 0, 50)) : DEFAULT_POPSICLE_CONFIG.gruyere.seedOffset
    },
    emission: {
      enabled: emissionEnabled,
      paletteIndex: Math.floor(rng() * Math.max(1, theme.colors.length)),
      intensity: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.emission.intensity, 14), 0, 20)
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

  switch (type) {
    case 'spheres3d':
      {
        const useSpherifiedBox = chance(0.22);
        const shape = useSpherifiedBox
          ? (() => {
              // Bias to "good looking": fairly round + some faceting; allow rare cubes.
              const cubeish = chance(0.08);
              const roundness = cubeish ? clamp(tri(0.0, 0.12, 0.55), 0, 1) : clamp(tri(0.35, 0.9, 1.0), 0, 1);
              const faceting = cubeish ? clamp(tri(0.75, 1.0, 1.0), 0, 1) : clamp(tri(0.05, 0.55, 1.0), 0, 1);
              return { kind: 'spherifiedBox' as const, roundness, faceting };
            })()
          : { kind: 'uvSphere' as const, roundness: 1, faceting: 0 };

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
    case 'circles2d':
      return {
        ...base,
        bloom: base.emission.enabled ? { ...base.bloom, enabled: true } : { ...base.bloom },
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
      return {
        ...base,
        bloom: base.emission.enabled ? { ...base.bloom, enabled: true } : { ...base.bloom },
        type: 'polygon2d',
        polygons: {
          count: skewCountLow(10, DEFAULT_POLYGON2D_CONFIG.polygons.count, 420, 1600, 0.03),
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
        bloom: base.emission.enabled ? { ...base.bloom, enabled: true } : { ...base.bloom },
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
      {
        const bulgeX = clamp(tri(-1, 0, 1), -1, 1);
        const bulgeY = chance(0.65) ? bulgeX : clamp(tri(-1, 0, 1), -1, 1);

        return {
        ...base,
        type: 'triangles3d',
        prisms: {
          mode: 'stackedPrisms',
          count: skewCountLow(10, DEFAULT_TRIANGLES3D_CONFIG.prisms.count, 360, 1500, 0.03),
          base: rng() < 0.72 ? 'triangle' : 'square',
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
        bloom: base.emission.enabled ? { ...base.bloom, enabled: true } : { ...base.bloom },
        type: 'svg2d',
        svg: {
          source: DEFAULT_SVG_SOURCE,
          count: skewCountLow(10, DEFAULT_SVG2D_CONFIG.svg.count, 420, 1600, 0.03),
          rMinPx: Math.round(randomWeighted(rng, 6, 40, DEFAULT_SVG2D_CONFIG.svg.rMinPx)),
          rMaxPx: Math.round(randomWeighted(rng, 30, 280, DEFAULT_SVG2D_CONFIG.svg.rMaxPx)),
          jitter: clamp(randomWeighted(rng, 0, 1, DEFAULT_SVG2D_CONFIG.svg.jitter), 0, 1),
          rotateJitterDeg: randomWeighted(rng, 0, 360, DEFAULT_SVG2D_CONFIG.svg.rotateJitterDeg),
          fillOpacity: clamp(randomWeighted(rng, 0.2, 1, DEFAULT_SVG2D_CONFIG.svg.fillOpacity), 0, 1),
          stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
          paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
          colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
        }
      };
    case 'svg3d':
      return {
        ...base,
        type: 'svg3d',
        svg: {
          source: DEFAULT_SVG_SOURCE,
          count: skewCountLow(10, DEFAULT_SVG3D_CONFIG.svg.count, 360, 1500, 0.03),
          spread: randomWeighted(rng, 0.8, 6.5, DEFAULT_SVG3D_CONFIG.svg.spread),
          depth: randomWeighted(rng, 0.5, 7.0, DEFAULT_SVG3D_CONFIG.svg.depth),
          sizeMin: randomWeighted(rng, 0.05, 0.32, DEFAULT_SVG3D_CONFIG.svg.sizeMin),
          sizeMax: randomWeighted(rng, 0.14, 0.9, DEFAULT_SVG3D_CONFIG.svg.sizeMax),
          extrudeDepth: randomWeighted(rng, 0.02, 0.6, DEFAULT_SVG3D_CONFIG.svg.extrudeDepth),
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
    case 'hexgrid2d':
      return {
        ...base,
        emission: { ...base.emission, enabled: false },
        bloom: { ...base.bloom, enabled: false },
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
            // Grouping is visually strong and can be expensive; keep it less common.
            mode: rng() < 0.55 ? 'none' : (rng() < 0.70 ? 'noise' : rng() < 0.86 ? 'voronoi' : 'random-walk'),
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

        return {
          ...base,
          type: 'ridges2d',
          emission: { ...base.emission, enabled: false },
          bloom: { ...base.bloom, enabled: false },
          collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
          ridges: {
            gridStepPx: stepPx,
            frequency: clamp(tri(0.6, DEFAULT_RIDGES2D_CONFIG.ridges.frequency, 5.5), 0.05, 50),
            octaves: oct,
            warpAmount: clamp(tri(0.0, DEFAULT_RIDGES2D_CONFIG.ridges.warpAmount, 2.4), 0, 50),
            warpFrequency: clamp(tri(0.2, DEFAULT_RIDGES2D_CONFIG.ridges.warpFrequency, 4.0), 0.01, 50),
            levels,
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
      const endProfileR = rng();
      const stickEndProfile: PopsicleConfig['stickEndProfile'] = endProfileR < 0.72 ? 'rounded' : endProfileR < 0.90 ? 'chamfer' : 'chipped';

      const seamEnabled = rng() < 0.16;
      const bandEnabled = rng() < 0.10;
      const hollow = rng() < 0.10;
      const edgeEmissiveSeam = seamEnabled && rng() < 0.10;
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
          ...base.edge,
          hollow,
          seam: {
            ...base.edge.seam,
            enabled: seamEnabled,
            color: edgeEmissiveSeam ? pickEdgeColor() : '#0b0b10',
            opacity: seamEnabled ? clamp(tri(0.15, base.edge.seam.opacity, 1.0), 0, 1) : base.edge.seam.opacity,
            width: seamEnabled ? clamp(tri(0, 0.012, 0.08), 0, 0.12) : base.edge.seam.width,
            noise: seamEnabled ? clamp(tri(0, 0.15, 0.9), 0, 1) : base.edge.seam.noise,
            emissiveIntensity: edgeEmissiveSeam ? clamp(tri(0.25, 2.0, 8), 0, 20) : 0
          },
          band: {
            ...base.edge.band,
            enabled: bandEnabled,
            color: edgeEmissiveBand ? pickEdgeColor() : '#ffffff',
            opacity: bandEnabled ? clamp(tri(0.05, base.edge.band.opacity, 0.75), 0, 1) : base.edge.band.opacity,
            width: bandEnabled ? clamp(tri(0, base.edge.band.width, 0.22), 0, 0.25) : base.edge.band.width,
            noise: bandEnabled ? clamp(tri(0, 0.1, 0.75), 0, 1) : base.edge.band.noise,
            emissiveIntensity: edgeEmissiveBand ? clamp(tri(0.25, 1.5, 7), 0, 20) : 0
          }
        }
      };
  }
}
