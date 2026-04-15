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

function moveArrayEntry(list: unknown, from: number, to: number): unknown {
  if (!Array.isArray(list)) return list;
  const next = list.slice();
  const moved = next.splice(from, 1)[0];
  next.splice(to, 0, moved);
  return next;
}

function removeArrayEntry(list: unknown, index: number): unknown {
  if (!Array.isArray(list)) return list;
  return list.filter((_, i) => i !== index);
}

function remapMovedIndex(index: number, from: number, to: number): number {
  const current = Math.max(0, Math.trunc(index));
  if (current === from) return to;
  if (from < to && current > from && current <= to) return current - 1;
  if (from > to && current >= to && current < from) return current + 1;
  return current;
}

function remapRemovedIndex(index: number, removed: number, maxAfter: number): number {
  const current = Math.max(0, Math.trunc(index));
  if (current > removed) return Math.max(0, Math.min(maxAfter, current - 1));
  return Math.max(0, Math.min(maxAfter, current));
}

function remapColorIndexedDataForMove(config: WallpaperConfig, from: number, to: number): WallpaperConfig {
  const next: any = { ...config };

  if (next.emission) {
    next.emission = {
      ...next.emission,
      paletteIndex: remapMovedIndex(Number(next.emission.paletteIndex) || 0, from, to)
    };
  }

  if (next.type === 'spheres3d') next.spheres = { ...next.spheres, colorWeights: moveArrayEntry(next.spheres?.colorWeights, from, to) };
  if (next.type === 'circles2d') next.circles = { ...next.circles, colorWeights: moveArrayEntry(next.circles?.colorWeights, from, to) };
  if (next.type === 'polygon2d') next.polygons = { ...next.polygons, colorWeights: moveArrayEntry(next.polygons?.colorWeights, from, to) };
  if (next.type === 'triangles2d') next.triangles = { ...next.triangles, colorWeights: moveArrayEntry(next.triangles?.colorWeights, from, to) };
  if (next.type === 'triangles3d') next.prisms = { ...next.prisms, colorWeights: moveArrayEntry(next.prisms?.colorWeights, from, to) };
  if (next.type === 'hexgrid2d') {
    next.hexgrid = {
      ...next.hexgrid,
      coloring: {
        ...next.hexgrid?.coloring,
        weights: moveArrayEntry(next.hexgrid?.coloring?.weights, from, to)
      }
    };
  }
  if (next.type === 'ridges2d') next.ridges = { ...next.ridges, colorWeights: moveArrayEntry(next.ridges?.colorWeights, from, to) };
  if (next.type === 'svg2d' || next.type === 'svg3d') next.svg = { ...next.svg, colorWeights: moveArrayEntry(next.svg?.colorWeights, from, to) };
  if (next.type === 'bands2d') next.bands = { ...next.bands, colorWeights: moveArrayEntry(next.bands?.colorWeights, from, to) };
  if (next.type === 'flowlines2d') next.flowlines = { ...next.flowlines, colorWeights: moveArrayEntry(next.flowlines?.colorWeights, from, to) };
  if (next.type === 'diamondgrid2d') {
    next.diamondgrid = {
      ...next.diamondgrid,
      coloring: {
        ...next.diamondgrid?.coloring,
        colorWeights: moveArrayEntry(next.diamondgrid?.coloring?.colorWeights, from, to)
      }
    };
  }

  return next;
}

function remapColorIndexedDataForRemove(config: WallpaperConfig, removedIndex: number): WallpaperConfig {
  const next: any = { ...config };
  const maxAfter = Math.max(0, (next.colors?.length ?? 1) - 1);

  if (next.emission) {
    next.emission = {
      ...next.emission,
      paletteIndex: remapRemovedIndex(Number(next.emission.paletteIndex) || 0, removedIndex, maxAfter)
    };
  }

  if (next.type === 'spheres3d') next.spheres = { ...next.spheres, colorWeights: removeArrayEntry(next.spheres?.colorWeights, removedIndex) };
  if (next.type === 'circles2d') next.circles = { ...next.circles, colorWeights: removeArrayEntry(next.circles?.colorWeights, removedIndex) };
  if (next.type === 'polygon2d') next.polygons = { ...next.polygons, colorWeights: removeArrayEntry(next.polygons?.colorWeights, removedIndex) };
  if (next.type === 'triangles2d') next.triangles = { ...next.triangles, colorWeights: removeArrayEntry(next.triangles?.colorWeights, removedIndex) };
  if (next.type === 'triangles3d') next.prisms = { ...next.prisms, colorWeights: removeArrayEntry(next.prisms?.colorWeights, removedIndex) };
  if (next.type === 'hexgrid2d') {
    next.hexgrid = {
      ...next.hexgrid,
      coloring: {
        ...next.hexgrid?.coloring,
        weights: removeArrayEntry(next.hexgrid?.coloring?.weights, removedIndex)
      }
    };
  }
  if (next.type === 'ridges2d') next.ridges = { ...next.ridges, colorWeights: removeArrayEntry(next.ridges?.colorWeights, removedIndex) };
  if (next.type === 'svg2d' || next.type === 'svg3d') next.svg = { ...next.svg, colorWeights: removeArrayEntry(next.svg?.colorWeights, removedIndex) };
  if (next.type === 'bands2d') next.bands = { ...next.bands, colorWeights: removeArrayEntry(next.bands?.colorWeights, removedIndex) };
  if (next.type === 'flowlines2d') next.flowlines = { ...next.flowlines, colorWeights: removeArrayEntry(next.flowlines?.colorWeights, removedIndex) };
  if (next.type === 'diamondgrid2d') {
    next.diamondgrid = {
      ...next.diamondgrid,
      coloring: {
        ...next.diamondgrid?.coloring,
        colorWeights: removeArrayEntry(next.diamondgrid?.coloring?.colorWeights, removedIndex)
      }
    };
  }

  return next;
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
  return remapColorIndexedDataForRemove(
    { ...config, colors: newColors, palette: { ...palette, overrides: nextOverrides } } as any,
    index
  ) as any;
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

  return remapColorIndexedDataForMove({ ...config, colors, palette: { ...palette, overrides } } as any, from, to) as any;
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
