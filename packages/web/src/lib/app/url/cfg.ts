import {
  decodeAppStateFromBase64Url,
  encodeAppStateToBase64Url,
  type WallpaperAppStateV1,
  type WallpaperConfig
} from '@wallpaper-maker/core';
import type { PreviewRenderMode } from '$lib/popsicle/preview';

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

export function buildAppState(input: {
  config: WallpaperConfig;
  exportFormat: ExportFormat;
  renderMode: PreviewRenderMode;
}): WallpaperAppStateV1 {
  return {
    v: 1,
    c: input.config,
    f: input.exportFormat,
    m: input.renderMode
  };
}

export function encodeCfgParam(state: WallpaperAppStateV1): string {
  return encodeAppStateToBase64Url(state);
}

export function decodeCfgParam(cfg: string): WallpaperAppStateV1 {
  return decodeAppStateFromBase64Url(cfg);
}

export function getCfgParamFromSearch(search: string): string | null {
  const sp = new URLSearchParams(search);
  const cfg = sp.get('cfg');
  return cfg && cfg.length > 0 ? cfg : null;
}

export function shouldSkipUrlUpdate(url: URL, cfg: string): boolean {
  return url.searchParams.get('cfg') === cfg && url.searchParams.size === 1;
}

export function scheduleReplaceCfgInUrl(cfg: string, opts?: { debounceMs?: number }): () => void {
  if (typeof window === 'undefined') return () => {};

  const debounceMs = Math.max(0, Math.round(opts?.debounceMs ?? 120));
  const handle = window.setTimeout(() => {
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set('cfg', cfg);
    history.replaceState({}, '', u);
  }, debounceMs);

  return () => {
    window.clearTimeout(handle);
  };
}
