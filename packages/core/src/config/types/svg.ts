import type { BaseWallpaperConfig, PaletteAssignMode } from './base.js';

export type SvgRenderMode = 'auto' | 'fill' | 'stroke' | 'fill+stroke';

export type Svg2DLayoutMode = 'scatter' | 'grid';

export type SvgColorMode = 'palette' | 'svg-to-palette';

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
    /** How to place instances in 2D space. */
    mode: Svg2DLayoutMode;
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
