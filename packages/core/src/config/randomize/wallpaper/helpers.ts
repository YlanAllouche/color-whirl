import type { BaseWallpaperConfig, TextureType, WallpaperType } from '../../types.js';

import { DEFAULT_POPSICLE_CONFIG } from '../../defaults.js';

import type { RandomColorTheme } from '../colors.js';

import { generateRandomColorThemeFromSeed } from '../colors.js';
import type { RNG } from '../rng.js';
import { createRng, randomTriangular, randomWeighted } from '../rng.js';
import { clamp, deepMerge } from '../utils.js';

import type { RandomizeWallpaperOptions } from './index.js';

export type RandomConfigContext = {
  base: BaseWallpaperConfig;
  rng: RNG;
  seed: number;
  type: WallpaperType;
  theme: RandomColorTheme;
  tri: (min: number, mode: number, max: number) => number;
  chance: (p: number) => boolean;
  randomWeighted: (min: number, max: number, mode: number) => number;
  randomStickOpacity: () => number;
  skewCountLow: (min: number, normal: number, softMax: number, hardMax: number, tailChance?: number) => number;
  is3DType: boolean;
  profile: 'safe' | 'exploratory';
};

export function createRandomConfigContext(seed: number, type: WallpaperType, options?: RandomizeWallpaperOptions): RandomConfigContext {
  const rng = createRng(seed);
  const profile = options?.profile === 'exploratory' ? 'exploratory' : 'safe';
  const isExploratory = profile === 'exploratory';

  const theme = generateRandomColorThemeFromSeed(seed ^ 0x9e3779b9, 5);

  const textures: TextureType[] = ['glossy', 'matte', 'metallic', 'drywall', 'glass', 'mirror', 'cel'];
  const texture = textures[Math.floor(rng() * textures.length)];

  // Opacity distribution:
  // - Very likely fully opaque (1)
  // - Somewhat likely slightly translucent
  // - Extremely unlikely to be very transparent
  const randomStickOpacity = (): number => {
    const r = rng();
    if (r < 0.9) return 1.0;
    // Mostly imperceptible translucency.
    if (r < 0.995) return clamp(randomWeighted(rng, 0.92, 1.0, 0.992), 0, 1);
    // Rare: noticeable translucency.
    if (r < 0.9995) return clamp(randomWeighted(rng, 0.5, 0.92, 0.85), 0, 1);
    // Extremely rare: quite transparent.
    return clamp(randomWeighted(rng, 0.15, 0.5, 0.35), 0, 1);
  };

  const tri = (min: number, mode: number, max: number): number => randomTriangular(rng, min, mode, max);
  const chance = (p: number): boolean => rng() < clamp(p, 0, 1);

  // Heavily bias toward smaller counts, while keeping large values possible.
  const skewCountLow = (
    min: number,
    normal: number,
    softMax: number,
    hardMax: number,
    tailChance: number = 0.03
  ): number => {
    const t = clamp(tailChance, 0, 1);
    if (rng() >= t) {
      return Math.round(clamp(randomWeighted(rng, min, softMax, normal), min, hardMax));
    }
    const tailMode = clamp(softMax + (hardMax - softMax) * 0.35, softMax, hardMax);
    return Math.round(clamp(randomWeighted(rng, softMax, hardMax, tailMode), min, hardMax));
  };

  const emissionPaletteIndex = Math.floor(rng() * Math.max(1, theme.colors.length));
  const emissionIntensityBase = clamp(tri(0, DEFAULT_POPSICLE_CONFIG.emission.intensity, 14), 0, 20);
  const emissionIntensitySeed = emissionIntensityBase > 0 ? emissionIntensityBase : DEFAULT_POPSICLE_CONFIG.emission.intensity;
  const fallbackGlobalEmission = chance(0.08);
  const bloomEnabled = chance(0.35);

  const is3DType = type === 'popsicle' || type === 'spheres3d' || type === 'triangles3d' || type === 'svg3d';

  // Rare: procedural cavity cutouts (raster-only; best-effort for other renderers).
  const bubblesEnabled = (type === 'popsicle' || type === 'spheres3d') && chance(0.035);

  // Collisions are allowed for 2D types but are disabled for 3D random configs.
  // (3D carve collisions are both expensive and historically problematic.)
  const collisionsMode = !is3DType && chance(0.12) ? 'carve' : 'none';
  const collisionsEdge = chance(0.28) ? 'soft' : 'hard';
  const collisionsFeather =
    collisionsMode === 'carve' && collisionsEdge === 'soft'
      ? Math.round(tri(0, DEFAULT_POPSICLE_CONFIG.collisions.carve.featherPx, 16))
      : 0;

  const cameraMode: 'auto' | 'manual' = is3DType && chance(isExploratory ? 0.35 : 0.08) ? 'manual' : 'auto';
  const cameraPadding = isExploratory
    ? clamp(tri(0.6, DEFAULT_POPSICLE_CONFIG.camera.padding, 0.995), 0.5, 0.999)
    : clamp(tri(0.82, DEFAULT_POPSICLE_CONFIG.camera.padding, 0.99), 0.5, 0.999);
  const cameraDistance = isExploratory
    ? tri(4, DEFAULT_POPSICLE_CONFIG.camera.distance, 65)
    : tri(5, DEFAULT_POPSICLE_CONFIG.camera.distance, 50);

  const cameraZoom = cameraMode === 'manual'
    ? isExploratory
      ? clamp(randomWeighted(rng, 0.2, 8.0, 1.6), 0.01, 80)
      : clamp(randomWeighted(rng, 0.7, 2.2, 1.15), 0.01, 80)
    : DEFAULT_POPSICLE_CONFIG.camera.zoom;
  const cameraPanX = cameraMode === 'manual'
    ? isExploratory
      ? randomWeighted(rng, -4.0, 4.0, 0)
      : randomWeighted(rng, -1.2, 1.2, 0)
    : DEFAULT_POPSICLE_CONFIG.camera.panX;
  const cameraPanY = cameraMode === 'manual'
    ? isExploratory
      ? randomWeighted(rng, -4.0, 4.0, 0)
      : randomWeighted(rng, -1.2, 1.2, 0)
    : DEFAULT_POPSICLE_CONFIG.camera.panY;
  const cameraNear = cameraMode === 'manual'
    ? isExploratory
      ? clamp(tri(0.001, 0.04, 1.2), 0.001, 10000)
      : clamp(tri(0.001, 0.02, 0.35), 0.001, 10000)
    : DEFAULT_POPSICLE_CONFIG.camera.near;
  const cameraFar = cameraMode === 'manual'
    ? isExploratory
      ? Math.max(cameraNear + 0.001, tri(150, 1200, 8000))
      : Math.max(cameraNear + 0.001, tri(300, 1200, 4000))
    : DEFAULT_POPSICLE_CONFIG.camera.far;

  const base: BaseWallpaperConfig = {
    type,
    seed,
    width: DEFAULT_POPSICLE_CONFIG.width,
    height: DEFAULT_POPSICLE_CONFIG.height,
    colors: [...theme.colors],
    palette: { overrides: [] },
    texture,
    textureParams: {
      drywall: {
        grainAmount: clamp(tri(0.0, DEFAULT_POPSICLE_CONFIG.textureParams.drywall.grainAmount, 1.0), 0, 1),
        grainScale: clamp(tri(0.6, DEFAULT_POPSICLE_CONFIG.textureParams.drywall.grainScale, 6.5), 0.1, 50)
      },
      glass: {
        style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)]
      },
      cel: {
        bands: Math.max(2, Math.min(8, Math.round(tri(2, DEFAULT_POPSICLE_CONFIG.textureParams.cel.bands, 8)))),
        halftone: chance(0.25)
      }
    },
    voronoi: (() => {
      const enabled = is3DType && chance(0.22);
      const textureBias =
        texture === 'mirror'
          ? { roughness: 0.52, normal: 0.42, amount: 0.86, scale: 5.4 }
          : texture === 'metallic'
            ? { roughness: 0.48, normal: 0.38, amount: 0.84, scale: 5.2 }
            : texture === 'glossy'
              ? { roughness: 0.46, normal: 0.36, amount: 0.82, scale: 4.9 }
              : texture === 'glass'
                ? { roughness: 0.34, normal: 0.28, amount: 0.74, scale: 4.4 }
                : {
                    roughness: DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength,
                    normal: DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength,
                    amount: DEFAULT_POPSICLE_CONFIG.voronoi.amount,
                    scale: DEFAULT_POPSICLE_CONFIG.voronoi.scale
                  };
      const kind = enabled ? (chance(0.78) ? 'edges' : 'cells') : DEFAULT_POPSICLE_CONFIG.voronoi.kind;
      const materialKind =
        !enabled
          ? DEFAULT_POPSICLE_CONFIG.voronoi.materialKind
          : kind === 'cells'
            ? (chance(0.62) ? 'edges' : chance(0.75) ? 'match' : 'cells')
            : (chance(0.78) ? 'match' : chance(0.85) ? 'edges' : 'cells');

      const crackleEnabled = enabled && (kind === 'edges' || materialKind === 'edges') && chance(0.22);
      const nucleusEnabled = enabled && chance(kind === 'cells' ? 0.65 : 0.25);

      const materialMode =
        !enabled
          ? DEFAULT_POPSICLE_CONFIG.voronoi.materialMode
          : texture === 'glass'
            ? (chance(0.72) ? 'normal' : chance(0.8) ? 'both' : chance(0.9) ? 'roughness' : 'none')
            : texture === 'matte'
              ? (chance(0.7) ? 'roughness' : chance(0.75) ? 'both' : chance(0.9) ? 'normal' : 'none')
              : texture === 'mirror'
                ? (chance(0.66) ? 'normal' : chance(0.72) ? 'both' : chance(0.9) ? 'roughness' : 'none')
                : (() => {
                    const r = rng();
                    if (r < 0.5) return 'both';
                    if (r < 0.82) return 'roughness';
                    if (r < 0.98) return 'normal';
                    return 'none';
                  })();

      return {
        ...DEFAULT_POPSICLE_CONFIG.voronoi,
        enabled,
        space: chance(0.72) ? 'world' : 'object',
        kind,
        scale: clamp(tri(0.8, textureBias.scale, 16), 0.1, 80),
        seedOffset: Math.round(tri(-50, 0, 50)),
        amount: enabled ? clamp(tri(0.18, textureBias.amount, 0.96), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.amount,
        edgeWidth: clamp(tri(0.01, DEFAULT_POPSICLE_CONFIG.voronoi.edgeWidth, 0.48), 0, 1),
        softness: clamp(tri(0.0, DEFAULT_POPSICLE_CONFIG.voronoi.softness, 0.78), 0, 1),
        colorStrength: enabled
          ? clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength, 1.0), 0, 1)
          : DEFAULT_POPSICLE_CONFIG.voronoi.colorStrength,
        colorMode: (['darken', 'lighten', 'tint'] as const)[chance(0.6) ? 0 : Math.floor(rng() * 3)],
        tintColor: '#ffffff',
        materialMode,
        materialKind,
        roughnessStrength: enabled
          ? clamp(tri(0.08, textureBias.roughness, 0.78), 0, 1)
          : DEFAULT_POPSICLE_CONFIG.voronoi.roughnessStrength,
        normalStrength: enabled ? clamp(tri(0.06, textureBias.normal, 0.68), 0, 1) : DEFAULT_POPSICLE_CONFIG.voronoi.normalStrength,
        normalScale: clamp(tri(0.12, DEFAULT_POPSICLE_CONFIG.voronoi.normalScale, 0.88), 0, 1),
        crackleAmount: crackleEnabled ? clamp(tri(0.05, 0.28, 0.85), 0, 1) : 0,
        crackleScale: crackleEnabled
          ? clamp(tri(2, DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale, 60), 0, 200)
          : DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale,
        nucleus: {
          ...DEFAULT_POPSICLE_CONFIG.voronoi.nucleus,
          enabled: nucleusEnabled,
          size: nucleusEnabled
            ? clamp(tri(0.03, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size, 0.18), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size,
          softness: nucleusEnabled
            ? clamp(tri(0.05, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness, 0.85), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness,
          strength: nucleusEnabled
            ? clamp(tri(0.25, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength, 1.0), 0, 1)
            : DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength,
          color: '#ffffff'
        }
      };
    })(),
    backgroundColor: theme.backgroundColor,
    facades: (() => {
      const tintEnabled = chance(0.18);
      const materialEnabled = chance(0.18);
      const wearEnabled = chance(0.12);
      const rimEnabled = chance(0.25);

      const sideEnabled = tintEnabled || materialEnabled;
      const grazingEnabled = wearEnabled || rimEnabled;
      const grazingMode =
        rimEnabled && !wearEnabled ? 'add' : wearEnabled && !rimEnabled ? 'mix' : chance(0.5) ? 'add' : 'mix';

      return {
        side: {
          enabled: sideEnabled,
          tintColor: DEFAULT_POPSICLE_CONFIG.facades.side.tintColor,
          tintAmount: tintEnabled ? clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.tintAmount, 0.9), 0, 1) : 0,
          materialAmount: materialEnabled ? 1.0 : 0.0,
          roughness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.roughness, 1), 0, 1),
          metalness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.metalness, 1), 0, 1),
          clearcoat: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.clearcoat, 1), 0, 1),
          envIntensityMult: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.side.envIntensityMult, 3), 0, 3)
        },
        grazing: {
          enabled: grazingEnabled,
          mode: grazingMode,
          color: DEFAULT_POPSICLE_CONFIG.facades.grazing.color,
          strength:
            grazingMode === 'add'
              ? clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.grazing.strength, 2.5), 0, 5)
              : clamp(tri(0, 0.35, 1), 0, 1),
          power:
            grazingMode === 'add'
              ? clamp(tri(0.5, DEFAULT_POPSICLE_CONFIG.facades.grazing.power, 8), 0.5, 8)
              : clamp(tri(0.5, 2.0, 8), 0.5, 8),
          width: clamp(tri(0, 0.5, 1), 0, 1),
          noise: wearEnabled ? clamp(tri(0, 0.6, 1), 0, 1) : 0
        },
        outline: {
          enabled: chance(0.1),
          color: DEFAULT_POPSICLE_CONFIG.facades.outline.color,
          thickness: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.facades.outline.thickness, 0.12), 0, 0.2),
          opacity: clamp(tri(0.2, DEFAULT_POPSICLE_CONFIG.facades.outline.opacity, 1.0), 0, 1)
        }
      };
    })(),
    edge: {
      hollow: false,
      seam: { ...DEFAULT_POPSICLE_CONFIG.edge.seam },
      band: { ...DEFAULT_POPSICLE_CONFIG.edge.band }
    },
    bubbles: {
      enabled: bubblesEnabled,
      // Keep random configs conservative: cap mode is experimental/heavy.
      mode: 'through',
      interior: { enabled: true },
      // frequency controls density; count is the sample budget in shader.
      frequency: bubblesEnabled ? clamp(tri(1.1, 1.8, 3.2), 0.1, 20) : DEFAULT_POPSICLE_CONFIG.bubbles.frequency,
      frequencyVariance: bubblesEnabled
        ? clamp(tri(0.0, 0.22, 0.4), 0, 1)
        : DEFAULT_POPSICLE_CONFIG.bubbles.frequencyVariance,
      count: bubblesEnabled ? Math.max(3, Math.min(8, Math.round(tri(4, 6, 8)))) : DEFAULT_POPSICLE_CONFIG.bubbles.count,
      radiusMin: bubblesEnabled ? clamp(tri(0.06, 0.12, 0.22), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.bubbles.radiusMin,
      radiusMax: bubblesEnabled ? clamp(tri(0.18, 0.32, 0.55), 0.0, 10) : DEFAULT_POPSICLE_CONFIG.bubbles.radiusMax,
      softness: bubblesEnabled ? clamp(tri(0.0, 0.05, 0.12), 0.0, 2) : DEFAULT_POPSICLE_CONFIG.bubbles.softness,
      wallThickness: bubblesEnabled ? clamp(tri(0.04, 0.08, 0.2), 0.0, 0.3) : DEFAULT_POPSICLE_CONFIG.bubbles.wallThickness,
      seedOffset: bubblesEnabled ? Math.round(tri(-50, 0, 50)) : DEFAULT_POPSICLE_CONFIG.bubbles.seedOffset
    },
    emission: {
      enabled: fallbackGlobalEmission,
      paletteIndex: emissionPaletteIndex,
      intensity: emissionIntensityBase
    },
    bloom: {
      enabled: bloomEnabled,
      strength: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.bloom.strength, 2.5), 0, 10),
      radius: clamp(tri(0, DEFAULT_POPSICLE_CONFIG.bloom.radius, 1.2), 0, 10),
      threshold: clamp(tri(0.5, DEFAULT_POPSICLE_CONFIG.bloom.threshold, 0.99), 0, 1)
    },
    collisions: {
      mode: collisionsMode,
      carve: {
        direction: collisionsMode === 'carve' && chance(0.18) ? 'twoWay' : 'oneWay',
        marginPx: collisionsMode === 'carve' ? Math.round(tri(0, DEFAULT_POPSICLE_CONFIG.collisions.carve.marginPx, 24)) : 0,
        edge: collisionsMode === 'carve' ? collisionsEdge : DEFAULT_POPSICLE_CONFIG.collisions.carve.edge,
        featherPx: collisionsFeather,
        // 3D-only feature; keep random configs conservative.
        finish: 'none',
        finishAutoDepthMult: DEFAULT_POPSICLE_CONFIG.collisions.carve.finishAutoDepthMult
      }
    },
    lighting: {
      enabled: chance(0.8),
      intensity: tri(0.2, DEFAULT_POPSICLE_CONFIG.lighting.intensity, 3.5),
      position: {
        x: tri(-10, DEFAULT_POPSICLE_CONFIG.lighting.position.x, 10),
        y: tri(-10, DEFAULT_POPSICLE_CONFIG.lighting.position.y, 10),
        z: tri(0, DEFAULT_POPSICLE_CONFIG.lighting.position.z, 20)
      },
      ambientIntensity: tri(0.0, DEFAULT_POPSICLE_CONFIG.lighting.ambientIntensity, 1.0)
    },
    camera: {
      mode: cameraMode,
      padding: cameraPadding,
      distance: cameraDistance,
      zoom: cameraZoom,
      panX: cameraPanX,
      panY: cameraPanY,
      azimuth: tri(0, DEFAULT_POPSICLE_CONFIG.camera.azimuth, 360),
      elevation: tri(-80, DEFAULT_POPSICLE_CONFIG.camera.elevation, 80),
      near: cameraNear,
      far: cameraFar
    },
    environment: {
      enabled: chance(0.85),
      intensity: tri(0.0, DEFAULT_POPSICLE_CONFIG.environment.intensity, 2.8),
      rotation: tri(0, DEFAULT_POPSICLE_CONFIG.environment.rotation, 360),
      style: (['studio', 'overcast', 'sunset'] as const)[chance(0.7) ? 0 : chance(0.65) ? 1 : 2]
    },
    shadows: {
      enabled: chance(0.75),
      type: chance(0.2) ? 'vsm' : 'pcfsoft',
      mapSize: ([512, 1024, 2048, 4096] as const)[Math.max(0, Math.min(3, Math.round(tri(0, 2, 3))))],
      bias: tri(-0.005, DEFAULT_POPSICLE_CONFIG.shadows.bias, 0.001),
      normalBias: tri(0.0, DEFAULT_POPSICLE_CONFIG.shadows.normalBias, 0.08)
    },
    rendering: {
      toneMapping: chance(0.88) ? 'aces' : 'none',
      exposure: tri(0.6, DEFAULT_POPSICLE_CONFIG.rendering.exposure, 1.8)
    },
    // Do not randomize geometry.quality here (parameter-like).
    geometry: { ...DEFAULT_POPSICLE_CONFIG.geometry }
  };

  // Palette overrides: strongly biased toward none.
  // Occasionally enables a single accent color emission and/or a per-color texture.
  const paletteCount = Math.max(0, base.colors.length);
  const paletteOverrides: Array<any> = [];

  const setOverride = (pi: number, patch: any) => {
    if (pi < 0 || pi >= paletteCount) return;
    const existing = paletteOverrides[pi] && typeof paletteOverrides[pi] === 'object' ? paletteOverrides[pi] : { enabled: true };
    const merged = deepMerge(existing, patch ?? {});
    merged.enabled = true;
    paletteOverrides[pi] = merged;
  };

  const allowOverrides = chance(0.06);
  if (allowOverrides && paletteCount > 0) {
    const emissionIndices = new Set<number>();
    const addEmissionTarget = () => {
      if (paletteCount === 0) return;
      if (emissionIndices.size >= paletteCount) return;
      let idx = Math.floor(rng() * paletteCount);
      let tries = 0;
      while (emissionIndices.has(idx) && tries < 5) {
        idx = Math.floor(rng() * paletteCount);
        tries++;
      }
      emissionIndices.add(idx);
    };

    if (chance(0.55)) addEmissionTarget();
    if (chance(0.22) && paletteCount > 1) addEmissionTarget();
    if (chance(0.08) && paletteCount > 2) addEmissionTarget();

    let emissionOrder = 0;
    for (const idx of emissionIndices) {
      const intensity =
        emissionOrder === 0
          ? clamp(tri(0.6, emissionIntensitySeed, 14), 0, 20)
          : clamp(emissionIntensitySeed * tri(0.35, 0.7, 1.0), 0, 20);
      setOverride(idx, { emission: { enabled: true, intensity } });
      emissionOrder++;
    }

    // Very rare: per-color texture for 3D types.
    if (is3DType && chance(0.12)) {
      const idx = Math.floor(rng() * paletteCount);
      const t: TextureType = chance(0.55) ? 'glass' : chance(0.6) ? 'mirror' : chance(0.5) ? 'metallic' : 'matte';
      const params: any =
        t === 'glass'
          ? { glass: { style: (['simple', 'frosted', 'thick', 'stylized'] as const)[Math.floor(rng() * 4)] } }
          : undefined;
      setOverride(idx, { texture: { type: t, params } });
    }

    // Rare: per-color geometry multipliers (subtle accent near 1.0).
    if (chance(0.18)) {
      const idx = Math.floor(rng() * paletteCount);
      const mult = () => clamp(tri(0.85, 1.0, 1.18), 0.5, 2.0);

      if (type === 'popsicle') {
        setOverride(idx, {
          geometry: {
            popsicle: {
              sizeMult: mult(),
              ratioMult: mult(),
              thicknessMult: mult()
            }
          }
        });
      } else if (type === 'spheres3d') {
        setOverride(idx, { geometry: { spheres3d: { radiusMult: mult() } } });
      } else if (type === 'triangles3d') {
        setOverride(idx, { geometry: { triangles3d: { radiusMult: mult(), heightMult: mult() } } });
      } else if (type === 'svg2d') {
        setOverride(idx, { geometry: { svg: { sizeMult: mult() } } });
      } else if (type === 'svg3d') {
        setOverride(idx, { geometry: { svg: { sizeMult: mult(), extrudeMult: mult() } } });
      }
    }

    // Rare: per-color voronoi override (accent texture).
    if (is3DType && (base as any).voronoi?.enabled && chance(0.12)) {
      const idx = Math.floor(rng() * paletteCount);
      setOverride(idx, {
        voronoi: {
          enabled: false
        }
      });
    }

    if (is3DType && chance(0.16)) {
      const idx = Math.floor(rng() * paletteCount);
      setOverride(idx, {
        voronoi: {
          enabled: true,
          amount: clamp(tri(0.05, 0.65, 1.0), 0, 1),
          scale: clamp(tri(0.6, 3.5, 18), 0.1, 80),
          kind: rng() < 0.7 ? 'edges' : 'cells',
          materialKind: rng() < 0.7 ? 'match' : rng() < 0.85 ? 'edges' : 'cells',
          crackleAmount: rng() < 0.22 ? clamp(tri(0.05, 0.25, 0.85), 0, 1) : 0,
          crackleScale: clamp(tri(2, DEFAULT_POPSICLE_CONFIG.voronoi.crackleScale, 60), 0, 200),
          nucleus: {
            enabled: rng() < 0.25,
            size: clamp(tri(0.03, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.size, 0.18), 0, 1),
            softness: clamp(tri(0.05, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.softness, 0.85), 0, 1),
            strength: clamp(tri(0.25, DEFAULT_POPSICLE_CONFIG.voronoi.nucleus.strength, 1.0), 0, 1),
            color: '#ffffff'
          },
          colorStrength: clamp(tri(0.05, 0.25, 1.0), 0, 1),
          colorMode: rng() < 0.6 ? 'darken' : rng() < 0.5 ? 'lighten' : 'tint',
          materialMode: rng() < 0.2 ? 'none' : rng() < 0.5 ? 'roughness' : rng() < 0.75 ? 'normal' : 'both',
          tintColor: '#ffffff'
        }
      });
    }
  }

  (base as any).palette.overrides = paletteOverrides;

  const paletteEmissionActive = paletteOverrides.some(
    (ov) => !!ov && typeof ov === 'object' && !!ov.emission?.enabled && Number(ov.emission?.intensity) > 0
  );
  const fallbackEmissionActive = !!(base as any).emission.enabled && Number((base as any).emission.intensity) > 0;

  if (paletteEmissionActive) {
    (base as any).emission = { ...(base as any).emission, enabled: false, intensity: 0 };
    (base as any).bloom = { ...(base as any).bloom, enabled: true };
  }

  const emissionInfluencesBloom = paletteEmissionActive || fallbackEmissionActive;
  void emissionInfluencesBloom;

  const randomWeightedValue = (min: number, max: number, mode: number): number => randomWeighted(rng, min, max, mode);

  return {
    base,
    rng,
    seed,
    type,
    theme,
    tri,
    chance,
    randomWeighted: randomWeightedValue,
    randomStickOpacity,
    skewCountLow,
    is3DType,
    profile
  };
}
