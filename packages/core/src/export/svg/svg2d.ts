import type { WallpaperConfig } from '../../types.js';
import { extractSvgRootAttributes, inferSvgRenderMode, stripSvgPresentationAttributes, validateSvgSource } from '../../svg-utils.js';
import { cellRand01, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateSvg2DSVG(config: Extract<WallpaperConfig, { type: 'svg2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(1, Math.round(Number(config.svg.count) || 0));
  const layoutMode = config.svg.mode === 'grid' ? 'grid' : 'scatter';
  const rMin = Math.max(0.1, Number(config.svg.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.svg.rMaxPx) || rMin);
  let fillOpacity = clamp01(Number(config.svg.fillOpacity) || 0);
  const jitter = clamp01(Number(config.svg.jitter) || 0);
  const rotJ = ((Number(config.svg.rotateJitterDeg) || 0) * Math.PI) / 180;

  const gridCols = Math.max(1, Math.round(Math.sqrt((count * width) / Math.max(1, height))));
  const gridRows = Math.max(1, Math.ceil(count / gridCols));
  const cellW = width / gridCols;
  const cellH = height / gridRows;

  validateSvgSource(config.svg.source);

  const rmRaw = String((config as any).svg?.renderMode ?? 'auto');
  const explicitMode = rmRaw === 'fill' || rmRaw === 'stroke' || rmRaw === 'fill+stroke' ? rmRaw : 'auto';
  const inferred = inferSvgRenderMode(config.svg.source);
  const mode = explicitMode === 'auto' ? inferred : (explicitMode as 'fill' | 'stroke' | 'fill+stroke');
  const doFill = mode === 'fill' || mode === 'fill+stroke';
  const doStroke = mode === 'stroke' || mode === 'fill+stroke';
  fillOpacity = doFill ? fillOpacity : 0;

  const { viewBox, inner } = extractSvgRootAttributes(config.svg.source);
  const vbMinX = viewBox.minX;
  const vbMinY = viewBox.minY;
  const vbW = Math.max(1e-9, viewBox.width);
  const vbH = Math.max(1e-9, viewBox.height);
  const vbMax = Math.max(vbW, vbH);
  const vbCx = vbMinX + vbW * 0.5;
  const vbCy = vbMinY + vbH * 0.5;
  const cleanInner = stripSvgPresentationAttributes(inner);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], n);
  const pickIndex = (i: number) => {
    if (config.svg.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  const strokeEnabled = doStroke ? true : !!config.svg.stroke?.enabled;
  const strokeW = Math.max(0, Number(config.svg.stroke?.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.svg.stroke?.opacity) || 0);
  const strokeColor = typeof config.svg.stroke?.color === 'string' ? config.svg.stroke.color : '#000000';

  let svg = svgStart(width, height, backgroundColor);
  svg += `  <defs><symbol id="wmSvgShape" viewBox="${vbMinX} ${vbMinY} ${vbW} ${vbH}">${cleanInner}</symbol></defs>\n`;

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx0 = layoutMode === 'grid' ? ((i % gridCols) + 0.5) * cellW : rand01(i, 3) * width;
    const cy0 = layoutMode === 'grid' ? (Math.floor(i / gridCols) + 0.5) * cellH : rand01(i, 4) * height;
    const jitterX = layoutMode === 'grid' ? cellW * 0.8 * jitter : r * 2 * jitter;
    const jitterY = layoutMode === 'grid' ? cellH * 0.8 * jitter : r * 2 * jitter;
    const cx = cx0 + (rand01(i, 6) - 0.5) * jitterX;
    const cy = cy0 + (rand01(i, 7) - 0.5) * jitterY;
    const theta = (rand01(i, 8) - 0.5) * rotJ;
    const rotDeg = (theta * 180) / Math.PI;

    const scale = r / vbMax;
    const idx = pickIndex(i);
    const col = colors[idx] ?? '#ffffff';

    const strokeAttrs =
      strokeEnabled && strokeW > 0 && strokeOpacity > 0
        ? ` stroke="${strokeColor}" stroke-opacity="${strokeOpacity}" stroke-width="${(strokeW / Math.max(1e-9, scale)).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`
        : ' stroke="none"';

    const transform = `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) rotate(${rotDeg.toFixed(3)}) scale(${scale.toFixed(6)}) translate(${(-vbCx).toFixed(3)} ${(-vbCy).toFixed(3)})`;

    const fillAttrs = doFill ? ` fill="${col}" fill-opacity="${fillOpacity}"` : ' fill="none"';
    svg += `  <g transform="${transform}"${fillAttrs}${strokeAttrs}><use href="#wmSvgShape"/></g>\n`;
  }

  svg += svgEnd();
  return svg;
}
