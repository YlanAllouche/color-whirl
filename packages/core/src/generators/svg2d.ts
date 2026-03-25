import type { Svg2DConfig, PaletteAssignMode } from '../types.js';
import { createRng } from '../types.js';
import { inferSvgRenderMode, validateSvgSource } from '../svg-utils.js';
import { resolvePaletteConfig } from '../palette.js';
import { extractSvgToneLayers2D } from '../svg-tone-extraction.js';

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function rgba(hex: string, alpha: number): string {
  const a = clamp(alpha, 0, 1);
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (u <= acc) return i;
  }
  return Math.max(0, wNorm.length - 1);
}

function applyCanvasBloom(options: {
  ctx: CanvasRenderingContext2D;
  glowCanvas: HTMLCanvasElement;
  strength: number;
  radius: number;
  threshold: number;
}): void {
  const { ctx, glowCanvas, strength, radius, threshold } = options;
  if (!(strength > 0) || glowCanvas.width === 0 || glowCanvas.height === 0) return;

  const w = glowCanvas.width;
  const h = glowCanvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;

  const blurPx = Math.max(0, radius) * 40;
  const passes = Math.max(1, Math.min(6, Math.round(1 + strength * 1.5)));

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.filter = 'none';
  tctx.drawImage(glowCanvas, 0, 0);

  const th = clamp(threshold, 0, 1);
  if (th > 0) {
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = `rgba(255,255,255,${clamp(1 - th, 0, 1)})`;
    tctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${blurPx.toFixed(2)}px)`;

  for (let i = 0; i < passes; i++) {
    const a = clamp(strength * 0.22, 0, 1);
    ctx.globalAlpha = a;
    ctx.drawImage(tmp, 0, 0);
  }

  ctx.restore();
}

function buildNormalizedPathsFromSvg(svgSource: string): { fillPath: Path2D; strokePath: Path2D; hasFill: boolean; hasStroke: boolean } {
  const source = validateSvgSource(svgSource);

  let data: any;
  try {
    const loader = new SVGLoader();
    data = loader.parse(source);
  } catch (err: any) {
    throw new Error(`Invalid SVG: failed to parse (${String(err?.message || err)})`);
  }

  const ptsAll: Array<{ x: number; y: number }[]> = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of data?.paths ?? []) {
    const subs = (p as any)?.subPaths ?? [];
    for (const sp of subs) {
      const pts = (sp as any).getPoints ? (sp as any).getPoints(80) : [];
      if (!pts || pts.length < 2) continue;
      const arr: { x: number; y: number }[] = [];
      for (const v of pts) {
        const x = Number(v?.x);
        const y = Number(v?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        arr.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (arr.length >= 2) ptsAll.push(arr);
    }
  }

  if (!Number.isFinite(minX) || ptsAll.length === 0) {
    throw new Error('Invalid SVG: no drawable paths found');
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const w = Math.max(1e-9, maxX - minX);
  const h = Math.max(1e-9, maxY - minY);
  const maxDim = Math.max(w, h);
  const eps2 = (maxDim * 0.001) * (maxDim * 0.001);

  const fillPath = new Path2D();
  const strokePath = new Path2D();
  let hasFill = false;
  let hasStroke = false;
  for (const pts of ptsAll) {
    const x0 = (pts[0].x - cx) / maxDim;
    const y0 = (pts[0].y - cy) / maxDim;
    strokePath.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      strokePath.lineTo((pts[i].x - cx) / maxDim, (pts[i].y - cy) / maxDim);
    }
    const dx = pts[pts.length - 1].x - pts[0].x;
    const dy = pts[pts.length - 1].y - pts[0].y;
    const closed = dx * dx + dy * dy <= eps2;
    if (closed) {
      strokePath.closePath();

      // Only closed subpaths are safe to fill.
      fillPath.moveTo(x0, y0);
      for (let i = 1; i < pts.length; i++) {
        fillPath.lineTo((pts[i].x - cx) / maxDim, (pts[i].y - cy) / maxDim);
      }
      fillPath.closePath();
      hasFill = true;
    }
    hasStroke = true;
  }

  return { fillPath, strokePath, hasFill, hasStroke };
}

function pickPaletteIndex(rng: () => number, mode: PaletteAssignMode, weightsNorm: number[], i: number, n: number): number {
  if (mode === 'cycle') return ((i % n) + n) % n;
  return sampleWeightedIndex01(rng(), weightsNorm);
}

export function renderSvg2DToCanvas(config: Svg2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const modeRaw = String((config as any).svg?.renderMode ?? 'auto');
  const inferred = inferSvgRenderMode(config.svg.source);
  const effectiveMode = modeRaw === 'fill' || modeRaw === 'stroke' || modeRaw === 'fill+stroke' ? modeRaw : 'auto';
  const mode = effectiveMode === 'auto' ? inferred : (effectiveMode as 'fill' | 'stroke' | 'fill+stroke');

  const doFill = mode === 'fill' || mode === 'fill+stroke';
  const doStroke = mode === 'stroke' || mode === 'fill+stroke';

  const colorModeRaw = String((config as any).svg?.colorMode ?? 'palette');
  const colorMode = colorModeRaw === 'svg-to-palette' ? 'svg-to-palette' : 'palette';
  const maxTones = Math.max(1, Math.min(64, Math.round(Number((config as any).svg?.maxTones) || 8)));

  const paletteLayers = colorMode === 'palette' ? null : extractSvgToneLayers2D(config.svg.source, maxTones);
  const single = colorMode === 'palette' ? buildNormalizedPathsFromSvg(config.svg.source) : null;
  const fillPath = single?.fillPath ?? new Path2D();
  const strokePath = single?.strokePath ?? new Path2D();

  const rng = createRng(config.seed);
  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const nColors = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], nColors);

  const sizeMultByIndex = Array.from({ length: nColors }, (_, i) => resolvePaletteConfig(config as any, i).multipliers.svg.sizeMult);

  const emissionByIndex = Array.from({ length: nColors }, (_, i) => {
    const e = resolvePaletteConfig(config as any, i).emission;
    return { enabled: !!e.enabled && !!config.bloom.enabled, intensity: e.intensity };
  });

  const count = Math.max(1, Math.round(Number(config.svg.count) || 0));
  const rMin = Math.max(0.1, Number(config.svg.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.svg.rMaxPx) || rMin);
  const jitter = clamp01(Number(config.svg.jitter) || 0);
  const rotJ = ((Number(config.svg.rotateJitterDeg) || 0) * Math.PI) / 180;
  const fillOpacity = doFill ? clamp01(Number(config.svg.fillOpacity) || 0) : 0;

  const strokeEnabled = doStroke ? true : !!config.svg.stroke?.enabled;
  const strokeW = Math.max(0, Number(config.svg.stroke?.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.svg.stroke?.opacity) || 0);
  const strokeColor = typeof config.svg.stroke?.color === 'string' ? config.svg.stroke.color : '#000000';

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const drawShape = (
    target: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    theta: number,
    fill: string,
    paths?: { fillPath: Path2D; strokePath: Path2D }
  ) => {
    target.save();
    target.translate(x, y);
    target.rotate(theta);
    target.scale(r, r);

    const fp = paths?.fillPath ?? fillPath;
    const sp = paths?.strokePath ?? strokePath;

    if (doFill && fillOpacity > 0) {
      target.fillStyle = rgba(fill, fillOpacity);
      target.fill(fp, 'evenodd');
    }

    if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
      const lw = clamp(strokeW / Math.max(1e-6, r), 0.05, 1000);
      target.lineJoin = 'round';
      target.lineCap = 'round';
      target.lineWidth = lw;
      const sc = colorMode === 'svg-to-palette' ? fill : strokeColor;
      target.strokeStyle = rgba(sc, strokeOpacity);
      target.stroke(sp);
    }

    target.restore();
  };

  const drawEmission = (x: number, y: number, r: number, theta: number, fill: string, emit: number, paths?: { fillPath: Path2D; strokePath: Path2D }) => {
    if (!config.bloom.enabled) return;
    const e = Math.max(0, Number(emit) || 0);
    if (!(e > 0)) return;

    const s = 1.0 + clamp(e * 0.03, 0, 0.85);
    gctx.save();
    gctx.translate(x, y);
    gctx.rotate(theta);
    gctx.scale(r * s, r * s);
    const a = clamp(0.06 + e * 0.02, 0, 1);
    const fp = paths?.fillPath ?? fillPath;
    const sp = paths?.strokePath ?? strokePath;
    if (doFill) {
      gctx.fillStyle = rgba(fill, a);
      gctx.fill(fp, 'evenodd');
    }
    if (strokeEnabled && strokeW > 0) {
      const lw = clamp(strokeW / Math.max(1e-6, r * s), 0.05, 1000);
      gctx.lineJoin = 'round';
      gctx.lineCap = 'round';
      gctx.lineWidth = lw;
      gctx.strokeStyle = rgba(fill, clamp(a * 0.75, 0, 1));
      gctx.stroke(sp);
    }
    gctx.restore();
  };

  for (let i = 0; i < count; i++) {
    const r0 = rMin + rng() * (rMax - rMin);
    const x0 = rng() * c.width;
    const y0 = rng() * c.height;
    const theta = (rng() - 0.5) * rotJ;

    if (colorMode === 'svg-to-palette' && paletteLayers) {
      const x = x0 + (rng() - 0.5) * r0 * 2 * jitter;
      const y = y0 + (rng() - 0.5) * r0 * 2 * jitter;
      for (let ti = 0; ti < paletteLayers.length; ti++) {
        const col = colors[ti % nColors] ?? '#ffffff';
        drawShape(ctx, x, y, r0, theta, col, paletteLayers[ti]);
        const em = emissionByIndex[ti % nColors];
        if (em?.enabled) drawEmission(x, y, r0, theta, col, em.intensity, paletteLayers[ti]);
      }
      continue;
    }

    const pi = pickPaletteIndex(rng, (config.svg.paletteMode as PaletteAssignMode) === 'cycle' ? 'cycle' : 'weighted', weightsNorm, i, nColors);
    const fill = colors[pi] ?? '#ffffff';
    const sizeMult = sizeMultByIndex[pi] ?? 1;
    const r = r0 * sizeMult;
    const x = x0 + (rng() - 0.5) * r * 2 * jitter;
    const y = y0 + (rng() - 0.5) * r * 2 * jitter;

    drawShape(ctx, x, y, r, theta, fill);
    {
      const em = emissionByIndex[pi];
      if (em?.enabled) drawEmission(x, y, r, theta, fill, em.intensity);
    }
  }

  if (config.bloom.enabled) {
    applyCanvasBloom({
      ctx,
      glowCanvas: glow,
      strength: Number(config.bloom.strength) || 0,
      radius: Number(config.bloom.radius) || 0,
      threshold: Number(config.bloom.threshold) || 0
    });
  }

  return c;
}
