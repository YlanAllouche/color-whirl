import type { WallpaperConfig } from '@wallpaper-maker/core';

type PaletteBlock = 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi';

function getPalette(config: WallpaperConfig): any {
  const pAny: any = (config as any).palette;
  return pAny && typeof pAny === 'object' ? pAny : { overrides: [] };
}

function ensureOverridesLen(palette: any, len: number): any[] {
  const overrides: any[] = Array.isArray(palette.overrides) ? palette.overrides.slice() : [];
  while (overrides.length < len) overrides.push(null);
  return overrides;
}

export function addColor(config: WallpaperConfig): WallpaperConfig {
  const nextColors = [...config.colors, '#ffffff'];
  const palette = getPalette(config);
  const overrides = ensureOverridesLen(palette, nextColors.length).slice(0, nextColors.length);
  return { ...config, colors: nextColors, palette: { ...palette, overrides } } as any;
}

export function removeColor(config: WallpaperConfig, index: number): WallpaperConfig {
  if (config.colors.length <= 1) return config;

  const newColors = config.colors.filter((_, i) => i !== index);
  const palette = getPalette(config);
  const curOverrides: any[] = Array.isArray(palette.overrides) ? palette.overrides.slice() : [];
  const nextOverrides = curOverrides.filter((_, i) => i !== index).slice(0, newColors.length);
  while (nextOverrides.length < newColors.length) nextOverrides.push(null);
  return { ...config, colors: newColors, palette: { ...palette, overrides: nextOverrides } } as any;
}

export function updateColor(config: WallpaperConfig, index: number, color: string): WallpaperConfig {
  const newColors = [...config.colors];
  newColors[index] = color;
  return { ...config, colors: newColors };
}

export function moveColor(config: WallpaperConfig, fromIndex: number, toIndex: number): WallpaperConfig {
  const len = config.colors.length;
  if (len <= 1) return config;

  const from = Math.max(0, Math.min(len - 1, Math.trunc(fromIndex)));
  const to = Math.max(0, Math.min(len - 1, Math.trunc(toIndex)));
  if (from === to) return config;

  const colors = config.colors.slice();
  const movedColor = colors.splice(from, 1)[0];
  colors.splice(to, 0, movedColor);

  const palette = getPalette(config);
  const overrides = ensureOverridesLen(palette, len);
  const movedOverride = overrides.splice(from, 1)[0] ?? null;
  overrides.splice(to, 0, movedOverride);

  return { ...config, colors, palette: { ...palette, overrides } } as any;
}

export function replaceColors(config: WallpaperConfig, colors: string[]): WallpaperConfig {
  const nextColors = colors.length > 0 ? colors.slice() : ['#ffffff'];
  const palette = getPalette(config);
  const curOverrides: any[] = Array.isArray(palette.overrides) ? palette.overrides.slice() : [];
  const nextOverrides = curOverrides.slice(0, nextColors.length);
  while (nextOverrides.length < nextColors.length) nextOverrides.push(null);
  return { ...config, colors: nextColors, palette: { ...palette, overrides: nextOverrides } } as any;
}

export function updatePaletteOverride(
  config: WallpaperConfig,
  paletteIndex: number,
  fn: (cur: any | null) => any | null
): WallpaperConfig {
  const colorsLen = Math.max(0, config.colors.length);
  const palette = getPalette(config);
  const overrides = ensureOverridesLen(palette, colorsLen);

  const cur = overrides[paletteIndex];
  const curObj = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : null;
  overrides[paletteIndex] = fn(curObj);

  return { ...config, palette: { ...palette, overrides } } as any;
}

export function togglePaletteOverride(config: WallpaperConfig, paletteIndex: number): WallpaperConfig {
  return updatePaletteOverride(config, paletteIndex, (cur) => {
    if (!cur) return { enabled: true };
    return { ...cur, enabled: !cur.enabled };
  });
}

export function togglePaletteBlock(config: WallpaperConfig, paletteIndex: number, block: PaletteBlock): WallpaperConfig {
  return updatePaletteOverride(config, paletteIndex, (cur) => {
    const base = cur ?? { enabled: true };
    const enabled = typeof (base as any).enabled === 'boolean' ? (base as any).enabled : true;
    const next: any = { ...base, enabled };

    if (block === 'emission') {
      if (next.emission) delete next.emission;
      else next.emission = { enabled: true, intensity: Number((config as any).emission?.intensity) || 0 };
    }

    if (block === 'texture') {
      if (next.texture) delete next.texture;
      else next.texture = { type: (config as any).texture, params: {} };
    }

    if (block === 'grazing') {
      if (next.facades?.grazing) {
        next.facades = { ...(next.facades ?? {}) };
        delete next.facades.grazing;
      } else {
        next.facades = { ...(next.facades ?? {}), grazing: { ...(config as any).facades?.grazing } };
      }
    }

    if (block === 'side') {
      if (next.facades?.side) {
        next.facades = { ...(next.facades ?? {}) };
        delete next.facades.side;
      } else {
        next.facades = { ...(next.facades ?? {}), side: { ...(config as any).facades?.side } };
      }
    }

    if (block === 'outline') {
      if (next.facades?.outline) {
        next.facades = { ...(next.facades ?? {}) };
        delete next.facades.outline;
      } else {
        next.facades = { ...(next.facades ?? {}), outline: { ...(config as any).facades?.outline } };
      }
    }

    if (block === 'edge') {
      if (next.edge) delete next.edge;
      else next.edge = { ...(config as any).edge, seam: { ...(config as any).edge?.seam }, band: { ...(config as any).edge?.band } };
    }

    if (block === 'geometry') {
      if (next.geometry) {
        delete next.geometry;
      } else {
        const t = (config as any).type;
        if (t === 'popsicle') next.geometry = { popsicle: { sizeMult: 1, ratioMult: 1, thicknessMult: 1 } };
        else if (t === 'spheres3d') next.geometry = { spheres3d: { radiusMult: 1 } };
        else if (t === 'triangles3d') next.geometry = { triangles3d: { radiusMult: 1, heightMult: 1 } };
        else if (t === 'svg3d') next.geometry = { svg: { sizeMult: 1, extrudeMult: 1 } };
        else if (t === 'svg2d') next.geometry = { svg: { sizeMult: 1 } };
        else next.geometry = {};
      }
    }

    if (block === 'bubbles') {
      if (next.bubbles) {
        delete next.bubbles;
      } else {
        next.bubbles = { ...(config as any).bubbles };
      }
    }

    if (block === 'voronoi') {
      if (next.voronoi) {
        delete next.voronoi;
      } else {
        next.voronoi = { ...(config as any).voronoi, nucleus: { ...((config as any).voronoi?.nucleus ?? { enabled: false }) } };
      }
    }

    return next;
  });
}
