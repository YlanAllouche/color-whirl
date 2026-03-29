import type { ExportOptions } from '../types.js';
import type { ExportResult } from './export-types.js';

export async function exportToPNG(canvas: HTMLCanvasElement, options: ExportOptions): Promise<ExportResult> {
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

export async function exportToJPG(canvas: HTMLCanvasElement, options: ExportOptions): Promise<ExportResult> {
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

export async function exportToWebP(canvas: HTMLCanvasElement, options: ExportOptions): Promise<ExportResult> {
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
