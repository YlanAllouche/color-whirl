import type { ExportOptions, WallpaperConfig } from '../types.js';

export interface ExportResult {
  data: Uint8Array | string;
  format: string;
  mimeType: string;
}

export async function exportToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export PNG');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'png',
    mimeType: 'image/png'
  };
}

export async function exportToJPG(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export JPG');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'jpg',
    mimeType: 'image/jpeg'
  };
}

export async function exportToWebP(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export WebP');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'webp',
    mimeType: 'image/webp'
  };
}

export async function exportToSVG(config: WallpaperConfig): Promise<ExportResult> {
  const svgContent = generateSVGContent(config);
  return { data: svgContent, format: 'svg', mimeType: 'image/svg+xml' };
}

function svgStart(width: number, height: number, backgroundColor: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n  <rect width="100%" height="100%" fill="${backgroundColor}"/>\n`;
}

function svgEnd(): string {
  return '</svg>';
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u01: number, weightsNorm: number[]): number {
  const u = Math.max(0, Math.min(0.999999999, u01));
  let acc = 0;
  for (let i = 0; i < weightsNorm.length; i++) {
    acc += weightsNorm[i];
    if (u < acc) return i;
  }
  return Math.max(0, weightsNorm.length - 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
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

function generateSVGContent(config: WallpaperConfig): string {
  switch (config.type) {
    case 'popsicle':
      return generatePopsicleSVG(config);
    case 'circles2d':
      return generateCircles2DSVG(config);
    case 'polygon2d':
      return generatePolygon2DSVG(config);
    case 'triangles2d':
      return generateTriangles2DSVG(config);
    case 'hexgrid2d':
      return generateHexGrid2DSVG(config);
    case 'spheres3d':
      return generateSpheres3DSVG(config);
    case 'triangles3d':
      return generateTriangles3DSVG(config);
    default:
      throw new Error(`SVG export not supported for type: ${(config as any).type}`);
  }
}

function generatePopsicleSVG(config: Extract<WallpaperConfig, { type: 'popsicle' }>): string {
  const { width, height, colors, backgroundColor, stickCount, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY } = config;
  const opacityValue = Number(config.stickOpacity);
  const stickOpacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1;

  const palette = colors.length > 0 ? colors : ['#ffffff'];

  const safeSize = Math.max(0.01, Number.isFinite(Number(config.stickSize)) ? Number(config.stickSize) : 1.0);
  const safeRatio = Math.max(0.05, Number.isFinite(Number(config.stickRatio)) ? Number(config.stickRatio) : 3.0);

  const baseStickWidth = width * 0.15 * safeSize;
  const baseStickHeight = height * 0.8 * safeSize;
  const area = baseStickWidth * baseStickHeight;
  const stickWidth = Math.sqrt(area / safeRatio);
  const stickHeight = Math.sqrt(area * safeRatio);

  let svg = svgStart(width, height, backgroundColor);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < stickCount; i++) {
    const color = palette[i % palette.length];
    let x = centerX;
    let y = centerY;

    const rotationAngle = (i * stickOverhang * Math.PI) / 180;
    const offsetXPercent = rotationCenterOffsetX / 100;
    const offsetYPercent = rotationCenterOffsetY / 100;
    const pivotX = offsetXPercent * (stickWidth / 2);
    const pivotY = offsetYPercent * (stickHeight / 2);
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    const offsetX = pivotX * (1 - cos) + pivotY * sin;
    const offsetY = pivotY * (1 - cos) - pivotX * sin;

    x += offsetX;
    y += offsetY;
    const rotation = (rotationAngle * 180) / Math.PI;

    const maxRadius = Math.min(stickWidth, stickHeight) / 2;
    const radius = maxRadius * Math.max(0, Math.min(1, config.stickRoundness ?? 0));
    svg += `  <rect x="${x - stickWidth / 2}" y="${y - stickHeight / 2}" width="${stickWidth}" height="${stickHeight}" rx="${radius}" ry="${radius}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>\n`;
  }

  svg += svgEnd();
  return svg;
}

function generateCircles2DSVG(config: Extract<WallpaperConfig, { type: 'circles2d' }>): string {
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
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
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
    // scatter
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

function generatePolygon2DSVG(config: Extract<WallpaperConfig, { type: 'polygon2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(config.polygons.count));
  const edges = Math.max(3, Math.round(Number(config.polygons.edges) || 3));
  const rMin = Math.max(0.1, Number(config.polygons.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.polygons.rMaxPx) || rMin);

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

  const w = normalizeWeights(config.polygons.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.polygons.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), w);
  };

  const fillOpacity = clamp01(Number(config.polygons.fillOpacity) || 0);
  const j = clamp01(Number(config.polygons.jitter) || 0);
  const rotJ = ((Number(config.polygons.rotateJitterDeg) || 0) * Math.PI) / 180;

  const strokeEnabled = !!config.polygons.stroke.enabled;
  const strokeW = Math.max(0, Number(config.polygons.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.polygons.stroke.opacity) || 0);
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
    ? ` stroke="${config.polygons.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
    : '';

  let svg = svgStart(width, height, backgroundColor);

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx0 = rand01(i, 3) * width;
    const cy0 = rand01(i, 4) * height;
    const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
    const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
    const theta = (rand01(i, 8) - 0.5) * rotJ;

    const idx = pickIndex(i);
    const color = colors[idx] ?? '#ffffff';

    const pts: string[] = [];
    for (let k = 0; k < edges; k++) {
      const a = theta + (k / edges) * Math.PI * 2;
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    }

    svg += `  <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>` + '\n';
  }

  svg += svgEnd();
  return svg;
}

function generateTriangles2DSVG(config: Extract<WallpaperConfig, { type: 'triangles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const scale = Math.max(4, Number(config.triangles.scalePx) || 60);
  const inset = Math.max(0, Number(config.triangles.insetPx) || 0);
  const fillOpacity = clamp01(Number(config.triangles.fillOpacity) || 0);

  const strokeEnabled = !!config.triangles.stroke.enabled;
  const strokeW = Math.max(0, Number(config.triangles.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.triangles.stroke.opacity) || 0);
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
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
    // tessellation
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

function generateHexGrid2DSVG(config: Extract<WallpaperConfig, { type: 'hexgrid2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const seed = config.seed >>> 0;
  const n = Math.max(1, colors.length);
  const R = Math.max(0.5, Number(config.hexgrid.radiusPx) || 1);
  const overscan = Math.max(0, Number(config.hexgrid.overscanPx) || 0);
  const ox = Number(config.hexgrid.originPx.x) || 0;
  const oy = Number(config.hexgrid.originPx.y) || 0;
  const margin = Math.max(0, Number(config.hexgrid.marginPx) || 0);
  const sw = config.hexgrid.stroke.enabled ? Math.max(0, Number(config.hexgrid.stroke.widthPx) || 0) : 0;
  const drawR = Math.max(0.01, R - margin * 0.5 - sw * 0.5);
  const fillOpacity = clamp01(Number(config.hexgrid.fillOpacity) || 0);

  const xMin = -overscan;
  const yMin = -overscan;
  const xMax = width + overscan;
  const yMax = height + overscan;
  const dy = 1.5 * R;
  const dx = 1.7320508075688772 * R;

  const rMin = Math.floor((yMin - oy) / dy) - 2;
  const rMax = Math.ceil((yMax - oy) / dy) + 2;

  let svg = svgStart(width, height, backgroundColor);
  const strokeAttr = config.hexgrid.stroke.enabled
    ? ` stroke="${config.hexgrid.stroke.color}" stroke-opacity="${Math.max(0, Math.min(1, config.hexgrid.stroke.opacity))}" stroke-width="${sw}" stroke-linejoin="${config.hexgrid.stroke.join}"`
    : '';

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const buildWeights = (): number[] => {
    const mode = config.hexgrid.coloring.weightsMode;
    const preset = config.hexgrid.coloring.preset;

    if (mode === 'custom') {
      return normalizeWeights(config.hexgrid.coloring.weights, n);
    }

    if (mode === 'preset') {
      if (preset === 'equal') return normalizeWeights(Array(n).fill(1), n);
      if (preset === 'dominant') {
        const domIndex = Math.floor(cellRand01(seed, 17, 23, 9901) * n);
        const dom = 0.6;
        const rest = (1 - dom) / Math.max(1, n - 1);
        const w = Array(n).fill(rest);
        w[domIndex] = dom;
        return normalizeWeights(w, n);
      }
      if (preset === 'accents') {
        const w = Array(n).fill(1);
        if (n >= 2) w[0] = 2.2;
        if (n >= 3) w[n - 1] = 1.8;
        return normalizeWeights(w, n);
      }
      // rare-accents
      const w = Array(n).fill(1);
      if (n >= 2) w[n - 1] = 0.2;
      return normalizeWeights(w, n);
    }

    // auto
    const domIndex = Math.floor(cellRand01(seed, 91, 7, 9902) * n);
    const dom = 0.5;
    const rest = (1 - dom) / Math.max(1, n - 1);
    const w = Array(n).fill(rest);
    w[domIndex] = dom;
    return normalizeWeights(w, n);
  };

  const weightsNorm = buildWeights();

  type Cell = { q: number; r: number; cx: number; cy: number; groupId: number; colorIndex: number };
  const cells: Cell[] = [];

  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(((xMin - ox) / dx) - r * 0.5) - 2;
    const qMax = Math.ceil(((xMax - ox) / dx) - r * 0.5) + 2;
    for (let q = qMin; q <= qMax; q++) {
      const cx = ox + R * 1.7320508075688772 * (q + r * 0.5);
      const cy = oy + R * 1.5 * r;
      if (cx < xMin - R || cx > xMax + R || cy < yMin - R || cy > yMax + R) continue;
      cells.push({ q, r, cx, cy, groupId: 0, colorIndex: 0 });
    }
  }

  // Grouping (bounded): none / noise
  const groupingMode = config.hexgrid.grouping.mode;
  const strength = clamp01(Number(config.hexgrid.grouping.strength) || 0);
  const k = Math.max(1, Math.round(Number(config.hexgrid.grouping.targetGroupCount) || 1));
  if (groupingMode === 'noise') {
    const scale = clamp(lerp(0.0015, 0.02, 1 - strength), 0.0001, 1);
    for (const c of cells) {
      const xi = Math.floor(c.cx * scale);
      const yi = Math.floor(c.cy * scale);
      const t = cellRand01(seed, xi, yi, 2001);
      c.groupId = Math.min(k - 1, Math.floor(t * k));
    }
  }

  // Colors (by group)
  const groupToColor = new Map<number, number>();
  for (const c of cells) {
    if (groupToColor.has(c.groupId)) continue;
    if (config.hexgrid.coloring.paletteMode === 'cycle') {
      groupToColor.set(c.groupId, ((c.groupId % n) + n) % n);
    } else {
      const u = cellRand01(seed, c.groupId, 0, 5001);
      groupToColor.set(c.groupId, sampleWeightedIndex01(u, weightsNorm));
    }
  }
  for (const c of cells) {
    c.colorIndex = groupToColor.get(c.groupId) ?? 0;
    c.colorIndex = Math.max(0, Math.min(n - 1, c.colorIndex));
  }

  const effectKind = config.hexgrid.effect.kind;
  const effectAmt = clamp01(Number(config.hexgrid.effect.amount) || 0);
  const gradAngle = cellRand01(seed, 11, 17, 6001) * Math.PI * 2;
  const gx = Math.cos(gradAngle);
  const gy = Math.sin(gradAngle);

  for (const cell of cells) {
    let col = colors[cell.colorIndex] ?? '#ffffff';
    if (effectKind === 'grain' && effectAmt > 0) {
      const g = (cellRand01(seed, cell.q, cell.r, 7001) - 0.5) * 2;
      col = adjustHex(col, g * effectAmt * 0.06);
    }
    if (effectKind === 'gradient' && effectAmt > 0) {
      const nx = (cell.cx - width * 0.5) / Math.max(1, width);
      const ny = (cell.cy - height * 0.5) / Math.max(1, height);
      const d = clamp(nx * gx + ny * gy, -1, 1);
      col = adjustHex(col, d * 0.18 * effectAmt);
    }

    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = ((-90 + i * 60) * Math.PI) / 180;
      pts.push(`${cell.cx + Math.cos(ang) * drawR},${cell.cy + Math.sin(ang) * drawR}`);
    }

    svg += `  <polygon points="${pts.join(' ')}" fill="${col}" fill-opacity="${fillOpacity}"${strokeAttr}/>` + '\n';
  }

  svg += svgEnd();
  return svg;
}

function generateSpheres3DSVG(config: Extract<WallpaperConfig, { type: 'spheres3d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.spheres.count));
  const rMin = Math.max(0.1, config.spheres.radiusMin * 120);
  const rMax = Math.max(rMin, config.spheres.radiusMax * 120);

  const spread = Math.max(0, Number(config.spheres.spread) || 0);
  const depth = Math.max(0, Number(config.spheres.depth) || 0);
  const layers = Math.max(1, Math.round(Number(config.spheres.layers) || 1));
  const distribution = config.spheres.distribution;

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.spheres.colorWeights, n);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const posForIndex = (i: number): { x: number; y: number; z: number } => {
    if (distribution === 'layeredDepth') {
      const layer = i % layers;
      const zBase = layers === 1 ? 0 : (-(depth * 0.5) + (depth * layer) / (layers - 1));
      const z = zBase + (rand01(i, 21) - 0.5) * (depth / layers) * 0.75;
      const x = (rand01(i, 22) - 0.5) * 2 * spread;
      const y = (rand01(i, 23) - 0.5) * 2 * spread;
      return { x, y, z };
    }

    if (distribution === 'jitteredGrid') {
      const gx = Math.max(1, Math.round(Math.sqrt(count * (width / Math.max(1, height)))));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = spread === 0 ? 0 : (spread * 2) / gx;
      const cellH = spread === 0 ? 0 : (spread * 2) / gy;
      const x = -spread + (cx + 0.5) * cellW + (rand01(i, 24) - 0.5) * cellW * 0.85;
      const y = -spread + (cy + 0.5) * cellH + (rand01(i, 25) - 0.5) * cellH * 0.85;
      const z = (rand01(i, 26) - 0.5) * depth;
      return { x, y, z };
    }

    // scatter
    const x = (rand01(i, 22) - 0.5) * 2 * spread;
    const y = (rand01(i, 23) - 0.5) * 2 * spread;
    const z = (rand01(i, 26) - 0.5) * depth;
    return { x, y, z };
  };

  const instances: Array<{ cx: number; cy: number; r: number; col: string; z: number }> = [];
  for (let i = 0; i < count; i++) {
    const p = posForIndex(i);
    const u = rand01(i, 1);
    const rr = rMin + rand01(i, 2) * (rMax - rMin);
    const idx = config.spheres.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const denom = Math.max(0.0001, spread * 2);
    const cx = ((p.x / denom) + 0.5) * width;
    const cy = ((p.y / denom) + 0.5) * height;
    instances.push({ cx, cy, r: rr, col, z: p.z });
  }

  if (distribution === 'layeredDepth') {
    instances.sort((a, b) => a.z - b.z);
  }

  let svg = svgStart(width, height, backgroundColor);
  const opacity = clamp01(Number(config.spheres.opacity) || 0);
  for (const it of instances) {
    svg += `  <circle cx="${it.cx}" cy="${it.cy}" r="${it.r}" fill="${it.col}" opacity="${opacity}"/>\n`;
  }
  svg += svgEnd();
  return svg;
}

function generateTriangles3DSVG(config: Extract<WallpaperConfig, { type: 'triangles3d' }>): string {
  // Approximation: draw 2D triangles.
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.prisms.count));
  const s = Math.max(12, config.prisms.radius * 180);

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
    const cx = ((p.x / denom) + 0.5) * width;
    const cy = ((p.y / denom) + 0.5) * height;

    const idx = config.prisms.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const p1 = `${cx + Math.cos(a) * s},${cy + Math.sin(a) * s}`;
    const p2 = `${cx + Math.cos(a + (2 * Math.PI) / 3) * s},${cy + Math.sin(a + (2 * Math.PI) / 3) * s}`;
    const p3 = `${cx + Math.cos(a + (4 * Math.PI) / 3) * s},${cy + Math.sin(a + (4 * Math.PI) / 3) * s}`;
    svg += `  <polygon points="${p1} ${p2} ${p3}" fill="${col}" opacity="${opacity}"/>\n`;
  }
  svg += svgEnd();
  return svg;
}

export async function exportWallpaper(
  canvas: HTMLCanvasElement,
  config: WallpaperConfig,
  options: ExportOptions
): Promise<ExportResult> {
  switch (options.format) {
    case 'png':
      return exportToPNG(canvas, options);
    case 'jpg':
      return exportToJPG(canvas, options);
    case 'webp':
      return exportToWebP(canvas, options);
    case 'svg':
      return exportToSVG(config);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

export function downloadFile(data: Uint8Array | string, filename: string, mimeType: string): void {
  const blob = data instanceof Uint8Array 
    ? new Blob([data as BlobPart], { type: mimeType })
    : new Blob([data], { type: mimeType });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
