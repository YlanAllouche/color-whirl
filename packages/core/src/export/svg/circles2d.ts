import type { WallpaperConfig } from '../../types.js';
import { clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateCircles2DSVG(config: Extract<WallpaperConfig, { type: 'circles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(config.circles.count));
  const rMin = Math.max(0.1, Number(config.circles.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.circles.rMaxPx) || rMin);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => {
    const x = ((seed ^ (i * 0x9e3779b1)) + ch * 0x85ebca6b) >>> 0;
    let t = x;
    t ^= t >>> 16;
    t = Math.imul(t, 0x7feb352d);
    t ^= t >>> 15;
    t = Math.imul(t, 0x846ca68b);
    t ^= t >>> 16;
    return (t >>> 0) / 4294967296;
  };

  const w = normalizeWeights(config.circles.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.circles.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), w);
  };

  const fillOpacity = clamp01(Number(config.circles.fillOpacity) || 0);
  const j = clamp01(Number(config.circles.jitter) || 0);
  const strokeEnabled = !!config.circles.stroke.enabled;
  const strokeW = Math.max(0, Number(config.circles.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.circles.stroke.opacity) || 0);
  const strokeAttr =
    strokeEnabled && strokeW > 0 && strokeOpacity > 0
      ? ` stroke="${config.circles.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
      : '';

  let svg = svgStart(width, height, backgroundColor);

  if (config.circles.mode === 'grid') {
    const grid = Math.max(1, Math.round(Math.sqrt(count)));
    const gx = grid;
    const gy = Math.max(1, Math.round(count / grid));
    const cellW = width / gx;
    const cellH = height / gy;

    let i = 0;
    for (let y = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) {
        if (i >= count) break;
        const r = rMin + rand01(i, 2) * (rMax - rMin);
        const cx = (x + 0.5) * cellW + (rand01(i, 3) - 0.5) * cellW * j;
        const cy = (y + 0.5) * cellH + (rand01(i, 4) - 0.5) * cellH * j;
        const idx = pickIndex(i);
        const color = colors[idx] ?? '#ffffff';

        if (config.circles.croissant.enabled) {
          const innerScale = Math.max(0.01, Math.min(0.99, config.circles.croissant.innerScale));
          const offset = Math.max(0, Math.min(1, config.circles.croissant.offset));
          const phi = ((rand01(i, 5) - 0.5) * (config.circles.croissant.angleJitterDeg || 0) * Math.PI) / 180;
          const dx = Math.cos(phi) * r * offset;
          const dy = Math.sin(phi) * r * offset;

          const d = [
            `M ${cx + r} ${cy}`,
            `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
            `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
            'Z',
            `M ${cx + dx + r * innerScale} ${cy + dy}`,
            `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx - r * innerScale} ${cy + dy}`,
            `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx + r * innerScale} ${cy + dy}`,
            'Z'
          ].join(' ');

          svg += `  <path d="${d}" fill="${color}" fill-rule="evenodd" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        } else {
          svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        }

        i++;
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const r = rMin + rand01(i, 2) * (rMax - rMin);
      const cx0 = rand01(i, 3) * width;
      const cy0 = rand01(i, 4) * height;
      const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
      const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
      const idx = pickIndex(i);
      const color = colors[idx] ?? '#ffffff';

      if (config.circles.croissant.enabled) {
        const innerScale = Math.max(0.01, Math.min(0.99, config.circles.croissant.innerScale));
        const offset = Math.max(0, Math.min(1, config.circles.croissant.offset));
        const phi = ((rand01(i, 5) - 0.5) * (config.circles.croissant.angleJitterDeg || 0) * Math.PI) / 180;
        const dx = Math.cos(phi) * r * offset;
        const dy = Math.sin(phi) * r * offset;

        const d = [
          `M ${cx + r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
          'Z',
          `M ${cx + dx + r * innerScale} ${cy + dy}`,
          `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx - r * innerScale} ${cy + dy}`,
          `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx + r * innerScale} ${cy + dy}`,
          'Z'
        ].join(' ');

        svg += `  <path d="${d}" fill="${color}" fill-rule="evenodd" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      } else {
        svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      }
    }
  }

  svg += svgEnd();
  return svg;
}
