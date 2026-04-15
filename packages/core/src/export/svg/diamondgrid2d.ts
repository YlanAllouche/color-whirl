import type { PaletteAssignMode, WallpaperConfig } from '../../types.js';
import { cellRand01, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateDiamondGrid2DSVG(config: Extract<WallpaperConfig, { type: 'diamondgrid2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const palette = colors.length > 0 ? colors : ['#ffffff'];
  const n = Math.max(1, palette.length);

  const dg: any = (config as any).diamondgrid ?? {};
  const seed = (config.seed >>> 0) || 1;

  const tileW = Math.max(2, Number(dg.tileWidthPx) || 2);
  const tileH = Math.max(2, Number(dg.tileHeightPx) || 2);
  const a0 = tileW * 0.5;
  const b0 = tileH * 0.5;
  const marginPx = Math.max(0, Number(dg.marginPx) || 0);
  const sw = dg.stroke?.enabled ? Math.max(0, Number(dg.stroke?.widthPx) || 0) : 0;
  const shrink = marginPx * 0.5 + sw * 0.5;
  const a = Math.max(0.5, a0 - shrink);
  const b = Math.max(0.5, b0 - shrink);

  const originX = Number(dg.originPx?.x) || 0;
  const originY = Number(dg.originPx?.y) || 0;
  const overscan = Math.max(0, Number(dg.overscanPx) || 0);
  const fillOpacity = clamp01(Number(dg.fillOpacity) || 0);

  const strokeEnabled = !!dg.stroke?.enabled;
  const strokeOpacity = strokeEnabled ? clamp01(Number(dg.stroke?.opacity) || 0) : 0;
  const strokeColor = typeof dg.stroke?.color === 'string' ? String(dg.stroke.color) : '#000000';
  const strokeJoin = dg.stroke?.join === 'bevel' ? 'bevel' : dg.stroke?.join === 'miter' ? 'miter' : 'round';

  const weightsNorm = normalizeWeights((dg.coloring?.colorWeights ?? []) as number[], n);
  const paletteMode: PaletteAssignMode = dg.coloring?.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  const xMin = -overscan;
  const yMin = -overscan;
  const xMax = width + overscan;
  const yMax = height + overscan;
  const invU = (x: number, y: number) => 0.5 * ((x - originX) / a0 + (y - originY) / b0);
  const invV = (x: number, y: number) => 0.5 * ((y - originY) / b0 - (x - originX) / a0);
  const corners = [
    { x: xMin, y: yMin },
    { x: xMax, y: yMin },
    { x: xMin, y: yMax },
    { x: xMax, y: yMax }
  ];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const p of corners) {
    const uu = invU(p.x, p.y);
    const vv = invV(p.x, p.y);
    if (uu < uMin) uMin = uu;
    if (uu > uMax) uMax = uu;
    if (vv < vMin) vMin = vv;
    if (vv > vMax) vMax = vv;
  }
  const pad = 3;
  const u0 = Math.floor(uMin) - pad;
  const u1 = Math.ceil(uMax) + pad;
  const v0 = Math.floor(vMin) - pad;
  const v1 = Math.ceil(vMax) + pad;

  const pickIndex = (u: number, v: number): number => {
    if (paletteMode === 'cycle') return (((u + v) % n) + n) % n;
    return sampleWeightedIndex01(cellRand01(seed, u, v, 5001), weightsNorm);
  };

  const strokeAttr =
    strokeEnabled && sw > 0 && strokeOpacity > 0
      ? ` stroke="${strokeColor}" stroke-opacity="${strokeOpacity.toFixed(3)}" stroke-width="${sw}" stroke-linejoin="${strokeJoin}"`
      : '';

  let svg = svgStart(width, height, backgroundColor);

  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      const cx = originX + (u - v) * a0;
      const cy = originY + (u + v) * b0;
      if (cx < xMin - a0 || cx > xMax + a0 || cy < yMin - b0 || cy > yMax + b0) continue;
      const idx = pickIndex(u, v);
      const col = palette[idx] ?? '#ffffff';
      const pts = [
        `${cx.toFixed(3)},${(cy - b).toFixed(3)}`,
        `${(cx + a).toFixed(3)},${cy.toFixed(3)}`,
        `${cx.toFixed(3)},${(cy + b).toFixed(3)}`,
        `${(cx - a).toFixed(3)},${cy.toFixed(3)}`
      ];
      svg += `  <polygon points="${pts.join(' ')}" fill="${col}" fill-opacity="${fillOpacity.toFixed(3)}"${strokeAttr}/>` + '\n';
    }
  }

  svg += svgEnd();
  return svg;
}
