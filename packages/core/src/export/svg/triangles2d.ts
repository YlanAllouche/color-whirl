import type { WallpaperConfig } from '../../types.js';
import { adjustHex, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateTriangles2DSVG(config: Extract<WallpaperConfig, { type: 'triangles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const scale = Math.max(4, Number(config.triangles.scalePx) || 60);
  const inset = Math.max(0, Number(config.triangles.insetPx) || 0);
  const fillOpacity = clamp01(Number(config.triangles.fillOpacity) || 0);

  const strokeEnabled = !!config.triangles.stroke.enabled;
  const strokeW = Math.max(0, Number(config.triangles.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.triangles.stroke.opacity) || 0);
  const strokeAttr =
    strokeEnabled && strokeW > 0 && strokeOpacity > 0
      ? ` stroke="${config.triangles.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
      : '';

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

  const weightsNorm = normalizeWeights(config.triangles.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.triangles.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  const shadingEnabled = !!config.triangles.shading.enabled;
  const shadeStrength = clamp01(Number(config.triangles.shading.strength) || 0);
  const lightRad = ((Number(config.triangles.shading.lightDeg) || 0) * Math.PI) / 180;
  const lx = Math.cos(lightRad);
  const ly = Math.sin(lightRad);

  const shadeFill = (base: string, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): string => {
    if (!shadingEnabled || !(shadeStrength > 0)) return base;
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const nx = (mx - width * 0.5) / Math.max(1, width);
    const ny = (my - height * 0.5) / Math.max(1, height);
    const d = clamp(nx * lx + ny * ly, -1, 1);
    const k = d * 0.18 * shadeStrength;
    return adjustHex(base, k);
  };

  const jitter = clamp01(Number(config.triangles.jitter) || 0);
  const mode = config.triangles.mode;

  let svg = svgStart(width, height, backgroundColor);

  const sqrt3 = 1.7320508075688772;

  if (mode === 'scatter') {
    const density = Math.max(0.05, Number(config.triangles.density) || 1);
    const approxCount = Math.round((density * (width * height)) / (scale * scale));
    const count = Math.max(1, Math.min(6000, approxCount));
    const rotJ = ((Number(config.triangles.rotateJitterDeg) || 0) * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const idx = pickIndex(i);
      const base = colors[idx] ?? '#ffffff';

      const cx0 = inset + rand01(i, 2) * (width - inset * 2);
      const cy0 = inset + rand01(i, 3) * (height - inset * 2);
      const s = scale * (0.4 + rand01(i, 4) * 0.8);
      const a = rand01(i, 5) * Math.PI * 2;
      const theta = a + (rand01(i, 6) - 0.5) * rotJ;

      const ax = cx0 + Math.cos(theta) * s;
      const ay = cy0 + Math.sin(theta) * s;
      const bx = cx0 + Math.cos(theta + (2 * Math.PI) / 3) * s;
      const by = cy0 + Math.sin(theta + (2 * Math.PI) / 3) * s;
      const cx = cx0 + Math.cos(theta + (4 * Math.PI) / 3) * s;
      const cy = cy0 + Math.sin(theta + (4 * Math.PI) / 3) * s;

      const fill = shadeFill(base, ax, ay, bx, by, cx, cy);
      svg += `  <polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="${fill}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
    }
  } else if (mode === 'lowpoly') {
    const step = Math.max(12, scale);
    const cols = Math.ceil((width - inset * 2) / step) + 2;
    const rows = Math.ceil((height - inset * 2) / step) + 2;
    const pts: Array<{ x: number; y: number }> = [];

    let p = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = inset + x * step + (rand01(p, 2) - 0.5) * step * jitter;
        const py = inset + y * step + (rand01(p, 3) - 0.5) * step * jitter;
        pts.push({ x: px, y: py });
        p++;
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

        const flip = rand01(t, 9) < 0.5;
        const i0 = pickIndex(t++);
        const i1 = pickIndex(t++);

        const base0 = colors[i0] ?? '#ffffff';
        const base1 = colors[i1] ?? '#ffffff';

        if (flip) {
          const fill0 = shadeFill(base0, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
          const fill1 = shadeFill(base1, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
          svg += `  <polygon points="${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
          svg += `  <polygon points="${p00.x},${p00.y} ${p11.x},${p11.y} ${p01.x},${p01.y}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        } else {
          const fill0 = shadeFill(base0, p00.x, p00.y, p10.x, p10.y, p01.x, p01.y);
          const fill1 = shadeFill(base1, p10.x, p10.y, p11.x, p11.y, p01.x, p01.y);
          svg += `  <polygon points="${p00.x},${p00.y} ${p10.x},${p10.y} ${p01.x},${p01.y}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
          svg += `  <polygon points="${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        }
      }
    }
  } else {
    const s = scale;
    const h = (s * sqrt3) / 2;
    const cols = Math.ceil((width - inset * 2) / s) + 3;
    const rows = Math.ceil((height - inset * 2) / h) + 3;

    let t = 0;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const x0 = inset + rx * s + (ry % 2 === 0 ? 0 : s / 2);
        const y0 = inset + ry * h;
        const jx = (rand01(t, 2) - 0.5) * s * jitter;
        const jy = (rand01(t, 3) - 0.5) * h * jitter;

        const idx0 = pickIndex(t++);
        const idx1 = pickIndex(t++);
        const base0 = colors[idx0] ?? '#ffffff';
        const base1 = colors[idx1] ?? '#ffffff';

        const ax1 = x0 + jx;
        const ay1 = y0 + jy;
        const bx1 = x0 + s / 2 + jx;
        const by1 = y0 + h + jy;
        const cx1 = x0 - s / 2 + jx;
        const cy1 = y0 + h + jy;

        const ax2 = x0 + jx;
        const ay2 = y0 + 2 * h + jy;
        const bx2 = x0 + s / 2 + jx;
        const by2 = y0 + h + jy;
        const cx2 = x0 - s / 2 + jx;
        const cy2 = y0 + h + jy;

        const fill0 = shadeFill(base0, ax1, ay1, bx1, by1, cx1, cy1);
        const fill1 = shadeFill(base1, ax2, ay2, bx2, by2, cx2, cy2);
        svg += `  <polygon points="${ax1},${ay1} ${bx1},${by1} ${cx1},${cy1}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        svg += `  <polygon points="${ax2},${ay2} ${bx2},${by2} ${cx2},${cy2}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      }
    }
  }

  svg += svgEnd();
  return svg;
}
