import type { PaletteAssignMode, WallpaperConfig } from '../../types.js';
import { cellRand01, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateBands2DSVG(config: Extract<WallpaperConfig, { type: 'bands2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const palette = colors.length > 0 ? colors : ['#ffffff'];
  const n = Math.max(1, palette.length);

  const b: any = (config as any).bands ?? {};
  const seed = ((config.seed >>> 0) ^ (Number(b.seedOffset) || 0)) >>> 0;
  const mode = b.mode === 'waves' || b.mode === 'chevron' || b.mode === 'straight' ? b.mode : 'straight';
  const angleDeg = Number(b.angleDeg) || 0;
  const bandWidth = Math.max(0.1, Number(b.bandWidthPx) || 1);
  const gap = Math.max(0, Number(b.gapPx) || 0);
  const period = bandWidth + gap;
  const offsetPx = Number(b.offsetPx) || 0;
  const jitterPx = Math.max(0, Number(b.jitterPx) || 0);

  const panel: any = b.panel ?? {};
  const panelEnabled = !!panel.enabled;
  const rectFrac: any = panel.rectFrac ?? { x: 0, y: 0, w: 1, h: 1 };
  const prx = clamp01(Number(rectFrac.x) || 0) * width;
  const pry = clamp01(Number(rectFrac.y) || 0) * height;
  const prw = Math.max(1, clamp01(Number(rectFrac.w) || 1) * width);
  const prh = Math.max(1, clamp01(Number(rectFrac.h) || 1) * height);
  const prRadius = Math.max(0, Number(panel.radiusPx) || 0);
  const pf: any = panel.fill ?? {};
  const panelFillEnabled = !!pf.enabled;
  const panelFillOpacity = clamp01(Number(pf.opacity) || 0);
  const panelFillColor = typeof pf.color === 'string' ? String(pf.color) : '#000000';

  const fillEnabled = !!b.fill?.enabled;
  const fillOpacity = clamp01(Number(b.fill?.opacity) || 0);
  const strokeEnabled = !!b.stroke?.enabled;
  const strokeW = Math.max(0, Number(b.stroke?.widthPx) || 0);
  const strokeOpacity = clamp01(Number(b.stroke?.opacity) || 0);
  const strokeColor = typeof b.stroke?.color === 'string' ? String(b.stroke.color) : '#000000';

  const weightsNorm = normalizeWeights((b.colorWeights ?? []) as number[], n);
  const paletteMode: PaletteAssignMode = b.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  const cx = width * 0.5;
  const cy = height * 0.5;
  const diag = Math.hypot(width, height);
  const overscan = Math.max(width, height, diag);

  const xStart = -overscan;
  const xEnd = width + overscan;
  const yStart = -overscan + offsetPx;
  const yEnd = height + overscan;
  const maxBands = Math.max(1, Math.ceil((yEnd - yStart) / Math.max(1e-6, period)) + 4);

  const frac = (x: number) => x - Math.floor(x);
  const triWave01 = (t: number) => 1 - 4 * Math.abs(frac(t) - 0.5);
  const smoothstep = (t: number) => {
    const x = clamp01(t);
    return x * x * (3 - 2 * x);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const valueNoise2D = (x: number, y: number, ch: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = x - xi;
    const ty = y - yi;
    const v00 = cellRand01(seed, xi, yi, ch);
    const v10 = cellRand01(seed, xi + 1, yi, ch);
    const v01 = cellRand01(seed, xi, yi + 1, ch);
    const v11 = cellRand01(seed, xi + 1, yi + 1, ch);
    const sx = smoothstep(tx);
    const sy = smoothstep(ty);
    const a = lerp(v00, v10, sx);
    const bb = lerp(v01, v11, sx);
    return lerp(a, bb, sy);
  };

  const waves: any = b.waves ?? {};
  const waveAmp = Math.max(0, Number(waves.amplitudePx) || 0);
  const waveLen = Math.max(1, Number(waves.wavelengthPx) || 1);
  const waveNoiseAmt = clamp01(Number(waves.noiseAmount) || 0);
  const waveNoiseScale = Math.max(0.000001, Number(waves.noiseScale) || 1);

  const chevron: any = b.chevron ?? {};
  const chevAmp = Math.max(0, Number(chevron.amplitudePx) || 0);
  const chevLen = Math.max(1, Number(chevron.wavelengthPx) || 1);
  const chevSharp = clamp(Number(chevron.sharpness) || 1, 0.1, 8);
  const chevShared = typeof chevron.sharedPhase === 'boolean' ? chevron.sharedPhase : true;
  const chevSharedPhase = cellRand01(seed, 0x51a, 0x9b1, 9301);

  const bandOffset = (x: number, bandIndex: number): number => {
    if (mode === 'waves') {
      const phase = cellRand01(seed, bandIndex, 0, 9101) * Math.PI * 2;
      const s = Math.sin(((x / waveLen) * Math.PI * 2) + phase);
      const n0 = (valueNoise2D((x / waveLen) * waveNoiseScale, bandIndex * 0.31, 9201) - 0.5) * 2;
      return waveAmp * (s + n0 * waveNoiseAmt);
    }
    if (mode === 'chevron') {
      const phase = chevShared ? chevSharedPhase : cellRand01(seed, bandIndex, 0, 9301);
      const t = (x / chevLen) + phase;
      const tri = triWave01(t);
      const shaped = Math.sign(tri) * Math.pow(Math.abs(tri), chevSharp);
      return shaped * chevAmp;
    }
    return 0;
  };

  const pickIndex = (i: number) => {
    if (paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(cellRand01(seed, i, 0, 9401), weightsNorm);
  };

  const stepPx =
    mode === 'straight'
      ? Math.max(8, Math.round(period * 0.4))
      : Math.max(8, Math.round((mode === 'chevron' ? chevLen : waveLen) / 34));

  let svg = svgStart(width, height, backgroundColor);

  const groupTransform = `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) rotate(${angleDeg.toFixed(3)}) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`;
  const clipId = `wm-bands-panel-${(seed >>> 0).toString(16)}`;
  if (panelEnabled) {
    svg += '  <defs>\n';
    svg += `    <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">\n`;
    svg += `      <rect x="${prx.toFixed(3)}" y="${pry.toFixed(3)}" width="${prw.toFixed(3)}" height="${prh.toFixed(3)}" rx="${prRadius.toFixed(3)}" ry="${prRadius.toFixed(3)}"/>\n`;
    svg += '    </clipPath>\n';
    svg += '  </defs>\n';
  }

  svg += panelEnabled ? `  <g clip-path="url(#${clipId})">\n` : '  <g>\n';
  if (panelEnabled && panelFillEnabled && panelFillOpacity > 0) {
    svg += `    <rect x="${prx.toFixed(3)}" y="${pry.toFixed(3)}" width="${prw.toFixed(3)}" height="${prh.toFixed(3)}" rx="${prRadius.toFixed(3)}" ry="${prRadius.toFixed(3)}" fill="${panelFillColor}" fill-opacity="${panelFillOpacity.toFixed(3)}"/>\n`;
  }
  svg += `    <g transform="${groupTransform}">\n`;

  for (let bi = 0; bi < maxBands; bi++) {
    const baseY = yStart + bi * period;
    const j = jitterPx > 0 ? (cellRand01(seed, bi, 0, 9001) - 0.5) * 2 * jitterPx : 0;
    const y0 = baseY + j;
    const y1 = y0 + bandWidth;
    if (y1 < yStart - period || y0 > yEnd + period) continue;

    const idx = pickIndex(bi);
    const col = palette[idx] ?? '#ffffff';

    const fillAttr = fillEnabled && fillOpacity > 0 ? ` fill="${col}" fill-opacity="${fillOpacity.toFixed(3)}"` : ' fill="none"';
    const strokeAttr =
      strokeEnabled && strokeW > 0 && strokeOpacity > 0
        ? ` stroke="${strokeColor}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity.toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`
        : '';

    if (mode === 'straight') {
      svg += `      <rect x="${xStart.toFixed(3)}" y="${y0.toFixed(3)}" width="${(xEnd - xStart).toFixed(3)}" height="${bandWidth.toFixed(3)}"${fillAttr}${strokeAttr}/>\n`;
      continue;
    }

    const ptsTop: Array<{ x: number; y: number }> = [];
    for (let x = xStart; x <= xEnd + 0.1; x += stepPx) {
      ptsTop.push({ x, y: y0 + bandOffset(x, bi) });
    }
    const ptsBot: Array<{ x: number; y: number }> = [];
    for (let x = xEnd; x >= xStart - 0.1; x -= stepPx) {
      ptsBot.push({ x, y: y1 + bandOffset(x, bi) });
    }
    const pts = ptsTop.concat(ptsBot);
    const d = 'M ' + pts.map((p, i) => `${i === 0 ? '' : 'L '}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';
    svg += `      <path d="${d}"${fillAttr}${strokeAttr}/>\n`;
  }

  svg += '    </g>\n';
  svg += '  </g>\n';
  svg += svgEnd();
  return svg;
}
