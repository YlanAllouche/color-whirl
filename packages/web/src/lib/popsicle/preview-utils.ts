import * as THREE from 'three';
import { createStickMeshMaterial } from '@wallpaper-maker/core';
import type { ShadowType, WallpaperConfig } from '@wallpaper-maker/core';

export type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clampMult(raw: unknown, min: number = 0.25, max: number = 4): number {
  const v = Number(raw);
  if (!Number.isFinite(v)) return 1;
  return clamp(v, min, max);
}

export function hash01(seed: number, a: number, b: number): number {
  let x = (Number(seed) >>> 0) ^ (Math.imul(a | 0, 374761393) >>> 0) ^ (Math.imul(b | 0, 668265263) >>> 0);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

export function getEnabledPaletteOverride(config: PopsicleConfig, paletteIndex: number): any | null {
  const list: any = (config as any)?.palette?.overrides;
  if (!Array.isArray(list)) return null;
  const v = list[paletteIndex];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const enabled = typeof (v as any).enabled === 'boolean' ? (v as any).enabled : !!(v as any).enabled;
  if (!enabled) return null;
  return v;
}

export function getPopsicleGeometryMultipliers(config: PopsicleConfig, paletteIndex: number): {
  sizeMult: number;
  ratioMult: number;
  thicknessMult: number;
} {
  const ov = getEnabledPaletteOverride(config, paletteIndex);
  const g = ov?.geometry?.popsicle;
  return {
    sizeMult: clampMult(g?.sizeMult),
    ratioMult: clampMult(g?.ratioMult),
    thicknessMult: clampMult(g?.thicknessMult)
  };
}

export function chainOnBeforeCompile(material: THREE.Material, fn: (shader: any) => void, keyPart: string): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    (prev as any)?.(shader, renderer);
    fn(shader);
  };

  const prevKey = (material as any).customProgramCacheKey;
  (material as any).customProgramCacheKey = () => {
    const a = typeof prevKey === 'function' ? String(prevKey.call(material)) : '';
    return a ? `${a}|${keyPart}` : keyPart;
  };
  material.needsUpdate = true;
}

export function makeSolidRedTexture01(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function disposeMaterial(m: THREE.Material | THREE.Material[] | null | undefined): void {
  if (!m) return;
  if (Array.isArray(m)) {
    for (const x of m) x.dispose();
    return;
  }
  m.dispose();
}

export function textureParamsKey(config: PopsicleConfig): string {
  const t = config.texture;
  if (t === 'drywall') {
    const p = config.textureParams.drywall;
    return `dry:${p.grainAmount.toFixed(3)}:${p.grainScale.toFixed(3)}`;
  }
  if (t === 'glass') {
    return `g:${config.textureParams.glass.style}`;
  }
  if (t === 'cel') {
    const p = config.textureParams.cel;
    return `cel:${Math.round(p.bands)}:${p.halftone ? 1 : 0}`;
  }
  return '';
}

export function createMaterialForColor(
  config: PopsicleConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  stickOpacity: number,
  stickDimensions?: { width: number; height: number; depth: number },
  options?: { applyOverrides?: boolean }
): THREE.Material | THREE.Material[] {
  return createStickMeshMaterial(config, paletteIndex, color, envIntensity, stickOpacity, stickDimensions, options);
}

export function applyToneMapping(renderer: THREE.WebGLRenderer, config: PopsicleConfig): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (config.rendering.toneMapping === 'aces') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
  }
  renderer.toneMappingExposure = Number.isFinite(config.rendering.exposure) ? config.rendering.exposure : 1.0;
  (renderer as any).physicallyCorrectLights = true;
}

export function setShadowType(renderer: THREE.WebGLRenderer, type: ShadowType): void {
  renderer.shadowMap.type = type === 'vsm' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
}
