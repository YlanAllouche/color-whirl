import type { WallpaperConfig } from '../../types.js';
import { adjustHex, cellRand01, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateTriangles3DSVG(config: Extract<WallpaperConfig, { type: 'triangles3d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.prisms.count));
  const s = Math.max(12, config.prisms.radius * 180);

  const isSquare = config.prisms.base === 'pyramidSquare';
  const taper = clamp(Number(config.prisms.taper ?? 1), 0, 1);
  const sides = isSquare ? 4 : 3;
  const a0 = isSquare ? Math.PI / 4 : Math.PI / 6;

  const spread = Math.max(0, Number(config.prisms.spread) || 0);
  const jitter = clamp01(Number(config.prisms.jitter) || 0);
  const radius = Math.max(0.0001, Number(config.prisms.radius) || 0.2);

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.prisms.colorWeights, n);
  let svg = svgStart(width, height, backgroundColor);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const mode = config.prisms.mode;
  const posForIndex = (i: number): { x: number; y: number } => {
    let x = 0;
    let y = 0;
    if (mode === 'tessellation') {
      const gx = Math.max(1, Math.round(Math.sqrt(count)));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = spread === 0 ? 0 : (spread * 2) / gx;
      const cellH = spread === 0 ? 0 : (spread * 2) / gy;
      x = -spread + (cx + 0.5) * cellW;
      y = -spread + (cy + 0.5) * cellH;
    } else {
      x = (rand01(i, 2) - 0.5) * 2 * spread;
      y = (rand01(i, 3) - 0.5) * 2 * spread;
    }

    x += (rand01(i, 4) - 0.5) * jitter * radius * 2;
    y += (rand01(i, 5) - 0.5) * jitter * radius * 2;
    return { x, y };
  };

  const denom = Math.max(0.0001, spread * 2);
  const opacity = clamp01(Number(config.prisms.opacity) || 0);
  for (let i = 0; i < count; i++) {
    const p = posForIndex(i);
    const u = rand01(i, 1);
    const a = rand01(i, 6) * Math.PI * 2;
    const cx = (p.x / denom + 0.5) * width;
    const cy = (p.y / denom + 0.5) * height;

    const idx = config.prisms.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const pts: string[] = [];
    for (let k = 0; k < sides; k++) {
      const ang = a + a0 + (k / sides) * Math.PI * 2;
      pts.push(`${cx + Math.cos(ang) * s},${cy + Math.sin(ang) * s}`);
    }
    svg += `  <polygon points="${pts.join(' ')}" fill="${col}" opacity="${opacity}"/>\n`;

    if (taper < 0.999999) {
      const s2 = s * taper;
      const topCol = adjustHex(col, -0.08 * (1 - taper));
      const op2 = opacity * 0.55;
      if (s2 < 0.75) {
        const rr = Math.max(1, s * 0.08);
        svg += `  <circle cx="${cx}" cy="${cy}" r="${rr}" fill="${topCol}" opacity="${op2}"/>\n`;
      } else {
        const pts2: string[] = [];
        for (let k = 0; k < sides; k++) {
          const ang = a + a0 + (k / sides) * Math.PI * 2;
          pts2.push(`${cx + Math.cos(ang) * s2},${cy + Math.sin(ang) * s2}`);
        }
        svg += `  <polygon points="${pts2.join(' ')}" fill="${topCol}" opacity="${op2}"/>\n`;
      }
    }
  }
  svg += svgEnd();
  return svg;
}
