import type { WallpaperConfig } from './types.js';

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
export type PreviewMode = 'raster' | 'path';

export type WallpaperAppStateV1 = {
  v: 1;
  c: WallpaperConfig;
  f: ExportFormat;
  m: PreviewMode;
};

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const s = atob(base64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function base64ToBase64Url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBase64(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return padded + '='.repeat(padLen);
}

export function encodeAppStateToBase64Url(state: WallpaperAppStateV1): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  return base64ToBase64Url(toBase64(bytes));
}

export function decodeAppStateFromBase64Url(encoded: string): WallpaperAppStateV1 {
  const bytes = fromBase64(base64UrlToBase64(encoded.trim()));
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as WallpaperAppStateV1;
  if (!parsed || parsed.v !== 1 || !parsed.c) {
    throw new Error('Invalid cfg payload');
  }
  return parsed;
}
