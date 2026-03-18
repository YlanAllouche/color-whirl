import type { Circles2DConfig } from '../types.js';
import { createRng } from '../types.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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
  return wNorm.length - 1;
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

  // Cheap bloom: blur + additive screen blends.
  const blurPx = Math.max(0, radius) * 40;
  const passes = Math.max(1, Math.min(6, Math.round(1 + strength * 1.5)));

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.filter = 'none';
  tctx.drawImage(glowCanvas, 0, 0);

  // A crude threshold: fade out dim pixels by drawing with reduced alpha.
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

export function renderCircles2DToCanvas(config: Circles2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const collisionsEnabled = config.collisions.mode === 'carve' && Math.max(0, config.colors.length) <= 8;
  const direction = config.collisions.carve.direction;

  const shapes = collisionsEnabled ? document.createElement('canvas') : null;
  if (shapes) {
    shapes.width = c.width;
    shapes.height = c.height;
  }
  const sctx = (shapes ? shapes.getContext('2d') : ctx) as CanvasRenderingContext2D | null;
  if (!sctx) throw new Error('2D canvas not available');
  if (shapes) sctx.clearRect(0, 0, shapes.width, shapes.height);

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const rng = createRng(config.seed);
  const nColors = Math.max(1, config.colors.length);
  const weights = normalizeWeights(config.circles.colorWeights, nColors);

  const inset = 0;
  const fillOpacity = clamp(config.circles.fillOpacity, 0, 1);
  const strokeEnabled = !!config.circles.stroke.enabled;
  const strokeW = Math.max(0, config.circles.stroke.widthPx);
  const strokeOpacity = clamp(config.circles.stroke.opacity, 0, 1);
  const croissant = config.circles.croissant;

  const carveMargin = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
  const carveFeather = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;

  const applyCarve = (target: CanvasRenderingContext2D, path: Path2D, fillRule?: CanvasFillRule) => {
    if (!collisionsEnabled) return;

    const m = carveMargin;
    const f = carveFeather;

    target.save();
    target.globalCompositeOperation = 'destination-out';
    target.globalAlpha = 1;
    if (fillRule) target.fill(path, fillRule);
    else target.fill(path);

    if (m > 0) {
      target.lineJoin = 'round';
      target.lineCap = 'round';
      target.lineWidth = m * 2;
      target.stroke(path);
    }

    if (f > 0) {
      const steps = Math.max(1, Math.min(64, Math.round(f)));
      target.lineJoin = 'round';
      target.lineCap = 'round';
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const r = m + t * f;
        target.globalAlpha = 1 - t;
        target.lineWidth = r * 2;
        target.stroke(path);
      }
    }

    target.restore();
  };

  const mask = collisionsEnabled && direction === 'twoWay' ? document.createElement('canvas') : null;
  if (mask) {
    mask.width = c.width;
    mask.height = c.height;
  }
  const mctx = mask ? mask.getContext('2d') : null;

  const temp = collisionsEnabled && direction === 'twoWay' ? document.createElement('canvas') : null;
  if (temp) {
    temp.width = c.width;
    temp.height = c.height;
  }
  const tctx = temp ? temp.getContext('2d') : null;

  const tempGlow = collisionsEnabled && direction === 'twoWay' ? document.createElement('canvas') : null;
  if (tempGlow) {
    tempGlow.width = c.width;
    tempGlow.height = c.height;
  }
  const tgctx = tempGlow ? tempGlow.getContext('2d') : null;

  const renderPresenceMask = () => {
    if (!mask || !mctx || !shapes) return;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, mask.width, mask.height);
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;

    const blurPx = carveFeather;
    const marginPx = carveMargin;

    mctx.filter = blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : 'none';
    if (marginPx > 0) {
      const samples = Math.max(8, Math.min(64, Math.round(marginPx * 1.25)));
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        const dx = Math.cos(a) * marginPx;
        const dy = Math.sin(a) * marginPx;
        mctx.drawImage(shapes, dx, dy);
      }
    }
    mctx.drawImage(shapes, 0, 0);
    mctx.filter = 'none';
  };

  const pickIndex = (i: number): number => {
    if (config.circles.paletteMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weights);
  };

  const drawTo = (target: CanvasRenderingContext2D, path: Path2D, fill: string, fillRule?: CanvasFillRule) => {
    target.fillStyle = rgba(fill, fillOpacity);
    if (fillRule) target.fill(path, fillRule);
    else target.fill(path);
    if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
      target.lineWidth = strokeW;
      target.lineJoin = 'round';
      target.strokeStyle = rgba(config.circles.stroke.color, strokeOpacity);
      target.stroke(path);
    }
  };

  const drawEmission = (target: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) => {
    if (!config.emission.enabled || !config.bloom.enabled) return;
    const emit = Math.max(0, Number(config.emission.intensity) || 0);
    if (!(emit > 0)) return;
    target.fillStyle = rgba(fill, clamp(0.06 + emit * 0.02, 0, 1));
    target.beginPath();
    target.arc(cx, cy, r * (1.0 + clamp(emit * 0.03, 0, 0.8)), 0, Math.PI * 2);
    target.fill();
  };

  const drawShape = (cx: number, cy: number, r: number, paletteIndex: number, croissantPhiOverride?: number) => {
    const color = config.colors[paletteIndex] ?? '#ffffff';
    const fillRule: CanvasFillRule | undefined = croissant.enabled ? 'evenodd' : undefined;

    const path = new Path2D();
    if (croissant.enabled) {
      const innerScale = clamp(croissant.innerScale, 0.01, 0.99);
      const offset = clamp(croissant.offset, 0, 1);
      const phi = typeof croissantPhiOverride === 'number'
        ? croissantPhiOverride
        : ((rng() - 0.5) * croissant.angleJitterDeg * Math.PI) / 180;
      const dx = Math.cos(phi) * r * offset;
      const dy = Math.sin(phi) * r * offset;
      path.arc(cx, cy, r, 0, Math.PI * 2);
      path.closePath();
      path.moveTo(cx + dx + r * innerScale, cy + dy);
      path.arc(cx + dx, cy + dy, r * innerScale, 0, Math.PI * 2, true);
      path.closePath();
    } else {
      path.arc(cx, cy, r, 0, Math.PI * 2);
    }

    if (!collisionsEnabled) {
      drawTo(sctx, path, color, fillRule);
      if (paletteIndex === Math.round(config.emission.paletteIndex)) drawEmission(gctx, cx, cy, r, color);
      return;
    }

    if (direction === 'twoWay' && shapes && mask && mctx && temp && tctx && tempGlow && tgctx) {
      renderPresenceMask();

      // Build new shape into temp, then carve out existing shapes.
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, temp.width, temp.height);
      drawTo(tctx, path, color, fillRule);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.globalAlpha = 1;
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = 'source-over';

      tgctx.setTransform(1, 0, 0, 1, 0, 0);
      tgctx.clearRect(0, 0, tempGlow.width, tempGlow.height);
      if (paletteIndex === Math.round(config.emission.paletteIndex)) drawEmission(tgctx, cx, cy, r, color);
      tgctx.globalCompositeOperation = 'destination-out';
      tgctx.globalAlpha = 1;
      tgctx.drawImage(mask, 0, 0);
      tgctx.globalCompositeOperation = 'source-over';

      // Carve existing shapes/glow using the new shape.
      applyCarve(sctx, path, fillRule);
      applyCarve(gctx, path, fillRule);

      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.drawImage(temp, 0, 0);
      gctx.globalCompositeOperation = 'source-over';
      gctx.globalAlpha = 1;
      gctx.drawImage(tempGlow, 0, 0);
      return;
    }

    // oneWay
    applyCarve(sctx, path, fillRule);
    applyCarve(gctx, path, fillRule);
    drawTo(sctx, path, color, fillRule);
    if (paletteIndex === Math.round(config.emission.paletteIndex)) drawEmission(gctx, cx, cy, r, color);
  };

  const count = Math.max(0, Math.round(config.circles.count));
  const rMin = Math.max(0.1, Number(config.circles.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.circles.rMaxPx) || rMin);

  type CircleInstance = {
    order: number;
    cx: number;
    cy: number;
    r: number;
    paletteIndex: number;
    croissantPhi?: number;
  };
  const oneWayPriority = collisionsEnabled && direction === 'oneWay';
  const instances: CircleInstance[] = oneWayPriority ? [] : [];
  let order = 0;

  if (config.circles.mode === 'grid') {
    const grid = Math.max(1, Math.round(Math.sqrt(count)));
    const gx = grid;
    const gy = Math.max(1, Math.round(count / grid));
    const cellW = (c.width - inset * 2) / gx;
    const cellH = (c.height - inset * 2) / gy;
    const j = clamp(config.circles.jitter, 0, 1);

    let i = 0;
    for (let y = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) {
        if (i >= count) break;
        const cx = inset + (x + 0.5) * cellW + (rng() - 0.5) * cellW * j;
        const cy = inset + (y + 0.5) * cellH + (rng() - 0.5) * cellH * j;
        const r = rMin + rng() * (rMax - rMin);
        const paletteIndex = pickIndex(i);
        if (oneWayPriority) {
          const phi = croissant.enabled ? ((rng() - 0.5) * croissant.angleJitterDeg * Math.PI) / 180 : undefined;
          instances.push({ order: order++, cx, cy, r, paletteIndex, croissantPhi: phi });
        } else {
          drawShape(cx, cy, r, paletteIndex);
        }
        i++;
      }
    }
  } else {
    const j = clamp(config.circles.jitter, 0, 1);
    for (let i = 0; i < count; i++) {
      const r = rMin + rng() * (rMax - rMin);
      const cx = inset + rng() * (c.width - inset * 2);
      const cy = inset + rng() * (c.height - inset * 2);
      const cxJ = cx + (rng() - 0.5) * r * 2 * j;
      const cyJ = cy + (rng() - 0.5) * r * 2 * j;
      const paletteIndex = pickIndex(i);
      if (oneWayPriority) {
        const phi = croissant.enabled ? ((rng() - 0.5) * croissant.angleJitterDeg * Math.PI) / 180 : undefined;
        instances.push({ order: order++, cx: cxJ, cy: cyJ, r, paletteIndex, croissantPhi: phi });
      } else {
        drawShape(cxJ, cyJ, r, paletteIndex);
      }
    }
  }

  if (oneWayPriority) {
    instances.sort((a, b) => {
      const wa = Number(weights[a.paletteIndex] ?? 0);
      const wb = Number(weights[b.paletteIndex] ?? 0);
      if (wa !== wb) return wa - wb;
      return a.order - b.order;
    });

    for (const it of instances) {
      drawShape(it.cx, it.cy, it.r, it.paletteIndex, it.croissantPhi);
    }
  }

  if (shapes) {
    ctx.drawImage(shapes, 0, 0);
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
