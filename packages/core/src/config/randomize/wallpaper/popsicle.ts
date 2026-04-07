import type { PopsicleConfig, WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createPopsicleConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, randomWeighted, randomStickOpacity, theme } = context;

  const endProfileR = rng();
  const stickEndProfile: PopsicleConfig['stickEndProfile'] =
    endProfileR < 0.72 ? 'rounded' : endProfileR < 0.9 ? 'chamfer' : 'chipped';

  const seamEnabled = rng() < 0.16;
  const bandEnabled = rng() < 0.1;
  const hollow = rng() < 0.1;
  const edgeEmissiveSeam = seamEnabled && rng() < 0.1;
  const edgeEmissiveBand = bandEnabled && rng() < 0.08;
  const pickEdgeColor = () => {
    if (theme.colors.length > 0 && rng() < 0.75) return theme.colors[Math.floor(rng() * theme.colors.length)] ?? '#ffffff';
    return rng() < 0.5 ? '#ffffff' : '#0b0b10';
  };
  return {
    ...base,
    type: 'popsicle',
    stickCount: Math.round(randomWeighted(1, 200, 40)),
    stickOverhang: randomWeighted(0, 180, 30),
    rotationCenterOffsetX: randomWeighted(-100, 100, 0),
    rotationCenterOffsetY: randomWeighted(-100, 100, 0),
    stickGap: randomWeighted(0, 5, 0.05),
    stickSize: randomWeighted(0.25, 2.5, 1.0),
    stickRatio: randomWeighted(0.75, 12, 3.0),
    stickThickness: randomWeighted(0.1, 3, 1.0),
    stickEndProfile,
    // Bias toward simpler square-ish ends.
    stickRoundness: clamp(Math.pow(randomWeighted(0, 1, 0.18), 1.6), 0, 1),
    stickChipAmount: stickEndProfile === 'chipped' ? randomWeighted(0, 1, 0.35) : 0,
    stickChipJaggedness: stickEndProfile === 'chipped' ? randomWeighted(0, 1, 0.55) : 0,
    stickBevel: randomWeighted(0, 1, 0.35),
    stickOpacity: randomStickOpacity(),
    edge: {
      ...(base as any).edge,
      hollow,
      seam: {
        ...(base as any).edge.seam,
        enabled: seamEnabled,
        color: edgeEmissiveSeam ? pickEdgeColor() : '#0b0b10',
        opacity: seamEnabled ? clamp(tri(0.15, (base as any).edge.seam.opacity, 1.0), 0, 1) : (base as any).edge.seam.opacity,
        width: seamEnabled ? clamp(tri(0, 0.012, 0.08), 0, 0.12) : (base as any).edge.seam.width,
        noise: seamEnabled ? clamp(tri(0, 0.15, 0.9), 0, 1) : (base as any).edge.seam.noise,
        emissiveIntensity: edgeEmissiveSeam ? clamp(tri(0.25, 2.0, 8), 0, 20) : 0
      },
      band: {
        ...(base as any).edge.band,
        enabled: bandEnabled,
        color: edgeEmissiveBand ? pickEdgeColor() : '#ffffff',
        opacity: bandEnabled ? clamp(tri(0.05, (base as any).edge.band.opacity, 0.75), 0, 1) : (base as any).edge.band.opacity,
        width: bandEnabled ? clamp(tri(0, (base as any).edge.band.width, 0.22), 0, 0.25) : (base as any).edge.band.width,
        noise: bandEnabled ? clamp(tri(0, 0.1, 0.75), 0, 1) : (base as any).edge.band.noise,
        emissiveIntensity: edgeEmissiveBand ? clamp(tri(0.25, 1.5, 7), 0, 20) : 0
      }
    }
  };
}
