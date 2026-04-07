import type { WallpaperConfig } from '../../types.js';
import { extractSvgRootAttributes, inferSvgRenderMode, stripSvgPresentationAttributes, validateSvgSource } from '../../svg-utils.js';
import { cellRand01, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateSvg3DSVG(config: Extract<WallpaperConfig, { type: 'svg3d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(1, Math.round(Number(config.svg.count) || 0));

  validateSvgSource(config.svg.source);

  const rmRaw = String((config as any).svg?.renderMode ?? 'auto');
  const explicitMode = rmRaw === 'fill' || rmRaw === 'stroke' || rmRaw === 'fill+stroke' ? rmRaw : 'auto';
  const inferred = inferSvgRenderMode(config.svg.source);
  const mode = explicitMode === 'auto' ? inferred : (explicitMode as 'fill' | 'stroke' | 'fill+stroke');
  const doFill = mode === 'fill' || mode === 'fill+stroke';
  const doStroke = mode === 'stroke' || mode === 'fill+stroke';

  const { viewBox, inner } = extractSvgRootAttributes(config.svg.source);
  const vbMinX = viewBox.minX;
  const vbMinY = viewBox.minY;
  const vbW = Math.max(1e-9, viewBox.width);
  const vbH = Math.max(1e-9, viewBox.height);
  const vbMax = Math.max(vbW, vbH);
  const vbCx = vbMinX + vbW * 0.5;
  const vbCy = vbMinY + vbH * 0.5;
  const cleanInner = stripSvgPresentationAttributes(inner);

  const rMin = Math.max(0.1, Number(config.svg.sizeMin) * 180);
  const rMax = Math.max(rMin, Number(config.svg.sizeMax) * 180);
  const opacity = doFill ? clamp01(Number(config.svg.opacity) || 1) : 0;

  const strokeEnabled = doStroke ? true : !!(config as any).svg?.stroke?.enabled;
  const strokeOpacity = doStroke ? clamp01(Number((config as any).svg?.stroke?.opacity) || 1) : 0;
  const strokeColor = typeof (config as any).svg?.stroke?.color === 'string' ? String((config as any).svg.stroke.color) : '#000000';
  const strokeW = doStroke ? Math.max(0, Number((config as any).svg?.stroke?.radius) || 0) * 180 : 0;

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);
  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], n);
  const pickIndex = (i: number) => {
    if (config.svg.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  let svg = svgStart(width, height, backgroundColor);
  svg += `  <defs><symbol id="wmSvgShape" viewBox="${vbMinX} ${vbMinY} ${vbW} ${vbH}">${cleanInner}</symbol></defs>\n`;

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx = rand01(i, 3) * width;
    const cy = rand01(i, 4) * height;
    const baseRotDeg = Number((config as any).svg?.rotateDeg) || 0;
    const jitterDeg = Math.max(0, Number((config as any).svg?.rotateJitterDeg) || 0);
    const rotDeg = baseRotDeg + (rand01(i, 8) - 0.5) * jitterDeg;
    const scale = r / vbMax;
    const idx = pickIndex(i);
    const col = colors[idx] ?? '#ffffff';
    const transform = `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) rotate(${rotDeg.toFixed(3)}) scale(${scale.toFixed(6)}) translate(${(-vbCx).toFixed(3)} ${(-vbCy).toFixed(3)})`;
    const fillAttrs = doFill ? ` fill="${col}" fill-opacity="${opacity}"` : ' fill="none"';
    const strokeAttrs =
      strokeEnabled && strokeW > 0 && strokeOpacity > 0
        ? ` stroke="${strokeColor}" stroke-opacity="${strokeOpacity}" stroke-width="${(strokeW / Math.max(1e-9, scale)).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`
        : ' stroke="none"';
    svg += `  <g transform="${transform}"${fillAttrs}${strokeAttrs}><use href="#wmSvgShape"/></g>\n`;
  }

  svg += svgEnd();
  return svg;
}
