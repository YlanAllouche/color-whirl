import type { DiamondGrid2DConfig, PaletteAssignMode } from '../types.js';

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

function adjustHex(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const adj = (v: number) => Math.round(clamp(v + k * 255, 0, 255));
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
}

function hashU32(x: number): number {
  x >>>= 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function cellRand01(seedU32: number, a: number, b: number, channel: number): number {
  let x = (seedU32 ^ hashU32(a * 0x9e3779b1) ^ hashU32(b * 0x85ebca6b) ^ hashU32(channel * 0xc2b2ae35)) >>> 0;
  x = hashU32(x);
  return (x >>> 0) / 4294967296;
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  const uu = clamp(u, 0, 0.999999999);
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (uu <= acc) return i;
  }
  return Math.max(0, wNorm.length - 1);
}

function pickPaletteIndex(seedU32: number, mode: PaletteAssignMode, weightsNorm: number[], u: number, v: number, ch: number): number {
  const n = Math.max(1, weightsNorm.length);
  if (mode === 'cycle') return (((u + v) % n) + n) % n;
  return sampleWeightedIndex01(cellRand01(seedU32, u, v, ch), weightsNorm);
}

function diamondCenter(originX: number, originY: number, a: number, b: number, u: number, v: number): { x: number; y: number } {
  // Isometric/diamond grid: axes are (a,b) and (-a,b)
  return {
    x: originX + (u - v) * a,
    y: originY + (u + v) * b
  };
}

export function renderDiamondGrid2DToCanvas(config: DiamondGrid2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const dg = (config as any).diamondgrid;
  const seedU32 = (config.seed >>> 0) || 1;
  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(dg?.coloring?.colorWeights ?? dg?.colorWeights ?? [], n);
  const paletteMode: PaletteAssignMode = (dg?.coloring?.paletteMode ?? dg?.paletteMode) === 'cycle' ? 'cycle' : 'weighted';

  const tileW = Math.max(2, Number(dg?.tileWidthPx) || 2);
  const tileH = Math.max(2, Number(dg?.tileHeightPx) || 2);
  const marginPx = Math.max(0, Number(dg?.marginPx) || 0);
  const sizeVariance = clamp01(Number(dg?.sizeVariance) || 0);
  const overscan = Math.max(0, Number(dg?.overscanPx) || 0);
  const originX = Number(dg?.originPx?.x) || 0;
  const originY = Number(dg?.originPx?.y) || 0;
  const panelEnabled = !!dg?.panel?.enabled;
  const panelRect = dg?.panel?.rectFrac ?? {};
  const panelX = clamp(Number(panelRect.x) || 0, 0, 1);
  const panelY = clamp(Number(panelRect.y) || 0, 0, 1);
  const panelW = clamp(Number(panelRect.w) || 1, 0.02, 1);
  const panelH = clamp(Number(panelRect.h) || 1, 0.02, 1);
  const panelMinX = c.width * panelX;
  const panelMinY = c.height * panelY;
  const panelMaxX = c.width * (panelX + panelW);
  const panelMaxY = c.height * (panelY + panelH);

  const fillOpacity = clamp01(Number(dg?.fillOpacity) || 0);

  const strokeEnabled = !!dg?.stroke?.enabled;
  const strokeW = strokeEnabled ? Math.max(0, Number(dg?.stroke?.widthPx) || 0) : 0;
  const strokeOpacity = strokeEnabled ? clamp01(Number(dg?.stroke?.opacity) || 0) : 0;
  const strokeColor = typeof dg?.stroke?.color === 'string' ? String(dg.stroke.color) : '#000000';
  const strokeJoin = dg?.stroke?.join === 'bevel' ? 'bevel' : dg?.stroke?.join === 'miter' ? 'miter' : 'round';

  const bevelEnabled = !!dg?.bevel?.enabled;
  const bevelAmt = clamp01(Number(dg?.bevel?.amount) || 0);
  const bevelMode = dg?.bevel?.mode === 'concave' ? 'concave' : 'convex';
  const bevelLightDeg = Number(dg?.bevel?.lightDeg) || 0;
  const bevelVar = clamp01(Number(dg?.bevel?.variation) || 0);

  const a0 = tileW * 0.5;
  const b0 = tileH * 0.5;
  const shrink = marginPx * 0.5 + strokeW * 0.5;
  const maxScale = 1 + sizeVariance;

  // Inverse bounds (conservative): from pixel bounds to (u,v) ranges.
  const xMin = -overscan;
  const yMin = -overscan;
  const xMax = c.width + overscan;
  const yMax = c.height + overscan;

  // Inverse transform:
  // x = ox + (u-v)*a
  // y = oy + (u+v)*b
  // => u = 0.5*((x-ox)/a + (y-oy)/b)
  // => v = 0.5*((y-oy)/b - (x-ox)/a)
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

  ctx.lineJoin = strokeJoin;
  ctx.lineCap = 'round';

  const lightBaseRad = (bevelLightDeg * Math.PI) / 180;

  for (let vv = v0; vv <= v1; vv++) {
    for (let uu = u0; uu <= u1; uu++) {
      const center = diamondCenter(originX, originY, a0, b0, uu, vv);
      const cx = center.x;
      const cy = center.y;

      if (panelEnabled && (cx < panelMinX || cx > panelMaxX || cy < panelMinY || cy > panelMaxY)) continue;

      // Offscreen reject.
      if (cx < xMin - a0 * maxScale || cx > xMax + a0 * maxScale || cy < yMin - b0 * maxScale || cy > yMax + b0 * maxScale) continue;

      const scale = 1 + (cellRand01(seedU32, uu, vv, 5101) * 2 - 1) * sizeVariance;
      const a = Math.max(0.5, a0 * Math.max(0.1, scale) - shrink);
      const b = Math.max(0.5, b0 * Math.max(0.1, scale) - shrink);

      const ci = pickPaletteIndex(seedU32, paletteMode, weightsNorm, uu, vv, 5001);
      const baseCol = colors[ci % colors.length] ?? '#ffffff';

      const p = new Path2D();
      p.moveTo(cx, cy - b);
      p.lineTo(cx + a, cy);
      p.lineTo(cx, cy + b);
      p.lineTo(cx - a, cy);
      p.closePath();

      if (fillOpacity > 0) {
        if (bevelEnabled && bevelAmt > 0) {
          const j = bevelVar > 0 ? (cellRand01(seedU32, uu, vv, 6001) - 0.5) * 2 * bevelVar : 0;
          const j2 = bevelVar > 0 ? (cellRand01(seedU32, uu, vv, 6002) - 0.5) * 2 * bevelVar : 0;
          const amt = clamp01(bevelAmt * (1 + j * 0.6));
          const ang = lightBaseRad + j2 * 0.45;
          const lx = Math.cos(ang);
          const ly = Math.sin(ang);

          const g = ctx.createLinearGradient(cx - lx * a, cy - ly * b, cx + lx * a, cy + ly * b);
          const hi = adjustHex(baseCol, (bevelMode === 'concave' ? -0.16 : 0.16) * amt);
          const lo = adjustHex(baseCol, (bevelMode === 'concave' ? 0.13 : -0.13) * amt);
          g.addColorStop(0, rgba(hi, fillOpacity));
          g.addColorStop(1, rgba(lo, fillOpacity));
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = rgba(baseCol, fillOpacity);
        }
        ctx.fill(p);
      }

      if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
        ctx.lineWidth = strokeW;
        ctx.strokeStyle = rgba(strokeColor, strokeOpacity);
        ctx.stroke(p);
      }

    }
  }

  return c;
}
