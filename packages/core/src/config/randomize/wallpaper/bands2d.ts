import type { Bands2DMode, WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createBands2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, randomWeighted, theme } = context;

  const archetypeRoll = rng();
  const archetype = archetypeRoll < 0.2 ? 'wide-lines' : archetypeRoll < 0.4 ? 'nordic' : 'balanced';

  const panelEnabled =
    archetype === 'wide-lines'
      ? chance(0.78)
      : archetype === 'nordic'
        ? chance(0.72)
        : chance(0.55);

  const modeRoll = rng();
  const mode: Bands2DMode =
    archetype === 'wide-lines'
      ? modeRoll < 0.76
        ? 'straight'
        : modeRoll < 0.94
          ? 'waves'
          : 'chevron'
      : archetype === 'nordic'
        ? modeRoll < 0.72
          ? 'straight'
          : modeRoll < 0.9
            ? 'chevron'
            : 'waves'
        : panelEnabled
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

  let bandWidthPx = Math.max(8, Math.round(randomWeighted(10, 260, 120)));
  let gapPx = Math.max(0, Math.round(randomWeighted(0, 120, 28)));
  if (archetype === 'wide-lines') {
    const wide = Math.max(24, Math.round(randomWeighted(96, 760, 280)));
    bandWidthPx = wide;
    gapPx = Math.max(0, Math.round(clamp(wide * tri(0.08, 0.32, 0.9), 0, 640)));
  } else if (archetype === 'nordic') {
    const nordicW = Math.max(8, Math.round(randomWeighted(18, 300, 92)));
    bandWidthPx = nordicW;
    gapPx = Math.max(0, Math.round(clamp(nordicW * tri(0.1, 0.58, 1.4), 0, 520)));
  }
  const angleDeg = randomWeighted(0, 360, 22);

  const pickPanelRect = (): { x: number; y: number; w: number; h: number } => {
    const r = rng();
    if (archetype === 'wide-lines') {
      if (r < 0.68) {
        const w = clamp(tri(0.22, 0.38, 0.62), 0.08, 0.95);
        const h = clamp(tri(0.16, 0.3, 0.56), 0.08, 0.95);
        const x = clamp(0.5 - w * 0.5 + tri(-0.05, 0, 0.05), 0, 1 - w);
        const y = clamp(0.5 - h * 0.5 + tri(-0.08, 0, 0.08), 0, 1 - h);
        return { x, y, w, h };
      }
      if (r < 0.84) {
        const h = clamp(tri(0.1, 0.2, 0.34), 0.06, 0.6);
        const y = clamp(tri(0.02, 0.06, 0.22), 0, 1 - h);
        return { x: 0, y, w: 1, h };
      }
      const h = clamp(tri(0.1, 0.2, 0.34), 0.06, 0.6);
      const y = clamp(1 - h - tri(0.02, 0.06, 0.22), 0, 1 - h);
      return { x: 0, y, w: 1, h };
    }
    if (archetype === 'nordic') {
      if (r < 0.58) {
        const w = clamp(tri(0.08, 0.16, 0.3), 0.06, 0.6);
        const x = clamp(tri(0.01, 0.09, 0.26), 0, 1 - w);
        return { x, y: 0, w, h: 1 };
      }
      if (r < 0.78) {
        const w = clamp(tri(0.08, 0.16, 0.3), 0.06, 0.6);
        const x = clamp(1 - w - tri(0.01, 0.08, 0.24), 0, 1 - w);
        return { x, y: 0, w, h: 1 };
      }
      if (r < 0.9) {
        const h = clamp(tri(0.08, 0.17, 0.32), 0.06, 0.6);
        const y = clamp(tri(0.02, 0.06, 0.22), 0, 1 - h);
        return { x: 0, y, w: 1, h };
      }
      const h = clamp(tri(0.08, 0.17, 0.32), 0.06, 0.6);
      const y = clamp(1 - h - tri(0.02, 0.06, 0.22), 0, 1 - h);
      return { x: 0, y, w: 1, h };
    }
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
      jitterPx:
        archetype === 'wide-lines'
          ? Math.round(randomWeighted(0, 8, 0))
          : archetype === 'nordic'
            ? Math.round(randomWeighted(0, 20, 0))
            : Math.round(randomWeighted(0, 120, 0)),
      panel: {
        enabled: panelEnabled,
        rectFrac,
        radiusPx: Math.round(tri(0, 0, 80)),
        fill: {
          enabled: panelEnabled && (archetype === 'nordic' ? chance(0.45) : chance(0.18)),
          color: theme.backgroundColor,
          opacity: clamp(tri(archetype === 'nordic' ? 0.65 : 0.25, archetype === 'nordic' ? 0.92 : 0.85, 1.0), 0, 1)
        }
      },
      fill: {
        enabled: true,
        opacity:
          archetype === 'wide-lines'
            ? clamp(tri(0.82, 0.98, 1.0), 0, 1)
            : archetype === 'nordic'
              ? clamp(tri(0.76, 0.96, 1.0), 0, 1)
              : clamp(tri(0.35, 1.0, 1.0), 0, 1)
      },
      stroke: {
        enabled: archetype === 'nordic' ? rng() < 0.52 : archetype === 'wide-lines' ? rng() < 0.36 : rng() < 0.22,
        widthPx: Math.round(archetype === 'nordic' ? randomWeighted(1, 14, 2) : randomWeighted(1, 10, 2)),
        color: '#0b0b10',
        opacity: clamp(tri(archetype === 'nordic' ? 0.35 : 0.1, archetype === 'nordic' ? 0.78 : 0.65, 1.0), 0, 1)
      },
      waves: {
        amplitudePx: Math.round(
          archetype === 'wide-lines'
            ? randomWeighted(0, 120, 24)
            : archetype === 'nordic'
              ? randomWeighted(0, 90, 14)
              : randomWeighted(0, 140, 36)
        ),
        wavelengthPx: Math.round(
          archetype === 'wide-lines'
            ? randomWeighted(220, 3400, 980)
            : archetype === 'nordic'
              ? randomWeighted(180, 2600, 860)
              : randomWeighted(120, 1200, 520)
        ),
        noiseAmount: clamp(
          archetype === 'wide-lines'
            ? tri(0, 0.03, 0.22)
            : archetype === 'nordic'
              ? tri(0, 0.02, 0.12)
              : tri(0, 0.25, 1),
          0,
          1
        ),
        noiseScale: clamp(
          archetype === 'wide-lines'
            ? tri(0.12, 0.52, 1.8)
            : archetype === 'nordic'
              ? tri(0.1, 0.34, 1.2)
              : tri(0.2, 0.9, 3.5),
          0.01,
          50
        )
      },
      chevron: {
        amplitudePx: Math.round(
          archetype === 'wide-lines'
            ? randomWeighted(0, 260, 72)
            : archetype === 'nordic'
              ? randomWeighted(0, 180, 56)
              : randomWeighted(0, 220, 68)
        ),
        wavelengthPx: Math.round(
          archetype === 'wide-lines'
            ? randomWeighted(120, 1800, 520)
            : archetype === 'nordic'
              ? randomWeighted(120, 1400, 420)
              : randomWeighted(80, 700, 260)
        ),
        sharpness: clamp(archetype === 'nordic' ? tri(0.9, 2.0, 5.2) : tri(0.6, 1.4, 4.0), 0.1, 8),
        sharedPhase: panelEnabled ? chance(0.9) : chance(0.75)
      },
      paletteMode: archetype === 'nordic' ? (rng() < 0.8 ? 'weighted' : 'cycle') : rng() < 0.55 ? 'cycle' : 'weighted',
      colorWeights: archetype === 'nordic' ? [0.56, 0.24, 0.12, 0.06, 0.02] : [0.34, 0.28, 0.18, 0.12, 0.08]
    }
  };
}
