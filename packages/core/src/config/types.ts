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
    mode: 'scatter' | 'grid';
    shape: 'polygon' | 'star';
    count: number;
    /** Polygon edge count (>= 3) */
    edges: number;
    rMinPx: number;
    rMaxPx: number;
    /** 0..1 */
    jitter: number;
    rotateJitterDeg: number;
    grid: {
      kind: 'square' | 'diamond';
      cellPx: number;
      /** 0..1 */
      jitter: number;
    };
    star: {
      /** 0.05..0.95: inner radius as fraction of outer radius */
      innerScale: number;
    };
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

    /** Optional axis-aligned panel clip in screen space (fractional units). */
    panel: {
      enabled: boolean;
      /** 0..1 fractions of the full canvas */
      rectFrac: { x: number; y: number; w: number; h: number };
      /** Corner radius in pixels */
      radiusPx: number;
      /** Optional panel underlay fill (rendered before bands inside the clip). */
      fill: {
        enabled: boolean;
        color: string;
        /** 0..1 */
        opacity: number;
      };
    };
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
      /** If true, align chevrons across all bands */
      sharedPhase: boolean;
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
