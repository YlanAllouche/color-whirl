import type {
  WallpaperConfig,
  PaletteOverride,
  TextureParams,
  TextureType,
  FacadesConfig,
  EdgeConfig
} from './types.js';

export type ResolvedPaletteConfig = {
  paletteIndex: number;
  texture: TextureType;
  textureParams: TextureParams;
  facades: FacadesConfig;
  edge: EdgeConfig;
  emission: {
    enabled: boolean;
    intensity: number;
  };
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: any): T {
  if (Array.isArray(base)) {
    return (Array.isArray(patch) ? patch.slice() : base.slice()) as any;
  }

  if (isPlainObject(base)) {
    const out: Record<string, any> = {};
    const patchObj = isPlainObject(patch) ? patch : {};
    const keys = new Set([...Object.keys(base as any), ...Object.keys(patchObj)]);
    for (const key of keys) {
      out[key] = deepMerge((base as any)[key], (patchObj as any)[key]);
    }
    return out as any;
  }

  return patch == null ? (base as any) : (patch as any);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function getPaletteOverride(config: WallpaperConfig, paletteIndex: number): PaletteOverride | null {
  const list: any = (config as any)?.palette?.overrides;
  if (!Array.isArray(list)) return null;
  const v = list[paletteIndex];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const enabled = typeof (v as any).enabled === 'boolean' ? (v as any).enabled : !!(v as any).enabled;
  if (!enabled) return null;
  return v as PaletteOverride;
}

export function resolvePaletteConfig(config: WallpaperConfig, paletteIndex: number): ResolvedPaletteConfig {
  const ov = getPaletteOverride(config, paletteIndex);

  const texture: TextureType = (ov as any)?.texture?.type ?? config.texture;
  const textureParams: TextureParams = ov?.texture?.params ? deepMerge(config.textureParams, ov.texture.params) : config.textureParams;
  const facades: FacadesConfig = ov?.facades ? deepMerge(config.facades, ov.facades) : config.facades;
  const edge: EdgeConfig = ov?.edge ? deepMerge(config.edge, ov.edge) : config.edge;

  const baseEnabled =
    !!config.emission?.enabled &&
    Math.round(Number(config.emission?.paletteIndex) || 0) === Math.round(Number(paletteIndex) || 0) &&
    Number.isFinite(Number(config.emission?.intensity)) &&
    Number(config.emission?.intensity) > 0;

  let enabled = baseEnabled;
  let intensity = clamp(Number(config.emission?.intensity) || 0, 0, 20);

  if (ov?.emission) {
    if (typeof ov.emission.enabled === 'boolean') enabled = ov.emission.enabled;
    if (Number.isFinite(Number(ov.emission.intensity))) intensity = clamp(Number(ov.emission.intensity) || 0, 0, 20);
  }

  enabled = !!enabled && intensity > 0;

  return {
    paletteIndex,
    texture,
    textureParams,
    facades,
    edge,
    emission: { enabled, intensity }
  };
}
