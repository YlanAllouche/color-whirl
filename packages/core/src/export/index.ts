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

function generateSVGContent(config: WallpaperConfig): string {
  switch (config.type) {
    case 'popsicle':
      return generatePopsicleSVG(config);
    case 'circles2d':
      return generateCircles2DSVG(config);
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
  const fillOpacity = Math.max(0, Math.min(1, config.circles.fillOpacity));

  let svg = svgStart(width, height, backgroundColor);

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx = rand01(i, 3) * width;
    const cy = rand01(i, 4) * height;
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

      svg += `  <path d="${d}" fill="${color}" fill-rule="evenodd" opacity="${fillOpacity}"/>\n`;
    } else {
      svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${fillOpacity}"/>\n`;
    }
  }

  svg += svgEnd();
  return svg;
}

function generateTriangles2DSVG(config: Extract<WallpaperConfig, { type: 'triangles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const scale = Math.max(4, Number(config.triangles.scalePx) || 60);
  const inset = Math.max(0, Number(config.triangles.insetPx) || 0);
  const fillOpacity = Math.max(0, Math.min(1, config.triangles.fillOpacity));

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

  const w = normalizeWeights(config.triangles.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.triangles.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), w);
  };

  let svg = svgStart(width, height, backgroundColor);

  const sqrt3 = 1.7320508075688772;
  const s = scale;
  const h = (s * sqrt3) / 2;
  const cols = Math.ceil((width - inset * 2) / s) + 3;
  const rows = Math.ceil((height - inset * 2) / h) + 3;

  let t = 0;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const x0 = inset + rx * s + (ry % 2 === 0 ? 0 : s / 2);
      const y0 = inset + ry * h;
      const idx0 = pickIndex(t++);
      const idx1 = pickIndex(t++);
      const c0 = colors[idx0] ?? '#ffffff';
      const c1 = colors[idx1] ?? '#ffffff';

      const up = `${x0},${y0} ${x0 + s / 2},${y0 + h} ${x0 - s / 2},${y0 + h}`;
      const down = `${x0},${y0 + 2 * h} ${x0 + s / 2},${y0 + h} ${x0 - s / 2},${y0 + h}`;

      svg += `  <polygon points="${up}" fill="${c0}" opacity="${fillOpacity}"/>\n`;
      svg += `  <polygon points="${down}" fill="${c1}" opacity="${fillOpacity}"/>\n`;
    }
  }

  svg += svgEnd();
  return svg;
}

function generateHexGrid2DSVG(config: Extract<WallpaperConfig, { type: 'hexgrid2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const R = Math.max(0.5, Number(config.hexgrid.radiusPx) || 1);
  const overscan = Math.max(0, Number(config.hexgrid.overscanPx) || 0);
  const ox = Number(config.hexgrid.originPx.x) || 0;
  const oy = Number(config.hexgrid.originPx.y) || 0;
  const margin = Math.max(0, Number(config.hexgrid.marginPx) || 0);
  const sw = config.hexgrid.stroke.enabled ? Math.max(0, Number(config.hexgrid.stroke.widthPx) || 0) : 0;
  const drawR = Math.max(0.01, R - margin * 0.5 - sw * 0.5);
  const fillOpacity = Math.max(0, Math.min(1, config.hexgrid.fillOpacity));

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

  const mod = (a: number, n: number) => ((a % n) + n) % n;

  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(((xMin - ox) / dx) - r * 0.5) - 2;
    const qMax = Math.ceil(((xMax - ox) / dx) - r * 0.5) + 2;
    for (let q = qMin; q <= qMax; q++) {
      const cx = ox + R * 1.7320508075688772 * (q + r * 0.5);
      const cy = oy + R * 1.5 * r;
      if (cx < xMin - R || cx > xMax + R || cy < yMin - R || cy > yMax + R) continue;

      const idx = mod(q + r, Math.max(1, colors.length));
      const col = colors[idx] ?? '#ffffff';

      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = ((-90 + i * 60) * Math.PI) / 180;
        pts.push(`${cx + Math.cos(ang) * drawR},${cy + Math.sin(ang) * drawR}`);
      }
      svg += `  <polygon points="${pts.join(' ')}" fill="${col}" opacity="${fillOpacity}"${strokeAttr}/>` + '\n';
    }
  }

  svg += svgEnd();
  return svg;
}

function generateSpheres3DSVG(config: Extract<WallpaperConfig, { type: 'spheres3d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.spheres.count));
  const rMin = Math.max(0.1, config.spheres.radiusMin * 120);
  const rMax = Math.max(rMin, config.spheres.radiusMax * 120);

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.spheres.colorWeights, n);

  let svg = svgStart(width, height, backgroundColor);
  for (let i = 0; i < count; i++) {
    const t = ((config.seed >>> 0) + i * 1013904223) >>> 0;
    const u = ((t ^ (t >>> 16)) >>> 0) / 4294967296;
    const v = (((t * 1664525 + 1013904223) >>> 0) / 4294967296);
    const w0 = (((t * 1103515245 + 12345) >>> 0) / 4294967296);
    const cx = u * width;
    const cy = v * height;
    const r = rMin + w0 * (rMax - rMin);
    const idx = config.spheres.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';
    svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${Math.max(0, Math.min(1, config.spheres.opacity))}"/>\n`;
  }
  svg += svgEnd();
  return svg;
}

function generateTriangles3DSVG(config: Extract<WallpaperConfig, { type: 'triangles3d' }>): string {
  // Approximation: draw 2D triangles.
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.prisms.count));
  const s = Math.max(12, config.prisms.radius * 180);

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.prisms.colorWeights, n);
  let svg = svgStart(width, height, backgroundColor);

  for (let i = 0; i < count; i++) {
    const t = ((config.seed >>> 0) + i * 2654435761) >>> 0;
    const u = ((t ^ (t >>> 16)) >>> 0) / 4294967296;
    const v = (((t * 1664525 + 1013904223) >>> 0) / 4294967296);
    const a = (((t * 1103515245 + 12345) >>> 0) / 4294967296) * Math.PI * 2;
    const cx = u * width;
    const cy = v * height;
    const idx = config.prisms.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const p1 = `${cx + Math.cos(a) * s},${cy + Math.sin(a) * s}`;
    const p2 = `${cx + Math.cos(a + (2 * Math.PI) / 3) * s},${cy + Math.sin(a + (2 * Math.PI) / 3) * s}`;
    const p3 = `${cx + Math.cos(a + (4 * Math.PI) / 3) * s},${cy + Math.sin(a + (4 * Math.PI) / 3) * s}`;
    svg += `  <polygon points="${p1} ${p2} ${p3}" fill="${col}" opacity="${Math.max(0, Math.min(1, config.prisms.opacity))}"/>\n`;
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
