import type { BaseWallpaperConfig, PaletteAssignMode } from './base.js';

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
