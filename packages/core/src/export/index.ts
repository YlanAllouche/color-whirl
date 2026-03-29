import type { ExportOptions, WallpaperConfig } from '../types.js';
import type { ExportResult } from './export-types.js';

export type { ExportResult } from './export-types.js';

export { exportToPNG, exportToJPG, exportToWebP } from './raster.js';
export { exportToSVG } from './svg.js';

import { exportToJPG, exportToPNG, exportToWebP } from './raster.js';
import { exportToSVG } from './svg.js';

export async function exportWallpaper(canvas: HTMLCanvasElement, config: WallpaperConfig, options: ExportOptions): Promise<ExportResult> {
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
  const blob =
    data instanceof Uint8Array
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
