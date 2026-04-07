import type { Bands2DMode, WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createBands2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, randomWeighted, theme } = context;

  const panelEnabled = chance(0.55);

  const modeRoll = rng();
  const mode: Bands2DMode =
    panelEnabled
      ? modeRoll < 0.75
        ? 'chevron'
        : modeRoll < 0.95
          ? 'waves'
          : 'straight'
      : modeRoll < 0.42
        ? 'waves'
        : modeRoll < 0.7
          ? 'chevron'
          : 'straight';

  const bandWidthPx = Math.max(8, Math.round(randomWeighted(10, 260, 120)));
  const gapPx = Math.max(0, Math.round(randomWeighted(0, 120, 28)));
  const angleDeg = randomWeighted(0, 360, 22);

  const pickPanelRect = (): { x: number; y: number; w: number; h: number } => {
    const r = rng();
    // Biased archetypes to often hit the target-like compositions.
    if (r < 0.42) {
      // Center card (wide_lines-like)
      const w = clamp(tri(0.22, 0.34, 0.52), 0.08, 0.95);
      const h = clamp(tri(0.18, 0.34, 0.6), 0.08, 0.95);
      const x = clamp(0.5 - w * 0.5 + tri(-0.06, 0, 0.06), 0, 1 - w);
      const y = clamp(0.5 - h * 0.5 + tri(-0.08, 0, 0.08), 0, 1 - h);
      return { x, y, w, h };
    }
    if (r < 0.72) {
      // Left strip (nordic-like)
      const w = clamp(tri(0.12, 0.18, 0.28), 0.06, 0.6);
      const x = clamp(tri(0.02, 0.14, 0.32), 0, 1 - w);
      return { x, y: 0, w, h: 1 };
    }
    if (r < 0.82) {
      // Right strip
      const w = clamp(tri(0.12, 0.18, 0.28), 0.06, 0.6);
      const x = clamp(1 - w - tri(0.02, 0.06, 0.28), 0, 1 - w);
      return { x, y: 0, w, h: 1 };
    }
    if (r < 0.91) {
      // Top banner
      const h = clamp(tri(0.12, 0.18, 0.32), 0.06, 0.6);
      const y = clamp(tri(0.02, 0.06, 0.22), 0, 1 - h);
      return { x: 0, y, w: 1, h };
    }
    // Bottom banner
    const h = clamp(tri(0.12, 0.18, 0.32), 0.06, 0.6);
    const y = clamp(1 - h - tri(0.02, 0.06, 0.22), 0, 1 - h);
    return { x: 0, y, w: 1, h };
  };

  const rectFrac = pickPanelRect();

  return {
    ...base,
    type: 'bands2d',
    emission: { ...base.emission, enabled: false, intensity: 0 },
    bloom: { ...base.bloom, enabled: false },
    collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
    bands: {
      mode,
      seedOffset: Math.round(tri(-50, 0, 50)),
      angleDeg,
      bandWidthPx,
      gapPx,
      offsetPx: Math.round(randomWeighted(-400, 400, 0)),
      jitterPx: Math.round(randomWeighted(0, 120, 0)),
      panel: {
        enabled: panelEnabled,
        rectFrac,
        radiusPx: Math.round(tri(0, 0, 80)),
        fill: {
          enabled: panelEnabled && chance(0.18),
          color: theme.backgroundColor,
          opacity: clamp(tri(0.25, 0.85, 1.0), 0, 1)
        }
      },
      fill: { enabled: true, opacity: clamp(tri(0.35, 1.0, 1.0), 0, 1) },
      stroke: {
        enabled: rng() < 0.22,
        widthPx: Math.round(randomWeighted(1, 10, 2)),
        color: '#0b0b10',
        opacity: clamp(tri(0.1, 0.65, 1.0), 0, 1)
      },
      waves: {
        amplitudePx: Math.round(randomWeighted(0, 140, 36)),
        wavelengthPx: Math.round(randomWeighted(120, 1200, 520)),
        noiseAmount: clamp(tri(0, 0.25, 1), 0, 1),
        noiseScale: clamp(tri(0.2, 0.9, 3.5), 0.01, 50)
      },
      chevron: {
        amplitudePx: Math.round(randomWeighted(0, 220, 68)),
        wavelengthPx: Math.round(randomWeighted(80, 700, 260)),
        sharpness: clamp(tri(0.6, 1.4, 4.0), 0.1, 8),
        sharedPhase: panelEnabled ? chance(0.9) : chance(0.75)
      },
      paletteMode: rng() < 0.55 ? 'cycle' : 'weighted',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
    }
  };
}
