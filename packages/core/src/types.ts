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

export type SvgRenderMode = 'auto' | 'fill' | 'stroke' | 'fill+stroke';

export type SvgColorMode = 'palette' | 'svg-to-palette';

export type Spheres3DShapeKind = 'uvSphere' | 'spherifiedBox' | 'geodesicPoly';

export interface Spheres3DShapeConfig {
  kind: Spheres3DShapeKind;
  /**
   * 0..1: when `kind='spherifiedBox'` this blends cube -> sphere, and when
   * `kind='geodesicPoly'` it controls subdivision/detail for the faceted poly.
   */
  roundness: number;
  /**
   * 0..1: when `kind='spherifiedBox'` it toggles smooth vs faceted interpolation,
   * and when `kind='geodesicPoly'` it controls how strongly facets are preserved.
   */
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
    /** Shape mode: prism, pyramid with triangular base, or pyramid with square base */
    base: 'prism' | 'pyramidTri' | 'pyramidSquare';
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
    /** Frequency of the high-frequency detail FBM layer */
    detailFrequency: number;
    /** Strength/amplitude of the detail layer (0..1) */
    detailAmplitude: number;
    /** Fractal octaves (1..8 recommended) */
    octaves: number;
    /** Domain warp amount in noise-space units */
    warpAmount: number;
    /** 0..1: blend between coarse warp (0) and high-frequency warp (1) */
    warpDepth: number;
    /** Domain warp frequency multiplier */
    warpFrequency: number;
    /** Contrast multiplier applied after normalization */
    contrast: number;
    /** Bias offset added after contrast (positive = brighten overall) */
    bias: number;
    /** Number of contour levels */
    levels: number;
    /** 0..0.3: per-level threshold jitter for marching squares */
    levelJitter: number;
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

export type Bands2DMode = 'straight' | 'waves' | 'chevron';

export interface Bands2DConfig extends BaseWallpaperConfig {
  type: 'bands2d';
  bands: {
    mode: Bands2DMode;
    seedOffset: number;
    angleDeg: number;
    bandWidthPx: number;
    gapPx: number;
    offsetPx: number;
    jitterPx: number;
    fill: {
      enabled: boolean;
      /** 0..1 */
      opacity: number;
    };
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
    };
    waves: {
      amplitudePx: number;
      wavelengthPx: number;
      /** 0..1 */
      noiseAmount: number;
      noiseScale: number;
    };
    chevron: {
      amplitudePx: number;
      wavelengthPx: number;
      /** 0.1..8 */
      sharpness: number;
    };
    paletteMode: PaletteAssignMode;
    /** Per-palette weights (used when paletteMode=weighted). Length may be < colors.length. */
    colorWeights: number[];
  };
}

export type Flowlines2DSpawn = 'grid' | 'random';

export interface Flowlines2DConfig extends BaseWallpaperConfig {
  type: 'flowlines2d';
  flowlines: {
    seedOffset: number;
    frequency: number;
    octaves: number;
    warpAmount: number;
    warpFrequency: number;
    strength: number;
    epsilonPx: number;

    spawn: Flowlines2DSpawn;
    /** 0..1: higher = more seeds */
    density: number;
    /** Scene units in pixels: coarse collision/packing control */
    spacingPx: number;
    marginPx: number;
    stepPx: number;
    maxSteps: number;
    maxLines: number;
    minLengthPx: number;
    /** 0..1 */
    jitter: number;

    stroke: {
      widthPx: number;
      /** 0..1 */
      opacity: number;
      /** 0..1 */
      taper: number;
    };

    paletteMode: PaletteAssignMode;
    /** Per-palette weights (used when paletteMode=weighted). Length may be < colors.length. */
    colorWeights: number[];
    /** 0..1 */
    colorJitter: number;
  };
}

export interface DiamondGrid2DConfig extends BaseWallpaperConfig {
  type: 'diamondgrid2d';
  diamondgrid: {
    tileWidthPx: number;
    tileHeightPx: number;
    marginPx: number;
    originPx: { x: number; y: number };
    overscanPx: number;
    /** 0..1 */
    fillOpacity: number;
    stroke: {
      enabled: boolean;
      widthPx: number;
      color: string;
      /** 0..1 */
      opacity: number;
      join: 'round' | 'miter' | 'bevel';
    };
    coloring: {
      paletteMode: PaletteAssignMode;
      /** Per-palette weights (used when paletteMode=weighted). Length may be < colors.length. */
      colorWeights: number[];
    };
    bevel: {
      enabled: boolean;
      /** 0..1 */
      amount: number;
      lightDeg: number;
      /** 0..1 */
      variation: number;
    };
    sparkles: {
      enabled: boolean;
      /** 0..1 */
      density: number;
      countMax: number;
      sizeMinPx: number;
      sizeMaxPx: number;
      /** 0..1 */
      opacity: number;
      color: string;
    };
  };
}

export interface Svg2DConfig extends BaseWallpaperConfig {
  type: 'svg2d';
  svg: {
    /** Raw SVG source string */
    source: string;
    /** How to render the SVG paths. */
    renderMode: SvgRenderMode;
    /** How to pick colors for the SVG. */
    colorMode: SvgColorMode;
    /** Maximum number of tones extracted when colorMode='svg-to-palette'. */
    maxTones: number;
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
    /** How to render the SVG paths. */
    renderMode: SvgRenderMode;
    /** How to pick colors for the SVG. */
    colorMode: SvgColorMode;
    /** Maximum number of tones extracted when colorMode='svg-to-palette'. */
    maxTones: number;
    count: number;
    /** Scene units: XY spread */
    spread: number;
    /** Scene units: Z spread */
    depth: number;
    /** 0..80: per-instance random tilt range (degrees); 0 = upright */
    tiltDeg: number;
    /** Base rotation around Z axis (degrees) */
    rotateDeg: number;
    /** 0..3600: per-instance random Z rotation range (degrees); 0 = fixed */
    rotateJitterDeg: number;
    /** Scene units: overall XY size */
    sizeMin: number;
    /** Scene units: overall XY size */
    sizeMax: number;
    /** Scene units: extrusion depth (independent of size) */
    extrudeDepth: number;
    /** Stroke rendering parameters (used when renderMode includes stroke). */
    stroke: {
      enabled: boolean;
      /** Scene units: approximate half-thickness of the stroke mesh. */
      radius: number;
      /** 1..12: stroke triangulation quality. */
      segments: number;
      /** 0..1 */
      opacity: number;
    };
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
  | Bands2DConfig
  | Flowlines2DConfig
  | DiamondGrid2DConfig
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
  palette: { overrides: [] },
  texture: 'glossy',
  textureParams: {
    drywall: { grainAmount: 0.65, grainScale: 2.5 },
    glass: { style: 'simple' },
    cel: { bands: 4, halftone: false }
  },
  voronoi: {
    enabled: false,
    space: 'world',
    kind: 'edges',
    scale: 4.8,
    seedOffset: 0,
    amount: 0.82,
    edgeWidth: 0.16,
    softness: 0.42,
    colorStrength: 0.25,
    colorMode: 'darken',
    tintColor: '#ffffff',
    materialMode: 'both',
    materialKind: 'match',
    roughnessStrength: 0.42,
    normalStrength: 0.34,
    normalScale: 0.52,
    crackleAmount: 0,
    crackleScale: 14,
    nucleus: {
      enabled: false,
      size: 0.09,
      softness: 0.28,
      strength: 0.7,
      color: '#ffffff'
    }
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
  bubbles: {
    enabled: false,
    mode: 'through',
    interior: { enabled: true },
    frequency: 1.8,
    frequencyVariance: 0.22,
    count: 8,
    radiusMin: 0.12,
    radiusMax: 0.38,
    softness: 0.06,
    wallThickness: 0.08,
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
    base: 'prism',
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
    detailFrequency: 7.5,
    detailAmplitude: 0.18,
    octaves: 5,
    warpAmount: 0.85,
    warpDepth: 0.25,
    warpFrequency: 1.6,
    contrast: 1.1,
    bias: -0.03,
    levels: 14,
    levelJitter: 0.08,
    lineWidthPx: 1.25,
    lineOpacity: 0.6,
    smoothing: 0.35,
    fillBands: { enabled: true, opacity: 0.18 },
    paletteMode: 'weighted',
    colorWeights: [0.58, 0.18, 0.12, 0.08, 0.04]
  }
};

export const DEFAULT_BANDS2D_CONFIG: Bands2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'bands2d',
  // Keep this generator crisp by default.
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: { ...DEFAULT_POPSICLE_CONFIG.collisions, mode: 'none', carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve } },
  bands: {
    mode: 'waves',
    seedOffset: 0,
    angleDeg: 22,
    bandWidthPx: 120,
    gapPx: 28,
    offsetPx: 0,
    jitterPx: 0,
    fill: { enabled: true, opacity: 1.0 },
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.65 },
    waves: {
      amplitudePx: 36,
      wavelengthPx: 520,
      noiseAmount: 0.25,
      noiseScale: 0.9
    },
    chevron: {
      amplitudePx: 68,
      wavelengthPx: 260,
      sharpness: 1.4
    },
    paletteMode: 'cycle',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_FLOWLINES2D_CONFIG: Flowlines2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'flowlines2d',
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: { ...DEFAULT_POPSICLE_CONFIG.collisions, mode: 'none', carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve } },
  flowlines: {
    seedOffset: 0,
    frequency: 2.4,
    octaves: 3,
    warpAmount: 0.55,
    warpFrequency: 1.8,
    strength: 1.0,
    epsilonPx: 1.0,

    spawn: 'grid',
    density: 0.9,
    spacingPx: 6,
    marginPx: 18,
    stepPx: 1.15,
    maxSteps: 240,
    maxLines: 2600,
    minLengthPx: 26,
    jitter: 1.0,

    stroke: {
      widthPx: 1.2,
      opacity: 0.22,
      taper: 0.25
    },

    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    colorJitter: 0.12
  }
};

export const DEFAULT_DIAMONDGRID2D_CONFIG: DiamondGrid2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'diamondgrid2d',
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: { ...DEFAULT_POPSICLE_CONFIG.collisions, mode: 'none', carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve } },
  diamondgrid: {
    tileWidthPx: 120,
    tileHeightPx: 60,
    marginPx: 2,
    originPx: { x: 0, y: 0 },
    overscanPx: 64,
    fillOpacity: 0.96,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
    coloring: { paletteMode: 'weighted', colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08] },
    bevel: { enabled: true, amount: 0.48, lightDeg: 315, variation: 0.15 },
    sparkles: { enabled: false, density: 0.03, countMax: 2, sizeMinPx: 1.0, sizeMaxPx: 10.0, opacity: 0.28, color: '#ffffff' }
  }
};

export const DEFAULT_SVG_SOURCE =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-app-window-icon lucide-app-window"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>`;

export const DEFAULT_SVG2D_CONFIG: Svg2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg2d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    renderMode: 'auto',
    colorMode: 'palette',
    maxTones: 8,
    count: 220,
    rMinPx: 18,
    rMaxPx: 150,
    jitter: 1.0,
    rotateJitterDeg: 180,
    fillOpacity: 0.95,
    // Default stroke-on helps outline icons (Lucide etc.) read correctly under auto mode.
    stroke: { enabled: true, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_SVG3D_CONFIG: Svg3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg3d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    renderMode: 'auto',
    colorMode: 'palette',
    maxTones: 8,
    count: 160,
    spread: 4.4,
    depth: 4.0,
    tiltDeg: 0,
    rotateDeg: 0,
    rotateJitterDeg: 360,
    sizeMin: 0.14,
    sizeMax: 0.5,
    extrudeDepth: 0.22,
    stroke: { enabled: true, radius: 0.03, segments: 6, opacity: 1.0 },
    bevel: { enabled: true, size: 0.06, segments: 2 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_CONFIG_BY_TYPE: Record<WallpaperType, WallpaperConfig> = {
  popsicle: DEFAULT_POPSICLE_CONFIG,
  spheres3d: DEFAULT_SPHERES3D_CONFIG,
  bands2d: DEFAULT_BANDS2D_CONFIG,
  flowlines2d: DEFAULT_FLOWLINES2D_CONFIG,
  diamondgrid2d: DEFAULT_DIAMONDGRID2D_CONFIG,
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

  // Bubbles config validation.
  const baseBubbles: any = (base as any).bubbles;
  const gAny: any = (merged as any).bubbles;
  if (!gAny || typeof gAny !== 'object') {
    (merged as any).bubbles = cloneJson(baseBubbles);
  } else {
    gAny.enabled = typeof gAny.enabled === 'boolean' ? gAny.enabled : !!gAny.enabled;

    gAny.mode = gAny.mode === 'cap' ? 'cap' : 'through';

    if (!gAny.interior || typeof gAny.interior !== 'object') gAny.interior = cloneJson(baseBubbles.interior);
    gAny.interior.enabled = typeof gAny.interior.enabled === 'boolean' ? gAny.interior.enabled : !!gAny.interior.enabled;

    const freq = Number(gAny.frequency);
    gAny.frequency = Number.isFinite(freq) ? clamp(freq, 0, 20) : Number(baseBubbles.frequency) || 0;
    const variance = Number(gAny.frequencyVariance);
    gAny.frequencyVariance = Number.isFinite(variance)
      ? clamp(variance, 0, 1)
      : clamp(Number(baseBubbles.frequencyVariance) || 0, 0, 1);
    const cnt = Number(gAny.count);
    gAny.count = Number.isFinite(cnt) ? Math.max(0, Math.min(16, Math.round(cnt))) : Math.round(Number(baseBubbles.count) || 0);
    const rMin = Number(gAny.radiusMin);
    const rMax = Number(gAny.radiusMax);
    gAny.radiusMin = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseBubbles.radiusMin) || 0);
    gAny.radiusMax = Number.isFinite(rMax) ? Math.max(gAny.radiusMin, rMax) : Math.max(gAny.radiusMin, Number(baseBubbles.radiusMax) || gAny.radiusMin);
    const soft = Number(gAny.softness);
    gAny.softness = Number.isFinite(soft) ? clamp(soft, 0, 2) : Math.max(0, Number(baseBubbles.softness) || 0);
    const wall = Number(gAny.wallThickness);
    gAny.wallThickness = Number.isFinite(wall)
      ? clamp(wall, 0, 1)
      : Math.max(0, Number(baseBubbles.wallThickness) || 0);
    const so = Number(gAny.seedOffset);
    gAny.seedOffset = Number.isFinite(so) ? so : Number(baseBubbles.seedOffset) || 0;
  }

  // Voronoi config validation.
  const baseVor: any = (base as any).voronoi;
  const vAny: any = (merged as any).voronoi;
  if (!vAny || typeof vAny !== 'object') {
    (merged as any).voronoi = cloneJson(baseVor);
  } else {
    vAny.enabled = typeof vAny.enabled === 'boolean' ? vAny.enabled : !!vAny.enabled;
    vAny.space = vAny.space === 'object' ? 'object' : 'world';
    vAny.kind = vAny.kind === 'cells' ? 'cells' : 'edges';
    const sc = Number(vAny.scale);
    vAny.scale = Number.isFinite(sc) ? clamp(sc, 0, 80) : clamp(Number(baseVor?.scale) || 0, 0, 80);
    const so = Number(vAny.seedOffset);
    vAny.seedOffset = Number.isFinite(so) ? so : Number(baseVor?.seedOffset) || 0;
    const amt = Number(vAny.amount);
    vAny.amount = Number.isFinite(amt) ? clamp(amt, 0, 1) : clamp(Number(baseVor?.amount) || 0, 0, 1);
    const ew = Number(vAny.edgeWidth);
    vAny.edgeWidth = Number.isFinite(ew) ? clamp(ew, 0, 1) : clamp(Number(baseVor?.edgeWidth) || 0, 0, 1);
    const sf = Number(vAny.softness);
    vAny.softness = Number.isFinite(sf) ? clamp(sf, 0, 1) : clamp(Number(baseVor?.softness) || 0, 0, 1);
    const cs = Number(vAny.colorStrength);
    vAny.colorStrength = Number.isFinite(cs) ? clamp(cs, 0, 1) : clamp(Number(baseVor?.colorStrength) || 0, 0, 1);
    const cm = String(vAny.colorMode ?? baseVor?.colorMode ?? 'darken');
    vAny.colorMode = cm === 'lighten' ? 'lighten' : cm === 'tint' ? 'tint' : 'darken';
    if (typeof vAny.tintColor !== 'string') vAny.tintColor = String(vAny.tintColor ?? baseVor?.tintColor ?? '#ffffff');
    const mm = String(vAny.materialMode ?? baseVor?.materialMode ?? 'both');
    vAny.materialMode = mm === 'none' ? 'none' : mm === 'roughness' ? 'roughness' : mm === 'normal' ? 'normal' : 'both';

    const mk = String(vAny.materialKind ?? baseVor?.materialKind ?? 'match');
    vAny.materialKind = mk === 'cells' ? 'cells' : mk === 'edges' ? 'edges' : 'match';
    const rs = Number(vAny.roughnessStrength);
    vAny.roughnessStrength = Number.isFinite(rs) ? clamp(rs, 0, 1) : clamp(Number(baseVor?.roughnessStrength) || 0, 0, 1);
    const ns = Number(vAny.normalStrength);
    vAny.normalStrength = Number.isFinite(ns) ? clamp(ns, 0, 1) : clamp(Number(baseVor?.normalStrength) || 0, 0, 1);
    const nsc = Number(vAny.normalScale);
    vAny.normalScale = Number.isFinite(nsc) ? clamp(nsc, 0, 1) : clamp(Number(baseVor?.normalScale) || 0, 0, 1);

    const ca = Number(vAny.crackleAmount);
    vAny.crackleAmount = Number.isFinite(ca) ? clamp(ca, 0, 1) : clamp(Number(baseVor?.crackleAmount) || 0, 0, 1);
    const csc = Number(vAny.crackleScale);
    vAny.crackleScale = Number.isFinite(csc) ? clamp(csc, 0, 200) : clamp(Number(baseVor?.crackleScale) || 0, 0, 200);

    const baseNucleus: any = baseVor?.nucleus;
    if (!vAny.nucleus || typeof vAny.nucleus !== 'object') {
      vAny.nucleus = cloneJson(baseNucleus);
    } else {
      vAny.nucleus.enabled = typeof vAny.nucleus.enabled === 'boolean' ? vAny.nucleus.enabled : !!vAny.nucleus.enabled;
      const ns0 = Number(vAny.nucleus.size);
      vAny.nucleus.size = Number.isFinite(ns0) ? clamp(ns0, 0, 1) : clamp(Number(baseNucleus?.size) || 0, 0, 1);
      const nsoft = Number(vAny.nucleus.softness);
      vAny.nucleus.softness = Number.isFinite(nsoft) ? clamp(nsoft, 0, 1) : clamp(Number(baseNucleus?.softness) || 0, 0, 1);
      const nstr = Number(vAny.nucleus.strength);
      vAny.nucleus.strength = Number.isFinite(nstr) ? clamp(nstr, 0, 1) : clamp(Number(baseNucleus?.strength) || 0, 0, 1);
      if (typeof vAny.nucleus.color !== 'string') vAny.nucleus.color = String(vAny.nucleus.color ?? baseNucleus?.color ?? '#ffffff');
    }
  }

  const edgeObj: any = (merged as any).edge;
  if (!edgeObj || typeof edgeObj !== 'object') {
    (merged as any).edge = cloneJson((base as any).edge);
  } else {
    if (!edgeObj.seam || typeof edgeObj.seam !== 'object') edgeObj.seam = cloneJson((base as any).edge.seam);
    if (!edgeObj.band || typeof edgeObj.band !== 'object') edgeObj.band = cloneJson((base as any).edge.band);
  }

  // Palette overrides validation.
  const pAny: any = (merged as any).palette;
  if (!pAny || typeof pAny !== 'object') {
    (merged as any).palette = { overrides: [] };
  } else {
    if (!Array.isArray(pAny.overrides)) pAny.overrides = [];
    pAny.overrides = pAny.overrides
      .map((v: any) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
        const enabled = typeof v.enabled === 'boolean' ? v.enabled : !!v.enabled;
        const freqRaw = Number(v.frequency);
        const frequency = Number.isFinite(freqRaw) ? clamp(freqRaw, 0, 1) : undefined;
        return { ...v, enabled, frequency };
      })
      .filter((v: any) => v === null || (v && typeof v === 'object'));
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
      if (prisms.base !== 'prism' && prisms.base !== 'pyramidTri' && prisms.base !== 'pyramidSquare') prisms.base = 'prism';
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

      const rmRaw = String(sAny.renderMode ?? baseSvg?.renderMode ?? 'auto');
      sAny.renderMode = rmRaw === 'fill' || rmRaw === 'stroke' || rmRaw === 'fill+stroke' ? rmRaw : 'auto';

      const cmRaw = String(sAny.colorMode ?? baseSvg?.colorMode ?? 'palette');
      sAny.colorMode = cmRaw === 'svg-to-palette' ? 'svg-to-palette' : 'palette';

      const mt = Number(sAny.maxTones);
      sAny.maxTones = Number.isFinite(mt) ? Math.max(1, Math.min(64, Math.round(mt))) : Math.max(1, Math.min(64, Math.round(Number(baseSvg?.maxTones) || 8)));

      const cnt = Number(sAny.count);
      sAny.count = Number.isFinite(cnt)
        ? Math.max(1, Math.round(cnt))
        : Math.max(1, Math.round(Number(baseSvg?.count) || 0));
      if ((merged as any).type === 'svg2d') {
        const rMin = Number(sAny.rMinPx);
        const rMax = Number(sAny.rMaxPx);
        sAny.rMinPx = Number.isFinite(rMin) ? Math.max(0, rMin) : Math.max(0, Number(baseSvg?.rMinPx) || 0);
        sAny.rMaxPx = Number.isFinite(rMax) ? Math.max(sAny.rMinPx, rMax) : Math.max(sAny.rMinPx, Number(baseSvg?.rMaxPx) || sAny.rMinPx);
        sAny.jitter = Number.isFinite(Number(sAny.jitter)) ? clamp(Number(sAny.jitter), 0, 1) : clamp(Number(baseSvg?.jitter) || 0, 0, 1);
        sAny.rotateJitterDeg = Number.isFinite(Number(sAny.rotateJitterDeg)) ? Number(sAny.rotateJitterDeg) : Number(baseSvg?.rotateJitterDeg) || 0;
        sAny.fillOpacity = Number.isFinite(Number(sAny.fillOpacity)) ? clamp(Number(sAny.fillOpacity), 0, 1) : clamp(Number(baseSvg?.fillOpacity) || 0, 0, 1);
        if (!sAny.stroke || typeof sAny.stroke !== 'object') sAny.stroke = cloneJson(baseSvg?.stroke);
        sAny.stroke.enabled = typeof sAny.stroke.enabled === 'boolean' ? sAny.stroke.enabled : !!sAny.stroke.enabled;
        const sw = Number(sAny.stroke.widthPx);
        sAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseSvg?.stroke?.widthPx) || 0);
        if (typeof sAny.stroke.color !== 'string') sAny.stroke.color = String(sAny.stroke.color ?? baseSvg?.stroke?.color ?? '#000000');
        const so = Number(sAny.stroke.opacity);
        sAny.stroke.opacity = Number.isFinite(so) ? clamp(so, 0, 1) : clamp(Number(baseSvg?.stroke?.opacity) || 0, 0, 1);
        sAny.paletteMode = sAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
        if (!Array.isArray(sAny.colorWeights)) sAny.colorWeights = Array.isArray(baseSvg?.colorWeights) ? baseSvg.colorWeights.slice() : [];
      } else {
        const spread = Number(sAny.spread);
        const depth = Number(sAny.depth);
        sAny.spread = Number.isFinite(spread) ? Math.max(0, spread) : Math.max(0, Number(baseSvg?.spread) || 0);
        sAny.depth = Number.isFinite(depth) ? Math.max(0, depth) : Math.max(0, Number(baseSvg?.depth) || 0);

        const tilt = Number(sAny.tiltDeg);
        sAny.tiltDeg = Number.isFinite(tilt)
          ? clamp(tilt, 0, 80)
          : clamp(Number(baseSvg?.tiltDeg) || 0, 0, 80);

        const rot = Number(sAny.rotateDeg);
        sAny.rotateDeg = Number.isFinite(rot) ? rot : Number(baseSvg?.rotateDeg) || 0;
        const rj = Number(sAny.rotateJitterDeg);
        sAny.rotateJitterDeg = Number.isFinite(rj) ? clamp(rj, 0, 3600) : clamp(Number(baseSvg?.rotateJitterDeg) || 0, 0, 3600);

        const sMin = Number(sAny.sizeMin);
        const sMax = Number(sAny.sizeMax);
        sAny.sizeMin = Number.isFinite(sMin) ? Math.max(0.0001, sMin) : Math.max(0.0001, Number(baseSvg?.sizeMin) || 0.0001);
        sAny.sizeMax = Number.isFinite(sMax) ? Math.max(sAny.sizeMin, sMax) : Math.max(sAny.sizeMin, Number(baseSvg?.sizeMax) || sAny.sizeMin);
        const ed = Number(sAny.extrudeDepth);
        sAny.extrudeDepth = Number.isFinite(ed) ? Math.max(0.000001, ed) : Math.max(0.000001, Number(baseSvg?.extrudeDepth) || 0.000001);

        if (!sAny.stroke || typeof sAny.stroke !== 'object') sAny.stroke = cloneJson(baseSvg?.stroke);
        sAny.stroke.enabled = typeof sAny.stroke.enabled === 'boolean' ? sAny.stroke.enabled : !!sAny.stroke.enabled;
        const sr = Number(sAny.stroke.radius);
        sAny.stroke.radius = Number.isFinite(sr) ? Math.max(0.000001, sr) : Math.max(0.000001, Number(baseSvg?.stroke?.radius) || 0.000001);
        const sseg = Number(sAny.stroke.segments);
        sAny.stroke.segments = Number.isFinite(sseg) ? Math.max(1, Math.min(12, Math.round(sseg))) : Math.max(1, Math.min(12, Math.round(Number(baseSvg?.stroke?.segments) || 6)));
        const sop = Number(sAny.stroke.opacity);
        sAny.stroke.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseSvg?.stroke?.opacity) || 1, 0, 1);

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

  // Basic bands2d config validation.
  if ((merged as any).type === 'bands2d') {
    const baseBands: any = (base as any).bands;
    const bAny: any = (merged as any).bands;
    if (!bAny || typeof bAny !== 'object') {
      (merged as any).bands = cloneJson(baseBands);
    } else {
      const modeRaw = String(bAny.mode ?? baseBands?.mode ?? 'straight');
      bAny.mode = modeRaw === 'waves' || modeRaw === 'chevron' ? modeRaw : 'straight';
      const so = Number(bAny.seedOffset);
      bAny.seedOffset = Number.isFinite(so) ? Math.round(so) : Math.round(Number(baseBands?.seedOffset) || 0);
      const ang = Number(bAny.angleDeg);
      bAny.angleDeg = Number.isFinite(ang) ? ang : Number(baseBands?.angleDeg) || 0;
      const bw = Number(bAny.bandWidthPx);
      bAny.bandWidthPx = Number.isFinite(bw) ? Math.max(0.1, bw) : Math.max(0.1, Number(baseBands?.bandWidthPx) || 1);
      const gp = Number(bAny.gapPx);
      bAny.gapPx = Number.isFinite(gp) ? Math.max(0, gp) : Math.max(0, Number(baseBands?.gapPx) || 0);
      const off = Number(bAny.offsetPx);
      bAny.offsetPx = Number.isFinite(off) ? off : Number(baseBands?.offsetPx) || 0;
      const jit = Number(bAny.jitterPx);
      bAny.jitterPx = Number.isFinite(jit) ? Math.max(0, jit) : Math.max(0, Number(baseBands?.jitterPx) || 0);

      if (!bAny.fill || typeof bAny.fill !== 'object') bAny.fill = cloneJson(baseBands?.fill);
      bAny.fill.enabled = typeof bAny.fill.enabled === 'boolean' ? bAny.fill.enabled : !!bAny.fill.enabled;
      const fo = Number(bAny.fill.opacity);
      bAny.fill.opacity = Number.isFinite(fo) ? clamp(fo, 0, 1) : clamp(Number(baseBands?.fill?.opacity) || 0, 0, 1);

      if (!bAny.stroke || typeof bAny.stroke !== 'object') bAny.stroke = cloneJson(baseBands?.stroke);
      bAny.stroke.enabled = typeof bAny.stroke.enabled === 'boolean' ? bAny.stroke.enabled : !!bAny.stroke.enabled;
      const sw = Number(bAny.stroke.widthPx);
      bAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseBands?.stroke?.widthPx) || 0);
      if (typeof bAny.stroke.color !== 'string') bAny.stroke.color = String(bAny.stroke.color ?? baseBands?.stroke?.color ?? '#000000');
      const sop = Number(bAny.stroke.opacity);
      bAny.stroke.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseBands?.stroke?.opacity) || 0, 0, 1);

      if (!bAny.waves || typeof bAny.waves !== 'object') bAny.waves = cloneJson(baseBands?.waves);
      const wa = Number(bAny.waves.amplitudePx);
      bAny.waves.amplitudePx = Number.isFinite(wa) ? Math.max(0, wa) : Math.max(0, Number(baseBands?.waves?.amplitudePx) || 0);
      const wl = Number(bAny.waves.wavelengthPx);
      bAny.waves.wavelengthPx = Number.isFinite(wl) ? Math.max(1, wl) : Math.max(1, Number(baseBands?.waves?.wavelengthPx) || 1);
      const na = Number(bAny.waves.noiseAmount);
      bAny.waves.noiseAmount = Number.isFinite(na) ? clamp(na, 0, 1) : clamp(Number(baseBands?.waves?.noiseAmount) || 0, 0, 1);
      const ns = Number(bAny.waves.noiseScale);
      bAny.waves.noiseScale = Number.isFinite(ns) ? Math.max(0.000001, ns) : Math.max(0.000001, Number(baseBands?.waves?.noiseScale) || 1);

      if (!bAny.chevron || typeof bAny.chevron !== 'object') bAny.chevron = cloneJson(baseBands?.chevron);
      const ca = Number(bAny.chevron.amplitudePx);
      bAny.chevron.amplitudePx = Number.isFinite(ca) ? Math.max(0, ca) : Math.max(0, Number(baseBands?.chevron?.amplitudePx) || 0);
      const cl = Number(bAny.chevron.wavelengthPx);
      bAny.chevron.wavelengthPx = Number.isFinite(cl) ? Math.max(1, cl) : Math.max(1, Number(baseBands?.chevron?.wavelengthPx) || 1);
      const cs = Number(bAny.chevron.sharpness);
      bAny.chevron.sharpness = Number.isFinite(cs) ? clamp(cs, 0.1, 8) : clamp(Number(baseBands?.chevron?.sharpness) || 1, 0.1, 8);

      bAny.paletteMode = bAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(bAny.colorWeights)) bAny.colorWeights = Array.isArray(baseBands?.colorWeights) ? baseBands.colorWeights.slice() : [];
    }
  }

  // Basic flowlines2d config validation.
  if ((merged as any).type === 'flowlines2d') {
    const baseFlow: any = (base as any).flowlines;
    const fAny: any = (merged as any).flowlines;
    if (!fAny || typeof fAny !== 'object') {
      (merged as any).flowlines = cloneJson(baseFlow);
    } else {
      const so = Number(fAny.seedOffset);
      fAny.seedOffset = Number.isFinite(so) ? Math.round(so) : Math.round(Number(baseFlow?.seedOffset) || 0);
      const fr = Number(fAny.frequency);
      fAny.frequency = Number.isFinite(fr) ? Math.max(0.000001, fr) : Math.max(0.000001, Number(baseFlow?.frequency) || 1);
      const oc = Number(fAny.octaves);
      fAny.octaves = Number.isFinite(oc) ? Math.max(1, Math.min(16, Math.round(oc))) : Math.max(1, Math.min(16, Math.round(Number(baseFlow?.octaves) || 1)));
      const wa = Number(fAny.warpAmount);
      fAny.warpAmount = Number.isFinite(wa) ? Math.max(0, wa) : Math.max(0, Number(baseFlow?.warpAmount) || 0);
      const wf = Number(fAny.warpFrequency);
      fAny.warpFrequency = Number.isFinite(wf) ? Math.max(0.000001, wf) : Math.max(0.000001, Number(baseFlow?.warpFrequency) || 1);
      const st = Number(fAny.strength);
      fAny.strength = Number.isFinite(st) ? Math.max(0, st) : Math.max(0, Number(baseFlow?.strength) || 0);
      const eps = Number(fAny.epsilonPx);
      fAny.epsilonPx = Number.isFinite(eps) ? Math.max(0.1, eps) : Math.max(0.1, Number(baseFlow?.epsilonPx) || 1);
      fAny.spawn = fAny.spawn === 'random' ? 'random' : 'grid';
      const den = Number(fAny.density);
      fAny.density = Number.isFinite(den) ? clamp(den, 0, 1) : clamp(Number(baseFlow?.density) || 0, 0, 1);
      const sp = Number(fAny.spacingPx);
      fAny.spacingPx = Number.isFinite(sp) ? Math.max(2, sp) : Math.max(2, Number(baseFlow?.spacingPx) || 2);
      const mar = Number(fAny.marginPx);
      fAny.marginPx = Number.isFinite(mar) ? Math.max(0, mar) : Math.max(0, Number(baseFlow?.marginPx) || 0);
      const step = Number(fAny.stepPx);
      fAny.stepPx = Number.isFinite(step) ? Math.max(0.05, step) : Math.max(0.05, Number(baseFlow?.stepPx) || 0.05);
      const ms = Number(fAny.maxSteps);
      fAny.maxSteps = Number.isFinite(ms) ? Math.max(1, Math.round(ms)) : Math.max(1, Math.round(Number(baseFlow?.maxSteps) || 1));
      const ml = Number(fAny.maxLines);
      fAny.maxLines = Number.isFinite(ml) ? Math.max(0, Math.round(ml)) : Math.max(0, Math.round(Number(baseFlow?.maxLines) || 0));
      const minL = Number(fAny.minLengthPx);
      fAny.minLengthPx = Number.isFinite(minL) ? Math.max(0, minL) : Math.max(0, Number(baseFlow?.minLengthPx) || 0);
      const jit = Number(fAny.jitter);
      fAny.jitter = Number.isFinite(jit) ? clamp(jit, 0, 1) : clamp(Number(baseFlow?.jitter) || 0, 0, 1);

      if (!fAny.stroke || typeof fAny.stroke !== 'object') fAny.stroke = cloneJson(baseFlow?.stroke);
      const lw = Number(fAny.stroke.widthPx);
      fAny.stroke.widthPx = Number.isFinite(lw) ? Math.max(0.05, lw) : Math.max(0.05, Number(baseFlow?.stroke?.widthPx) || 0.05);
      const lo = Number(fAny.stroke.opacity);
      fAny.stroke.opacity = Number.isFinite(lo) ? clamp(lo, 0, 1) : clamp(Number(baseFlow?.stroke?.opacity) || 0, 0, 1);
      const tp = Number(fAny.stroke.taper);
      fAny.stroke.taper = Number.isFinite(tp) ? clamp(tp, 0, 1) : clamp(Number(baseFlow?.stroke?.taper) || 0, 0, 1);

      fAny.paletteMode = fAny.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(fAny.colorWeights)) fAny.colorWeights = Array.isArray(baseFlow?.colorWeights) ? baseFlow.colorWeights.slice() : [];
      const cj = Number(fAny.colorJitter);
      fAny.colorJitter = Number.isFinite(cj) ? clamp(cj, 0, 1) : clamp(Number(baseFlow?.colorJitter) || 0, 0, 1);
    }
  }

  // Basic diamondgrid2d config validation.
  if ((merged as any).type === 'diamondgrid2d') {
    const baseDg: any = (base as any).diamondgrid;
    const dAny: any = (merged as any).diamondgrid;
    if (!dAny || typeof dAny !== 'object') {
      (merged as any).diamondgrid = cloneJson(baseDg);
    } else {
      const tw = Number(dAny.tileWidthPx);
      dAny.tileWidthPx = Number.isFinite(tw) ? Math.max(2, tw) : Math.max(2, Number(baseDg?.tileWidthPx) || 2);
      const th = Number(dAny.tileHeightPx);
      dAny.tileHeightPx = Number.isFinite(th) ? Math.max(2, th) : Math.max(2, Number(baseDg?.tileHeightPx) || 2);
      const m = Number(dAny.marginPx);
      dAny.marginPx = Number.isFinite(m) ? Math.max(0, m) : Math.max(0, Number(baseDg?.marginPx) || 0);
      if (!dAny.originPx || typeof dAny.originPx !== 'object') dAny.originPx = cloneJson(baseDg?.originPx);
      const ox = Number(dAny.originPx.x);
      const oy = Number(dAny.originPx.y);
      dAny.originPx.x = Number.isFinite(ox) ? ox : Number(baseDg?.originPx?.x) || 0;
      dAny.originPx.y = Number.isFinite(oy) ? oy : Number(baseDg?.originPx?.y) || 0;
      const os = Number(dAny.overscanPx);
      dAny.overscanPx = Number.isFinite(os) ? Math.max(0, os) : Math.max(0, Number(baseDg?.overscanPx) || 0);
      const fo = Number(dAny.fillOpacity);
      dAny.fillOpacity = Number.isFinite(fo) ? clamp(fo, 0, 1) : clamp(Number(baseDg?.fillOpacity) || 0, 0, 1);

      if (!dAny.stroke || typeof dAny.stroke !== 'object') dAny.stroke = cloneJson(baseDg?.stroke);
      dAny.stroke.enabled = typeof dAny.stroke.enabled === 'boolean' ? dAny.stroke.enabled : !!dAny.stroke.enabled;
      const sw = Number(dAny.stroke.widthPx);
      dAny.stroke.widthPx = Number.isFinite(sw) ? Math.max(0, sw) : Math.max(0, Number(baseDg?.stroke?.widthPx) || 0);
      if (typeof dAny.stroke.color !== 'string') dAny.stroke.color = String(dAny.stroke.color ?? baseDg?.stroke?.color ?? '#000000');
      const so = Number(dAny.stroke.opacity);
      dAny.stroke.opacity = Number.isFinite(so) ? clamp(so, 0, 1) : clamp(Number(baseDg?.stroke?.opacity) || 0, 0, 1);
      dAny.stroke.join = dAny.stroke.join === 'miter' ? 'miter' : dAny.stroke.join === 'bevel' ? 'bevel' : 'round';

      if (!dAny.coloring || typeof dAny.coloring !== 'object') dAny.coloring = cloneJson(baseDg?.coloring);
      dAny.coloring.paletteMode = dAny.coloring.paletteMode === 'cycle' ? 'cycle' : 'weighted';
      if (!Array.isArray(dAny.coloring.colorWeights)) dAny.coloring.colorWeights = Array.isArray(baseDg?.coloring?.colorWeights) ? baseDg.coloring.colorWeights.slice() : [];

      if (!dAny.bevel || typeof dAny.bevel !== 'object') dAny.bevel = cloneJson(baseDg?.bevel);
      dAny.bevel.enabled = typeof dAny.bevel.enabled === 'boolean' ? dAny.bevel.enabled : !!dAny.bevel.enabled;
      const ba = Number(dAny.bevel.amount);
      dAny.bevel.amount = Number.isFinite(ba) ? clamp(ba, 0, 1) : clamp(Number(baseDg?.bevel?.amount) || 0, 0, 1);
      const ld = Number(dAny.bevel.lightDeg);
      dAny.bevel.lightDeg = Number.isFinite(ld) ? ld : Number(baseDg?.bevel?.lightDeg) || 0;
      const bv = Number(dAny.bevel.variation);
      dAny.bevel.variation = Number.isFinite(bv) ? clamp(bv, 0, 1) : clamp(Number(baseDg?.bevel?.variation) || 0, 0, 1);

      if (!dAny.sparkles || typeof dAny.sparkles !== 'object') dAny.sparkles = cloneJson(baseDg?.sparkles);
      dAny.sparkles.enabled = typeof dAny.sparkles.enabled === 'boolean' ? dAny.sparkles.enabled : !!dAny.sparkles.enabled;
      const sd = Number(dAny.sparkles.density);
      dAny.sparkles.density = Number.isFinite(sd) ? clamp(sd, 0, 1) : clamp(Number(baseDg?.sparkles?.density) || 0, 0, 1);
      const cm = Number(dAny.sparkles.countMax);
      dAny.sparkles.countMax = Number.isFinite(cm) ? Math.max(1, Math.min(32, Math.round(cm))) : Math.max(1, Math.min(32, Math.round(Number(baseDg?.sparkles?.countMax) || 1)));
      const smin = Number(dAny.sparkles.sizeMinPx);
      const smax = Number(dAny.sparkles.sizeMaxPx);
      dAny.sparkles.sizeMinPx = Number.isFinite(smin) ? Math.max(0.1, smin) : Math.max(0.1, Number(baseDg?.sparkles?.sizeMinPx) || 0.1);
      dAny.sparkles.sizeMaxPx = Number.isFinite(smax) ? Math.max(dAny.sparkles.sizeMinPx, smax) : Math.max(dAny.sparkles.sizeMinPx, Number(baseDg?.sparkles?.sizeMaxPx) || dAny.sparkles.sizeMinPx);
      const sop = Number(dAny.sparkles.opacity);
      dAny.sparkles.opacity = Number.isFinite(sop) ? clamp(sop, 0, 1) : clamp(Number(baseDg?.sparkles?.opacity) || 0, 0, 1);
      if (typeof dAny.sparkles.color !== 'string') dAny.sparkles.color = String(dAny.sparkles.color ?? baseDg?.sparkles?.color ?? '#ffffff');
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
                : { roughness: DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength, normal: DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength, amount: DEFAULT_POPSICLE_CONFIG.voronoi.amount, scale: DEFAULT_POPSICLE_CONFIG.voronoi.scale };
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
        colorStrength: enabled ? clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength, 1.0), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength,
        colorMode: (['darken', 'lighten', 'tint'] as const)[chance(0.6) ? 0 : Math.floor(rng() * 3)],
        tintColor: '#ffffff',
        materialMode,
        materialKind,
        roughnessStrength: enabled ? clamp(tri(0.08, textureBias.roughness, 0.78), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength,
        normalStrength: enabled ? clamp(tri(0.06, textureBias.normal, 0.68), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength,
        normalScale: clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.normalScale, 0.88), 0, 1),
        crackleAmount: crackleEnabled ? clamp(tri(0.05, 0.28, 0.85), 0, 1) : 0,
        crackleScale: crackleEnabled ? clamp(tri(2, DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale, 60), 0, 200) : DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale,
        nucleus: {
          ...DEFAULT_POPSICLE_CONFIG.voronoi.nucleus,
          enabled: nucleusEnabled,
          size: nucleusEnabled ? clamp(tri(0.03, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size, 0.18), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size,
          softness: nucleusEnabled ? clamp(tri(0.05, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness, 0.85), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness,
          strength: nucleusEnabled ? clamp(tri(0.25, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength, 1.0), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength,
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
      const intensity = emissionOrder === 0
        ? clamp(tri(0.6, emissionIntensitySeed, 14), 0, 20)
        : clamp(emissionIntensitySeed * tri(0.35, 0.7, 1.0), 0, 20);
      setOverride(idx, { emission: { enabled: true, intensity } });
      emissionOrder++;
    }

    // Very rare: per-color texture for 3D types.
    if (is3DType && chance(0.12)) {
      const idx = Math.floor(rng() * paletteCount);
      const type: TextureType = chance(0.55) ? 'glass' : chance(0.6) ? 'mirror' : chance(0.5) ? 'metallic' : 'matte';
      const params: any =
        type === 'glass'
          ? { glass: { style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)] } }
          : undefined;
      setOverride(idx, { texture: { type, params } });
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
    if (is3DType && base.voronoi?.enabled && chance(0.12)) {
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

  base.palette.overrides = paletteOverrides;

  const paletteEmissionActive = paletteOverrides.some(
    (ov) => !!ov && typeof ov === 'object' && !!ov.emission?.enabled && Number(ov.emission?.intensity) > 0
  );
  const fallbackEmissionActive = !!base.emission.enabled && Number(base.emission.intensity) > 0;

  if (paletteEmissionActive) {
    base.emission = { ...base.emission, enabled: false, intensity: 0 };
    base.bloom = { ...base.bloom, enabled: true };
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
        const modeRoll = rng();
        const mode: Bands2DMode = modeRoll < 0.42 ? 'waves' : modeRoll < 0.7 ? 'chevron' : 'straight';
        const bandWidthPx = Math.max(8, Math.round(randomWeighted(rng, 10, 260, 120)));
        const gapPx = Math.max(0, Math.round(randomWeighted(rng, 0, 120, 28)));
        const angleDeg = randomWeighted(rng, 0, 360, 22);
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
            fill: { enabled: true, opacity: clamp(tri(0.35, 1.0, 1.0), 0, 1) },
            stroke: { enabled: rng() < 0.22, widthPx: Math.round(randomWeighted(rng, 1, 10, 2)), color: '#0b0b10', opacity: clamp(tri(0.1, 0.65, 1.0), 0, 1) },
            waves: {
              amplitudePx: Math.round(randomWeighted(rng, 0, 140, 36)),
              wavelengthPx: Math.round(randomWeighted(rng, 120, 1200, 520)),
              noiseAmount: clamp(tri(0, 0.25, 1), 0, 1),
              noiseScale: clamp(tri(0.2, 0.9, 3.5), 0.01, 50)
            },
            chevron: {
              amplitudePx: Math.round(randomWeighted(rng, 0, 220, 68)),
              wavelengthPx: Math.round(randomWeighted(rng, 80, 700, 260)),
              sharpness: clamp(tri(0.6, 1.4, 4.0), 0.1, 8)
            },
            paletteMode: rng() < 0.55 ? 'cycle' : 'weighted',
            colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
          }
        } as any;
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
        } as any;
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
            stroke: { enabled: rng() < 0.3, widthPx: Math.round(randomWeighted(rng, 1, 10, 2)), color: '#0b0b10', opacity: clamp(tri(0.15, 0.6, 1.0), 0, 1), join: 'round' },
            coloring: { paletteMode: rng() < 0.65 ? 'weighted' : 'cycle', colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08] },
            bevel: { enabled: rng() < 0.92, amount: clamp(tri(0, 0.48, 1.0), 0, 1), lightDeg: randomWeighted(rng, 0, 360, 315), variation: clamp(tri(0, 0.15, 0.6), 0, 1) },
            sparkles: { enabled: rng() < 0.24, density: clamp(tri(0, 0.035, 0.12), 0, 1), countMax: Math.max(1, Math.min(6, Math.round(tri(1, 2, 6)))), sizeMinPx: clamp(tri(0.75, 1.6, 3.0), 0.1, 200), sizeMaxPx: clamp(tri(3, 9, 18), 0.1, 600), opacity: clamp(tri(0.08, 0.28, 0.75), 0, 1), color: '#ffffff' }
          }
        } as any;
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
        bloom: base.emission.enabled ? { ...base.bloom, enabled: true } : { ...base.bloom },
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
        const count = logoMode ? 1 : (chance(0.15) ? 1 : skewCountLow(2, DEFAULT_SVG3D_CONFIG.svg.count, 360, 1500, 0.03));
        const spread = logoMode ? 0 : randomWeighted(rng, 0.8, 6.5, DEFAULT_SVG3D_CONFIG.svg.spread);
        const depth = logoMode ? 0 : randomWeighted(rng, 0.5, 7.0, DEFAULT_SVG3D_CONFIG.svg.depth);
        const tiltDeg = logoMode ? 0 : (chance(0.75) ? 0 : Math.round(clamp(randomWeighted(rng, 0, 45, 8), 0, 80)));

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
        const detailFrequency = clamp(randomWeighted(rng, 3.5, 12, 7.5), 0.1, 40);
        const detailAmplitude = clamp(randomWeighted(rng, 0.02, 0.36, 0.18), 0, 0.7);
        const contrast = clamp(randomWeighted(rng, 0.75, 1.55, 1.05), 0.2, 3);
        const bias = clamp(randomWeighted(rng, -0.18, 0.18, 0), -0.5, 0.5);
        const levelJitter = clamp(randomWeighted(rng, 0.02, 0.32, 0.1), 0, 0.4);
        const warpDepth = clamp(randomWeighted(rng, 0, 0.72, 0.28), 0, 1);

        return {
          ...base,
          type: 'ridges2d',
          emission: { ...base.emission, enabled: false },
          bloom: { ...base.bloom, enabled: false },
          collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
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
