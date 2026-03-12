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

export async function exportToSVG(
  config: WallpaperConfig
): Promise<ExportResult> {
  const { width, height, colors, backgroundColor } = config;
  
  const svgContent = generateSVGContent(config);
  
  return {
    data: svgContent,
    format: 'svg',
    mimeType: 'image/svg+xml'
  };
}

function generateSVGContent(config: WallpaperConfig): string {
  const {
    width,
    height,
    colors,
    backgroundColor,
    stickCount,
    stickOverhang,
    rotationCenterOffsetX,
    rotationCenterOffsetY
  } = config;

  const stickSize = (config as any).stickSize ?? 1.0;
  const stickRatio = (config as any).stickRatio ?? 3.0;

  const sizeNum = Number(stickSize);
  const ratioNum = Number(stickRatio);
  const safeSize = Math.max(0.01, Number.isFinite(sizeNum) ? sizeNum : 1.0);
  const safeRatio = Math.max(0.05, Number.isFinite(ratioNum) ? ratioNum : 3.0);

  // Base footprint matches historical defaults; ratio re-shapes while preserving area.
  const baseStickWidth = width * 0.15 * safeSize;
  const baseStickHeight = height * 0.8 * safeSize;
  const area = baseStickWidth * baseStickHeight;
  const stickWidth = Math.sqrt(area / safeRatio);
  const stickHeight = Math.sqrt(area * safeRatio);
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
`;
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  for (let i = 0; i < stickCount; i++) {
    const color = colors[i % colors.length];
    
    let x = centerX;
    let y = centerY;
    
    // Helix stacking with rotation
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
    const rx = radius;
    const ry = radius;
    
    svg += `  <rect x="${x - stickWidth/2}" y="${y - stickHeight/2}" width="${stickWidth}" height="${stickHeight}" rx="${rx}" ry="${ry}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="0.95"/>
`;
  }
  
  svg += '</svg>';
  
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
