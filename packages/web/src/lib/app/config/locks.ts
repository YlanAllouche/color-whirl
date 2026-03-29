import type { WallpaperConfig } from '@wallpaper-maker/core';

export type LockMap = Record<string, boolean>;

function cloneAny<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function isLocked(locks: LockMap, path: string): boolean {
  return !!locks[path];
}

export function toggleLock(locks: LockMap, path: string): LockMap {
  return { ...locks, [path]: !locks[path] };
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

export function mergeWithLocks(current: WallpaperConfig, next: WallpaperConfig, locks: LockMap): WallpaperConfig {
  const merged: WallpaperConfig = {
    ...next,
    colors: [...next.colors],
    palette: {
      overrides: Array.isArray((next as any).palette?.overrides) ? cloneAny((next as any).palette.overrides) : []
    } as any,
    textureParams: {
      drywall: { ...next.textureParams.drywall },
      glass: { ...next.textureParams.glass },
      cel: { ...next.textureParams.cel }
    },
    voronoi: {
      ...((next as any).voronoi ?? {}),
      nucleus: { ...(((next as any).voronoi?.nucleus ?? { enabled: false }) as any) }
    } as any,
    facades: {
      side: { ...next.facades.side },
      grazing: { ...next.facades.grazing },
      outline: { ...next.facades.outline }
    },
    edge: { ...next.edge, seam: { ...next.edge.seam }, band: { ...next.edge.band } },
    bubbles: { ...(next as any).bubbles, interior: { ...((next as any).bubbles?.interior ?? { enabled: true }) } },
    emission: { ...next.emission },
    bloom: { ...next.bloom },
    collisions: { ...next.collisions, carve: { ...next.collisions.carve } },
    lighting: {
      ...next.lighting,
      position: { ...next.lighting.position }
    },
    camera: { ...next.camera },
    environment: { ...next.environment },
    shadows: { ...next.shadows },
    rendering: { ...next.rendering },
    geometry: { ...next.geometry }
  };

  // Resolution is not randomized; always preserve the current values.
  merged.width = current.width;
  merged.height = current.height;

  // Geometry quality is not randomized; always preserve the current value.
  merged.geometry = { ...current.geometry };

  // 3D collisions are not randomized; preserve them when the type stays 3D.
  const currentIs3D =
    current.type === 'popsicle' || current.type === 'spheres3d' || current.type === 'triangles3d' || current.type === 'svg3d';
  const nextIs3D =
    merged.type === 'popsicle' || merged.type === 'spheres3d' || merged.type === 'triangles3d' || merged.type === 'svg3d';
  if (currentIs3D && nextIs3D) {
    merged.collisions = cloneAny(current.collisions);
  }

  // Apply UI locks (by config path). Skip paths that don't exist on either config.
  for (const [path, locked] of Object.entries(locks)) {
    if (!locked) continue;
    const curVal = getAtPath(current as any, path);
    if (typeof curVal === 'undefined') continue;
    const nextVal = getAtPath(merged as any, path);
    if (typeof nextVal === 'undefined') continue;
    setAtPath(merged as any, path, cloneAny(curVal));
  }

  // Randomize-current special case: never randomize the SVG source.
  if ((current.type === 'svg2d' || current.type === 'svg3d') && merged.type === current.type) {
    try {
      (merged as any).svg = { ...(merged as any).svg, source: (current as any).svg?.source };
    } catch {
      // Ignore.
    }
  }

  return merged;
}
