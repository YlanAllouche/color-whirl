import * as THREE from 'three';
import type { FacadeSideConfig, TextureParams, TextureType, GlassStyle, WallpaperConfig } from '../types.js';
import { resolvePaletteConfig } from '../palette.js';
import { applyBubbles } from './bubbles.js';
import { createDrywallMaps } from './drywall.js';
import { applyEdgeEffects } from './edge.js';
import { applyGrazing } from './grazing.js';
import { applyHalftone, getToonGradientMap } from './halftone.js';
import { clamp } from './utils.js';
import { applyVoronoi } from './voronoi.js';

export { applyBubbles } from './bubbles.js';

export type StickMeshMaterial = THREE.Material | THREE.Material[];

function canHaveColor(m: THREE.Material): m is THREE.Material & { color: THREE.Color } {
  return (m as any).color instanceof THREE.Color;
}

function applySideTint(m: THREE.Material, tintColor: string, amount: number): void {
  if (!canHaveColor(m)) return;
  const a = clamp(amount, 0, 1);
  const base = (m as any).color as THREE.Color;
  const next = base.clone().lerp(new THREE.Color(tintColor), a);
  base.copy(next);
}

function applySideMaterialOverrides(m: THREE.Material, cfg: FacadeSideConfig, envIntensity: number): void {
  if (!cfg.enabled) return;
  const anyMat: any = m as any;
  const t = clamp(cfg.materialAmount, 0, 1);
  if (!(t > 0)) return;

  const lerp = (a: number, b: number, tt: number) => a + (b - a) * tt;
  if (typeof anyMat.roughness === 'number') {
    const target = clamp(cfg.roughness, 0, 1);
    anyMat.roughness = lerp(anyMat.roughness, target, t);
  }
  if (typeof anyMat.metalness === 'number') {
    const target = clamp(cfg.metalness, 0, 1);
    anyMat.metalness = lerp(anyMat.metalness, target, t);
  }
  if (typeof anyMat.clearcoat === 'number') {
    const target = clamp(cfg.clearcoat, 0, 1);
    anyMat.clearcoat = lerp(anyMat.clearcoat, target, t);
  }
  if (typeof anyMat.envMapIntensity === 'number') {
    const mult = clamp(cfg.envIntensityMult, 0, 3);
    const target = envIntensity * mult;
    anyMat.envMapIntensity = lerp(anyMat.envMapIntensity, target, t);
  }
}

export function createStickMeshMaterial(
  config: WallpaperConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  stickOpacity: number,
  stickDimensions?: { width: number; height: number; depth: number },
  options?: { applyOverrides?: boolean }
): StickMeshMaterial {
  const resolved = resolvePaletteConfig(config, paletteIndex, { applyOverrides: options?.applyOverrides });
  const emissive = resolved.emission.enabled
    ? { enabled: true, intensity: resolved.emission.intensity, color }
    : { enabled: false, intensity: 0, color };

  const face = createStickMaterial({
    texture: resolved.texture,
    color,
    envIntensity,
    stickOpacity,
    seed: config.seed,
    textureParams: resolved.textureParams,
    emissive
  });

  const grazing = resolved.facades?.grazing;
  if (grazing?.enabled && grazing.mode !== 'mix') {
    applyGrazing(face, grazing);
  }

  const sideCfg = resolved.facades?.side;
  const needsSideOverrides =
    !!sideCfg?.enabled && (clamp(Number(sideCfg.tintAmount) || 0, 0, 1) > 0 || clamp(Number(sideCfg.materialAmount) || 0, 0, 1) > 0);

  const wantsHollow = !!resolved.edge?.hollow;
  const edgeEnabled = !!resolved.edge?.seam?.enabled || !!resolved.edge?.band?.enabled;
  const needsSplitMaterial = wantsHollow || needsSideOverrides || (grazing?.enabled && grazing.mode === 'mix') || edgeEnabled;

  if (!needsSplitMaterial) {
    applyVoronoi(face, resolved.voronoi);
    applyBubbles(face, config, undefined, resolved.bubbles);
    applyEdgeEffects(face, 'cap', config, resolved.edge, stickDimensions);
    return face;
  }

  const side = face.clone();
  if (grazing?.enabled && grazing.mode === 'mix') {
    applyGrazing(side, grazing);
  }

  if (sideCfg?.enabled) {
    applySideTint(side, sideCfg.tintColor, sideCfg.tintAmount);
    applySideMaterialOverrides(side, sideCfg, envIntensity);
  }

  if (wantsHollow) {
    const anySide: any = side as any;
    if (typeof anySide.side === 'number') {
      anySide.side = THREE.DoubleSide;
      side.needsUpdate = true;
    }
  }

  const cap = wantsHollow
    ? (() => {
        const m = face.clone();
        const anyMat: any = m as any;
        anyMat.transparent = true;
        anyMat.opacity = 0;
        anyMat.depthWrite = false;
        if (typeof anyMat.colorWrite === 'boolean') anyMat.colorWrite = false;
        return m;
      })()
    : face;

  // Apply edge effects late so they exist on both cap and side materials.
  // (Material.clone() does not reliably preserve onBeforeCompile/customProgramCacheKey across runtimes.)
  applyVoronoi(cap, resolved.voronoi);
  applyVoronoi(side, resolved.voronoi);
  applyBubbles(cap, config, undefined, resolved.bubbles);
  applyBubbles(side, config, undefined, resolved.bubbles);
  applyEdgeEffects(cap, 'cap', config, resolved.edge, stickDimensions);
  applyEdgeEffects(side, 'side', config, resolved.edge, stickDimensions);

  return [cap, side];
}

export function createSurfaceMaterial(
  config: WallpaperConfig,
  paletteIndex: number,
  color: string,
  envIntensity: number,
  opacity: number,
  options?: { applyOverrides?: boolean }
): THREE.Material {
  const resolved = resolvePaletteConfig(config, paletteIndex, { applyOverrides: options?.applyOverrides });
  const emissive = resolved.emission.enabled
    ? { enabled: true, intensity: resolved.emission.intensity, color }
    : { enabled: false, intensity: 0, color };

  const m = createStickMaterial({
    texture: resolved.texture,
    color,
    envIntensity,
    stickOpacity: Math.max(0, Math.min(1, opacity)),
    seed: config.seed,
    textureParams: resolved.textureParams,
    emissive
  });
  if (resolved.facades?.grazing?.enabled) applyGrazing(m, resolved.facades.grazing);
  applyVoronoi(m, resolved.voronoi);
  applyBubbles(m, config, undefined, resolved.bubbles);
  return m;
}

export function createStickMaterial(options: {
  texture: TextureType;
  color: string;
  envIntensity: number;
  stickOpacity: number;
  seed: number;
  textureParams: TextureParams;
  emissive?: { enabled: boolean; intensity: number; color: string };
}): THREE.Material {
  const { texture, color, envIntensity, stickOpacity, seed, textureParams, emissive } = options;

  const withEmission = (m: THREE.Material): THREE.Material => {
    if (!emissive?.enabled) return m;
    const anyMat: any = m as any;
    if (anyMat.emissive instanceof THREE.Color) {
      anyMat.emissive.set(emissive.color);
    } else if ('emissive' in anyMat) {
      anyMat.emissive = new THREE.Color(emissive.color);
    }
    if (typeof anyMat.emissiveIntensity === 'number') {
      anyMat.emissiveIntensity = Math.max(0, Number(emissive.intensity) || 0);
    }
    return m;
  };

  const basePhysical: THREE.MeshPhysicalMaterialParameters = {
    color,
    transparent: stickOpacity < 1,
    opacity: stickOpacity,
    dithering: true
  };

  if (texture === 'cel') {
    const m = new THREE.MeshToonMaterial({
      color,
      transparent: stickOpacity < 1,
      opacity: stickOpacity
    });
    m.gradientMap = getToonGradientMap(textureParams.cel.bands);
    if (textureParams.cel.halftone) applyHalftone(m);
    return withEmission(m);
  }

  if (texture === 'mirror') {
    return withEmission(
      new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.0,
        metalness: 1.0,
        clearcoat: 0.0,
        reflectivity: 1.0,
        envMapIntensity: envIntensity * 2.0,
        ior: 2.0
      })
    );
  }

  if (texture === 'glass') {
    const style: GlassStyle = textureParams.glass.style;
    const preset =
      style === 'frosted'
        ? { roughness: 0.35, thickness: 1.2, ior: 1.5 }
        : style === 'thick'
          ? { roughness: 0.06, thickness: 3.0, ior: 1.55 }
          : style === 'stylized'
            ? { roughness: 0.14, thickness: 1.8, ior: 1.42 }
            : { roughness: 0.02, thickness: 1.0, ior: 1.5 };

    return withEmission(
      new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        transparent: true,
        transmission: 1.0,
        thickness: preset.thickness,
        ior: preset.ior,
        roughness: preset.roughness,
        metalness: 0.0,
        clearcoat: style === 'stylized' ? 0.8 : 0.2,
        clearcoatRoughness: style === 'frosted' ? 0.65 : 0.1,
        envMapIntensity: envIntensity
      })
    );
  }

  if (texture === 'drywall') {
    const amt = clamp(textureParams.drywall.grainAmount, 0, 1);
    const scale = clamp(textureParams.drywall.grainScale, 0.1, 50);
    const maps = createDrywallMaps(seed, amt);
    maps.normalMap.repeat.set(scale, scale);
    maps.roughnessMap.repeat.set(scale, scale);

    return withEmission(
      new THREE.MeshPhysicalMaterial({
        ...basePhysical,
        roughness: 0.92,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.15,
        sheenRoughness: 0.9,
        sheenColor: new THREE.Color(0xffffff),
        reflectivity: 0.05,
        envMapIntensity: envIntensity * 0.22,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(0.15 + amt * 0.75, 0.15 + amt * 0.75),
        roughnessMap: maps.roughnessMap
      })
    );
  }

  switch (texture) {
    case 'glossy':
      return withEmission(
        new THREE.MeshPhysicalMaterial({
          ...basePhysical,
          roughness: 0.05,
          metalness: 0.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          reflectivity: 1.0,
          envMapIntensity: envIntensity,
          ior: 1.5,
          transmission: 0.0,
          thickness: 0.1
        })
      );
    case 'metallic':
      return withEmission(
        new THREE.MeshPhysicalMaterial({
          ...basePhysical,
          roughness: 0.25,
          metalness: 0.95,
          clearcoat: 0.3,
          clearcoatRoughness: 0.1,
          reflectivity: 1.0,
          envMapIntensity: envIntensity * 1.6,
          ior: 2.0
        })
      );
    case 'matte':
    default:
      return withEmission(
        new THREE.MeshPhysicalMaterial({
          ...basePhysical,
          roughness: 0.9,
          metalness: 0.0,
          clearcoat: 0.0,
          sheen: 0.3,
          sheenRoughness: 0.8,
          sheenColor: new THREE.Color(0xffffff),
          reflectivity: 0.2,
          envMapIntensity: envIntensity * 0.35
        })
      );
  }
}
