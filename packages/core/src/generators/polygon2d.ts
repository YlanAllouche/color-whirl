import type { Polygon2DConfig } from '../types.js';
import { createRng } from '../types.js';
import { resolvePaletteConfig } from '../palette.js';

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

function buildPolygonPath(cx: number, cy: number, r: number, edges: number, thetaRad: number): Path2D {
  const e = Math.max(3, Math.round(edges));
  const path = new Path2D();
  for (let i = 0; i < e; i++) {
    const a = thetaRad + (i / e) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function buildStarPath(cx: number, cy: number, rOuter: number, edges: number, thetaRad: number, innerScale: number): Path2D {
  const spikes = Math.max(3, Math.round(edges));
  const rIn = Math.max(0.1, rOuter * clamp(innerScale, 0.05, 0.95));
  const path = new Path2D();
  const n = spikes * 2;
  for (let i = 0; i < n; i++) {
    const a = thetaRad + (i / n) * Math.PI * 2;
    const rr = i % 2 === 0 ? rOuter : rIn;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

export function renderPolygon2DToCanvas(config: Polygon2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
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
  const weights = normalizeWeights(config.polygons.colorWeights, nColors);

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const fillOpacity = clamp(config.polygons.fillOpacity, 0, 1);
  const strokeEnabled = !!config.polygons.stroke.enabled;
  const strokeW = Math.max(0, config.polygons.stroke.widthPx);
  const strokeOpacity = clamp(config.polygons.stroke.opacity, 0, 1);
  const edges = Math.max(3, Math.round(config.polygons.edges));
  const shape = config.polygons.shape === 'star' ? 'star' : 'polygon';
  const starInner = clamp(Number(config.polygons.star?.innerScale) || 0.5, 0.05, 0.95);

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
    if (config.polygons.paletteMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weights);
  };

  const emissionByIndex = Array.from({ length: nColors }, (_, i) => {
    const e = resolvePaletteConfig(config as any, i).emission;
    return { enabled: !!e.enabled && !!config.bloom.enabled, intensity: e.intensity };
  });

  const drawTo = (target: CanvasRenderingContext2D, path: Path2D, fill: string) => {
    target.fillStyle = rgba(fill, fillOpacity);
    target.fill(path);
    if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
      target.lineWidth = strokeW;
      target.lineJoin = 'round';
      target.strokeStyle = rgba(config.polygons.stroke.color, strokeOpacity);
      target.stroke(path);
    }
  };

  const drawEmission = (target: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, theta: number, emit: number) => {
    if (!config.bloom.enabled) return;
    const e = Math.max(0, Number(emit) || 0);
    if (!(e > 0)) return;
    const s = 1.0 + clamp(e * 0.03, 0, 0.8);
    const glowPath = shape === 'star'
      ? buildStarPath(cx, cy, r * s, edges, theta, starInner)
      : buildPolygonPath(cx, cy, r * s, edges, theta);
    target.fillStyle = rgba(fill, clamp(0.06 + e * 0.02, 0, 1));
    target.fill(glowPath);
  };

  const count = Math.max(0, Math.round(config.polygons.count));
  const rMin = Math.max(0.1, Number(config.polygons.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.polygons.rMaxPx) || rMin);
  const j = clamp(config.polygons.jitter, 0, 1);
  const rotJ = ((Number(config.polygons.rotateJitterDeg) || 0) * Math.PI) / 180;

  type PolyInstance = { order: number; cx: number; cy: number; r: number; theta: number; paletteIndex: number };
  const oneWayPriority = collisionsEnabled && direction === 'oneWay';
  const instances: PolyInstance[] = oneWayPriority ? [] : [];
  let order = 0;

  const renderAt = (cxJ: number, cyJ: number, r: number, theta: number, paletteIndex: number) => {
    const color = config.colors[paletteIndex] ?? '#ffffff';
    const path = shape === 'star'
      ? buildStarPath(cxJ, cyJ, r, edges, theta, starInner)
      : buildPolygonPath(cxJ, cyJ, r, edges, theta);

    if (!collisionsEnabled) {
      drawTo(sctx, path, color);
      const em = emissionByIndex[paletteIndex];
      if (em?.enabled) drawEmission(gctx, cxJ, cyJ, r, color, theta, em.intensity);
      return;
    }

    if (direction === 'twoWay' && shapes && mask && mctx && temp && tctx && tempGlow && tgctx) {
      renderPresenceMask();

      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, temp.width, temp.height);
      drawTo(tctx, path, color);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.globalAlpha = 1;
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = 'source-over';

      tgctx.setTransform(1, 0, 0, 1, 0, 0);
      tgctx.clearRect(0, 0, tempGlow.width, tempGlow.height);
      {
        const em = emissionByIndex[paletteIndex];
        if (em?.enabled) drawEmission(tgctx, cxJ, cyJ, r, color, theta, em.intensity);
      }
      tgctx.globalCompositeOperation = 'destination-out';
      tgctx.globalAlpha = 1;
      tgctx.drawImage(mask, 0, 0);
      tgctx.globalCompositeOperation = 'source-over';

      applyCarve(sctx, path);
      applyCarve(gctx, path);

      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.drawImage(temp, 0, 0);
      gctx.globalCompositeOperation = 'source-over';
      gctx.globalAlpha = 1;
      gctx.drawImage(tempGlow, 0, 0);
      return;
    }

    applyCarve(sctx, path);
    applyCarve(gctx, path);
    drawTo(sctx, path, color);
    {
      const em = emissionByIndex[paletteIndex];
      if (em?.enabled) drawEmission(gctx, cxJ, cyJ, r, color, theta, em.intensity);
    }
  };

  if (config.polygons.mode === 'grid') {
    const grid = config.polygons.grid;
    const cell = Math.max(6, Number(grid?.cellPx) || 6);
    const gJ = clamp(Number(grid?.jitter) || 0, 0, 1);
    const kind = grid?.kind === 'diamond' ? 'diamond' : 'square';

    // Use `count` as a cap to avoid huge renders.
    const max = count;
    let i = 0;

    if (kind === 'square') {
      const cols = Math.ceil(c.width / cell) + 2;
      const rows = Math.ceil(c.height / cell) + 2;
      for (let gy = -1; gy <= rows; gy++) {
        for (let gx = -1; gx <= cols; gx++) {
          if (i >= max) break;
          const baseX = (gx + 0.5) * cell;
          const baseY = (gy + 0.5) * cell;
          const jx = (rng() - 0.5) * cell * 0.9 * gJ;
          const jy = (rng() - 0.5) * cell * 0.9 * gJ;
          const r0 = rMin + rng() * (rMax - rMin);
          const r = Math.min(r0, cell * 0.55);
          const cx0 = baseX + jx;
          const cy0 = baseY + jy;
          const cxJ = cx0 + (rng() - 0.5) * r * 2 * j;
          const cyJ = cy0 + (rng() - 0.5) * r * 2 * j;
          const theta = (rng() - 0.5) * rotJ;
          const paletteIndex = pickIndex(i);
          if (oneWayPriority) instances.push({ order: order++, cx: cxJ, cy: cyJ, r, theta, paletteIndex });
          else renderAt(cxJ, cyJ, r, theta, paletteIndex);
          i++;
        }
        if (i >= max) break;
      }
    } else {
      const a = cell * 0.5;
      const b = cell * 0.5;
      const originX = 0;
      const originY = 0;

      const xMin = -cell;
      const yMin = -cell;
      const xMax = c.width + cell;
      const yMax = c.height + cell;
      const invU = (x: number, y: number) => 0.5 * ((x - originX) / a + (y - originY) / b);
      const invV = (x: number, y: number) => 0.5 * ((y - originY) / b - (x - originX) / a);
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
      const pad = 2;
      const u0 = Math.floor(uMin) - pad;
      const u1 = Math.ceil(uMax) + pad;
      const v0 = Math.floor(vMin) - pad;
      const v1 = Math.ceil(vMax) + pad;

      for (let vv = v0; vv <= v1; vv++) {
        for (let uu = u0; uu <= u1; uu++) {
          if (i >= max) break;
          const baseX = originX + (uu - vv) * a;
          const baseY = originY + (uu + vv) * b;
          if (baseX < xMin - a || baseX > xMax + a || baseY < yMin - b || baseY > yMax + b) continue;
          const jx = (rng() - 0.5) * cell * 0.9 * gJ;
          const jy = (rng() - 0.5) * cell * 0.9 * gJ;
          const r0 = rMin + rng() * (rMax - rMin);
          const r = Math.min(r0, cell * 0.55);
          const cx0 = baseX + jx;
          const cy0 = baseY + jy;
          const cxJ = cx0 + (rng() - 0.5) * r * 2 * j;
          const cyJ = cy0 + (rng() - 0.5) * r * 2 * j;
          const theta = (rng() - 0.5) * rotJ;
          const paletteIndex = pickIndex(i);
          if (oneWayPriority) instances.push({ order: order++, cx: cxJ, cy: cyJ, r, theta, paletteIndex });
          else renderAt(cxJ, cyJ, r, theta, paletteIndex);
          i++;
        }
        if (i >= max) break;
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const r = rMin + rng() * (rMax - rMin);
      const cx = rng() * c.width;
      const cy = rng() * c.height;
      const cxJ = cx + (rng() - 0.5) * r * 2 * j;
      const cyJ = cy + (rng() - 0.5) * r * 2 * j;
      const theta = (rng() - 0.5) * rotJ;

      const paletteIndex = pickIndex(i);
      if (oneWayPriority) {
        instances.push({ order: order++, cx: cxJ, cy: cyJ, r, theta, paletteIndex });
      } else {
        renderAt(cxJ, cyJ, r, theta, paletteIndex);
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
      renderAt(it.cx, it.cy, it.r, it.theta, it.paletteIndex);
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
