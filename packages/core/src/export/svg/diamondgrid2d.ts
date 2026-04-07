import type { PaletteAssignMode, WallpaperConfig } from '../../types.js';
import { cellRand01, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

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

  const spark = dg.sparkles ?? {};
  const sparkEnabled = !!spark.enabled;
  const sparkDensity = clamp01(Number(spark.density) || 0);
  const sparkCountMax = Math.max(1, Math.min(12, Math.round(Number(spark.countMax) || 1)));
  const sparkSizeMin = Math.max(0.1, Number(spark.sizeMinPx) || 0.1);
  const sparkSizeMax = Math.max(sparkSizeMin, Number(spark.sizeMaxPx) || sparkSizeMin);
  const sparkOpacity = clamp01(Number(spark.opacity) || 0);
  const sparkColor = typeof spark.color === 'string' ? String(spark.color) : '#ffffff';

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

      if (sparkEnabled && sparkOpacity > 0 && sparkDensity > 0 && cellRand01(seed, u, v, 7001) < sparkDensity) {
        const count = 1 + Math.floor(cellRand01(seed, u, v, 7002) * sparkCountMax);
        for (let si = 0; si < count; si++) {
          const rx0 = (cellRand01(seed, u * 97 + si, v * 131 + si, 7101) - 0.5) * 2;
          const ry0 = (cellRand01(seed, u * 97 + si, v * 131 + si, 7102) - 0.5) * 2;
          const rx = clamp(rx0, -1, 1);
          const ry = clamp(ry0, -1, 1);
          const sx = cx + rx * a * 0.75;
          const sy = cy + ry * b * 0.75;
          const r = sparkSizeMin + cellRand01(seed, u * 37 + si, v * 41 + si, 7103) * (sparkSizeMax - sparkSizeMin);
          const rot = cellRand01(seed, u * 17 + si, v * 19 + si, 7104) * Math.PI * 2;
          const spikes = 4;
          const r2 = r * 0.42;
          const pts2: string[] = [];
          for (let k = 0; k < spikes * 2; k++) {
            const ang = rot + (k / (spikes * 2)) * Math.PI * 2;
            const rr = k % 2 === 0 ? r : r2;
            pts2.push(`${(sx + Math.cos(ang) * rr).toFixed(3)} ${(sy + Math.sin(ang) * rr).toFixed(3)}`);
          }
          svg += `  <path d="M ${pts2.join(' L ')} Z" fill="${sparkColor}" fill-opacity="${sparkOpacity.toFixed(3)}"/>\n`;
        }
      }
    }
  }

  svg += svgEnd();
  return svg;
}
