import type { Triangles2DConfig } from '../types.js';
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

function adjustHex(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const adj = (v: number) => Math.round(clamp(v + k * 255, 0, 255));
  const rr = adj(r);
  const gg = adj(g);
  const bb = adj(b);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
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
    ctx.globalAlpha = clamp(strength * 0.22, 0, 1);
    ctx.drawImage(tmp, 0, 0);
  }

  ctx.restore();
}

export function renderTriangles2DToCanvas(config: Triangles2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
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

  const rng = createRng(config.seed);
  const nColors = Math.max(1, config.colors.length);
  const weights = normalizeWeights(config.triangles.colorWeights, nColors);
  const inset = Math.max(0, Number(config.triangles.insetPx) || 0);

  const fillOpacity = clamp(config.triangles.fillOpacity, 0, 1);
  const strokeEnabled = !!config.triangles.stroke.enabled;
  const strokeW = Math.max(0, config.triangles.stroke.widthPx);
  const strokeOpacity = clamp(config.triangles.stroke.opacity, 0, 1);

  const pickIndex = (i: number): number => {
    if (config.triangles.paletteMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weights);
  };

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const carveMargin = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
  const carveFeather = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;

  const applyCarve = (target: CanvasRenderingContext2D, path: Path2D) => {
    if (!collisionsEnabled) return;
    const m = carveMargin;
    const f = carveFeather;

    target.save();
    target.globalCompositeOperation = 'destination-out';
    target.globalAlpha = 1;
    target.fill(path);

    if (m > 0) {
      target.lineJoin = 'round';
      target.lineCap = 'round';
      target.lineWidth = m * 2;
      target.stroke(path);
    }

    if (f > 0) {
      const steps = Math.max(1, Math.min(12, Math.round(f)));
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
      const samples = Math.max(8, Math.min(32, Math.round(marginPx * 1.25)));
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

  const lightRad = ((Number(config.triangles.shading.lightDeg) || 0) * Math.PI) / 180;
  const lx = Math.cos(lightRad);
  const ly = Math.sin(lightRad);
  const shadeStrength = clamp(config.triangles.shading.strength, 0, 1);

  const drawTo = (target: CanvasRenderingContext2D, path: Path2D, fill: string) => {
    target.fillStyle = rgba(fill, fillOpacity);
    target.fill(path);
    if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
      target.lineWidth = strokeW;
      target.lineJoin = 'round';
      target.strokeStyle = rgba(config.triangles.stroke.color, strokeOpacity);
      target.stroke(path);
    }
  };

  const drawGlow = (target: CanvasRenderingContext2D, path: Path2D, fill: string) => {
    if (!config.emission.enabled || !config.bloom.enabled) return;
    const emit = Math.max(0, Number(config.emission.intensity) || 0);
    if (!(emit > 0)) return;
    target.fillStyle = rgba(fill, clamp(0.04 + emit * 0.02, 0, 1));
    target.fill(path);
  };

  const drawTri = (ax: number, ay: number, bx: number, by: number, cx1: number, cy1: number, idx: number) => {
    const base = config.colors[idx] ?? '#ffffff';
    let fill = base;
    if (config.triangles.shading.enabled) {
      const mx = (ax + bx + cx1) / 3;
      const my = (ay + by + cy1) / 3;
      const nx = (mx - c.width * 0.5) / Math.max(1, c.width);
      const ny = (my - c.height * 0.5) / Math.max(1, c.height);
      const d = clamp(nx * lx + ny * ly, -1, 1);
      const k = d * 0.18 * shadeStrength;
      fill = adjustHex(base, k);
    }

    const p = new Path2D();
    p.moveTo(ax, ay);
    p.lineTo(bx, by);
    p.lineTo(cx1, cy1);
    p.closePath();

    const emitIdx = Math.round(config.emission.paletteIndex);
    const wantsGlow = config.emission.enabled && idx === emitIdx && config.bloom.enabled;

    if (!collisionsEnabled) {
      drawTo(sctx, p, fill);
      if (wantsGlow) drawGlow(gctx, p, fill);
      return;
    }

    if (direction === 'twoWay' && shapes && mask && mctx && temp && tctx && tempGlow && tgctx) {
      renderPresenceMask();

      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, temp.width, temp.height);
      drawTo(tctx, p, fill);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.globalAlpha = 1;
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = 'source-over';

      tgctx.setTransform(1, 0, 0, 1, 0, 0);
      tgctx.clearRect(0, 0, tempGlow.width, tempGlow.height);
      if (wantsGlow) drawGlow(tgctx, p, fill);
      tgctx.globalCompositeOperation = 'destination-out';
      tgctx.globalAlpha = 1;
      tgctx.drawImage(mask, 0, 0);
      tgctx.globalCompositeOperation = 'source-over';

      applyCarve(sctx, p);
      applyCarve(gctx, p);

      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.drawImage(temp, 0, 0);
      gctx.globalCompositeOperation = 'source-over';
      gctx.globalAlpha = 1;
      gctx.drawImage(tempGlow, 0, 0);
      return;
    }

    applyCarve(sctx, p);
    applyCarve(gctx, p);
    drawTo(sctx, p, fill);
    if (wantsGlow) drawGlow(gctx, p, fill);
  };

  const mode = config.triangles.mode;
  const scale = Math.max(4, Number(config.triangles.scalePx) || 60);
  const jitter = clamp(config.triangles.jitter, 0, 1);

  if (mode === 'scatter') {
    const density = Math.max(0.05, Number(config.triangles.density) || 1);
    const approxCount = Math.round((density * (c.width * c.height)) / (scale * scale));
    const count = Math.max(1, Math.min(6000, approxCount));
    const rotJ = ((Number(config.triangles.rotateJitterDeg) || 0) * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const idx = pickIndex(i);
      const cx0 = inset + rng() * (c.width - inset * 2);
      const cy0 = inset + rng() * (c.height - inset * 2);
      const s = scale * (0.4 + rng() * 0.8);
      const a = rng() * Math.PI * 2;
      const theta = a + (rng() - 0.5) * rotJ;

      const ax = cx0 + Math.cos(theta) * s;
      const ay = cy0 + Math.sin(theta) * s;
      const bx = cx0 + Math.cos(theta + (2 * Math.PI) / 3) * s;
      const by = cy0 + Math.sin(theta + (2 * Math.PI) / 3) * s;
      const cx1 = cx0 + Math.cos(theta + (4 * Math.PI) / 3) * s;
      const cy1 = cy0 + Math.sin(theta + (4 * Math.PI) / 3) * s;

      drawTri(ax, ay, bx, by, cx1, cy1, idx);
    }
  } else {
    const sqrt3 = 1.7320508075688772;

    if (mode === 'lowpoly') {
      const step = Math.max(12, scale);
      const cols = Math.ceil((c.width - inset * 2) / step) + 2;
      const rows = Math.ceil((c.height - inset * 2) / step) + 2;
      const pts: Array<{ x: number; y: number }> = [];

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = inset + x * step + (rng() - 0.5) * step * jitter;
          const py = inset + y * step + (rng() - 0.5) * step * jitter;
          pts.push({ x: px, y: py });
        }
      }

      const idxAt = (x: number, y: number) => y * cols + x;
      let t = 0;
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const p00 = pts[idxAt(x, y)];
          const p10 = pts[idxAt(x + 1, y)];
          const p01 = pts[idxAt(x, y + 1)];
          const p11 = pts[idxAt(x + 1, y + 1)];
          const flip = rng() < 0.5;
          const i0 = pickIndex(t++);
          const i1 = pickIndex(t++);
          if (flip) {
            drawTri(p00.x, p00.y, p10.x, p10.y, p11.x, p11.y, i0);
            drawTri(p00.x, p00.y, p11.x, p11.y, p01.x, p01.y, i1);
          } else {
            drawTri(p00.x, p00.y, p10.x, p10.y, p01.x, p01.y, i0);
            drawTri(p10.x, p10.y, p11.x, p11.y, p01.x, p01.y, i1);
          }
        }
      }
    } else {
      const s = scale;
      const h = (s * sqrt3) / 2;
      const cols = Math.ceil((c.width - inset * 2) / s) + 3;
      const rows = Math.ceil((c.height - inset * 2) / h) + 3;

      let t = 0;
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const x0 = inset + rx * s + (ry % 2 === 0 ? 0 : s / 2);
          const y0 = inset + ry * h;

          const jx = (rng() - 0.5) * s * jitter;
          const jy = (rng() - 0.5) * h * jitter;

          const a1x = x0 + jx;
          const a1y = y0 + jy;
          const b1x = x0 + s / 2 + jx;
          const b1y = y0 + h + jy;
          const c1x = x0 - s / 2 + jx;
          const c1y = y0 + h + jy;
          drawTri(a1x, a1y, b1x, b1y, c1x, c1y, pickIndex(t++));

          const a2x = x0 + jx;
          const a2y = y0 + 2 * h + jy;
          const b2x = x0 + s / 2 + jx;
          const b2y = y0 + h + jy;
          const c2x = x0 - s / 2 + jx;
          const c2y = y0 + h + jy;
          drawTri(a2x, a2y, b2x, b2y, c2x, c2y, pickIndex(t++));
        }
      }
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
