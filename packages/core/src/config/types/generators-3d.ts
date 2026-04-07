import type { BaseWallpaperConfig, PaletteAssignMode } from './base.js';

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
