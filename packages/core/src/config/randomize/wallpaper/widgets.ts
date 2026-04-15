import type { WallpaperConfig, WallpaperType } from '../../types/index.js';
import { DEFAULT_CONFIG_BY_TYPE } from '../../defaults.js';

export type RandomizeWidgetId = string;

type WidgetRandomizeConfig = {
  paths: string[];
  types?: WallpaperType[];
  enabled?: boolean;
};

const WIDGET_RANDOMIZE_MAP: Record<string, WidgetRandomizeConfig> = {
  colors: {
    paths: ['colors', 'backgroundColor']
  },
  appearance: {
    paths: ['texture', 'textureParams'],
    types: ['popsicle', 'spheres3d', 'triangles3d', 'svg3d']
  },
  voronoi: {
    paths: ['voronoi'],
    types: ['popsicle', 'spheres3d', 'triangles3d', 'svg3d']
  },
  emission: {
    paths: ['emission', 'bloom']
  },
  camera: {
    paths: ['camera'],
    types: ['popsicle', 'spheres3d', 'triangles3d', 'svg3d']
  },
  lighting: {
    paths: ['lighting', 'environment', 'shadows'],
    types: ['popsicle', 'spheres3d', 'triangles3d', 'svg3d']
  },
  collisions: {
    paths: ['collisions']
  },
  facades: {
    paths: ['facades'],
    types: ['popsicle']
  },
  edge: {
    paths: ['edge'],
    types: ['popsicle']
  },
  outline: {
    paths: ['facades.outline'],
    types: ['spheres3d', 'triangles3d', 'svg3d']
  },
  bubbles: {
    paths: ['bubbles'],
    types: ['popsicle', 'spheres3d']
  },
  popsicle: {
    paths: [
      'stickCount',
      'stickGap',
      'stickSize',
      'stickRatio',
      'stickThickness',
      'stickEndProfile',
      'stickRoundness',
      'stickChipAmount',
      'stickChipJaggedness',
      'stickBevel',
      'stickOpacity',
      'stickOverhang',
      'rotationCenterOffsetX',
      'rotationCenterOffsetY',
      'edge.hollow'
    ],
    types: ['popsicle']
  },
  spheres3d: {
    paths: ['spheres'],
    types: ['spheres3d']
  },
  bands2d: {
    paths: ['bands'],
    types: ['bands2d']
  },
  flowlines2d: {
    paths: ['flowlines'],
    types: ['flowlines2d']
  },
  diamondgrid2d: {
    paths: ['diamondgrid'],
    types: ['diamondgrid2d']
  },
  circles2d: {
    paths: ['circles'],
    types: ['circles2d']
  },
  polygon2d: {
    paths: ['polygons'],
    types: ['polygon2d']
  },
  svg2d: {
    paths: ['svg'],
    types: ['svg2d']
  },
  svg3d: {
    paths: ['svg', 'texture', 'textureParams', 'facades.outline'],
    types: ['svg3d']
  },
  triangles2d: {
    paths: ['triangles'],
    types: ['triangles2d']
  },
  ridges2d: {
    paths: ['ridges'],
    types: ['ridges2d']
  },
  triangles3d: {
    paths: ['prisms'],
    types: ['triangles3d']
  },
  hexgrid2d: {
    paths: ['hexgrid'],
    types: ['hexgrid2d']
  },
  'svg-icons': {
    paths: ['svg.source'],
    types: ['svg2d', 'svg3d'],
    enabled: false
  }
};

function getFallbackWidgetPaths(widgetId: string, type: WallpaperType): string[] {
  // Keep fallback conservative: only plain dot-free keys that exist on the type config.
  if (!/^[A-Za-z0-9_]+$/.test(widgetId)) return [];
  const base = (DEFAULT_CONFIG_BY_TYPE as any)?.[type];
  if (!base || typeof base !== 'object') return [];
  if (!Object.prototype.hasOwnProperty.call(base, widgetId)) return [];
  return [widgetId];
}

function cloneAny<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function getAtPath(obj: any, path: string): any {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setAtPath(obj: any, path: string, value: any): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

export function getRandomizeWidgetPaths(widgetId: string, type: WallpaperType): string[] {
  const rule = (WIDGET_RANDOMIZE_MAP as Record<string, WidgetRandomizeConfig | undefined>)[widgetId];
  if (rule) {
    if (rule.enabled === false) return [];
    if (Array.isArray(rule.types) && !rule.types.includes(type)) return [];
    if (rule.paths.length > 0) return [...rule.paths];
  }
  return getFallbackWidgetPaths(widgetId, type);
}

export function isRandomizeWidgetSupported(widgetId: string, type: WallpaperType): boolean {
  return getRandomizeWidgetPaths(widgetId, type).length > 0;
}

export function applyRandomizedWidgetPaths(input: {
  currentConfig: WallpaperConfig;
  randomizedConfig: WallpaperConfig;
  widgetId: string;
}): WallpaperConfig {
  const { currentConfig, randomizedConfig, widgetId } = input;
  const paths = getRandomizeWidgetPaths(widgetId, currentConfig.type);
  if (paths.length === 0) return currentConfig;

  const next = cloneAny(currentConfig) as WallpaperConfig;

  for (const path of paths) {
    const curVal = getAtPath(currentConfig as any, path);
    if (typeof curVal === 'undefined') continue;
    const randomVal = getAtPath(randomizedConfig as any, path);
    if (typeof randomVal === 'undefined') continue;
    setAtPath(next as any, path, cloneAny(randomVal));
  }

  return next;
}

export function getRandomizeWidgetIdsForType(type: WallpaperType): string[] {
  const ids = Object.keys(WIDGET_RANDOMIZE_MAP);
  return ids.filter((widgetId) => isRandomizeWidgetSupported(widgetId, type));
}
