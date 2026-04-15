import type { WallpaperConfig, WallpaperType } from './types/index.js';

const COMMON_KEYS = [
  'type',
  'seed',
  'width',
  'height',
  'colors',
  'backgroundColor',
  'palette',
  'texture',
  'textureParams'
] as const;

const EFFECT_KEYS = ['emission', 'bloom'] as const;

const THREE_D_SHARED_KEYS = [
  'camera',
  'lighting',
  'environment',
  'shadows',
  'rendering',
  'geometry',
  'facades',
  'edge',
  'bubbles',
  'voronoi',
  'collisions'
] as const;

const POPSICLE_ONLY_KEYS = [
  'stickCount',
  'stickOverhang',
  'rotationCenterOffsetX',
  'rotationCenterOffsetY',
  'stickGap',
  'stickSize',
  'stickRatio',
  'stickThickness',
  'stickEndProfile',
  'stickRoundness',
  'stickChipAmount',
  'stickChipJaggedness',
  'stickBevel',
  'stickOpacity'
] as const;

const KEYS_BY_TYPE: Record<WallpaperType, ReadonlyArray<string>> = {
  popsicle: [...COMMON_KEYS, ...EFFECT_KEYS, ...THREE_D_SHARED_KEYS, ...POPSICLE_ONLY_KEYS],
  spheres3d: [...COMMON_KEYS, ...EFFECT_KEYS, ...THREE_D_SHARED_KEYS, 'spheres'],
  triangles3d: [...COMMON_KEYS, ...EFFECT_KEYS, ...THREE_D_SHARED_KEYS, 'prisms'],
  svg3d: [...COMMON_KEYS, ...EFFECT_KEYS, ...THREE_D_SHARED_KEYS, 'svg'],
  circles2d: [...COMMON_KEYS, ...EFFECT_KEYS, 'circles'],
  polygon2d: [...COMMON_KEYS, ...EFFECT_KEYS, 'polygons'],
  triangles2d: [...COMMON_KEYS, ...EFFECT_KEYS, 'triangles'],
  svg2d: [...COMMON_KEYS, ...EFFECT_KEYS, 'svg'],
  hexgrid2d: [...COMMON_KEYS, 'hexgrid'],
  ridges2d: [...COMMON_KEYS, 'ridges'],
  bands2d: [...COMMON_KEYS, 'bands'],
  flowlines2d: [...COMMON_KEYS, 'flowlines'],
  diamondgrid2d: [...COMMON_KEYS, 'diamondgrid']
};

function resolveType(type: unknown): WallpaperType {
  if (typeof type !== 'string') return 'popsicle';
  return Object.prototype.hasOwnProperty.call(KEYS_BY_TYPE, type) ? (type as WallpaperType) : 'popsicle';
}

export function pruneWallpaperConfigForType(config: WallpaperConfig): WallpaperConfig {
  const input = config && typeof config === 'object' ? (config as unknown as Record<string, unknown>) : {};
  const type = resolveType(input.type);
  const keepKeys = KEYS_BY_TYPE[type];

  const pruned: Record<string, unknown> = { type };
  for (const key of keepKeys) {
    if (key === 'type') continue;
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    pruned[key] = input[key];
  }

  return pruned as unknown as WallpaperConfig;
}
