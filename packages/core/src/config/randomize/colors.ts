import { clamp } from './utils.js';
import { createRng, randomWeighted } from './rng.js';

export type PaletteScheme = 'auto' | 'analogous' | 'triadic' | 'complementary' | 'split-complementary' | 'hue-between';

export type RandomColorThemeOptions = {
  scheme?: PaletteScheme;
  hueBetweenAnchors?: [string, string] | string[];
  hueBetweenSteps?: number;
};

function hslToHex(h: number, s: number, l: number): string {
  // h: 0-360, s/l: 0-100
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  const toHex = (v: number) => clamp(v, 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface RandomColorTheme {
  colors: string[];
  backgroundColor: string;
}

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function parseHex(input: string): Rgb | null {
  const clean = String(input || '')
    .trim()
    .replace(/^#/, '');

  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }

  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const n = Number.parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }

  const l = (max + min) * 0.5;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: ((h % 360) + 360) % 360, s: s * 100, l: l * 100 };
}

function shortestHueDelta(from: number, to: number): number {
  const a = ((from % 360) + 360) % 360;
  const b = ((to % 360) + 360) % 360;
  return ((b - a + 540) % 360) - 180;
}

function pickScheme(rng: () => number, scheme: PaletteScheme): Exclude<PaletteScheme, 'auto' | 'hue-between'> {
  if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'complementary' || scheme === 'split-complementary') {
    return scheme;
  }

  const r = rng();
  if (r < 0.4) return 'analogous';
  if (r < 0.7) return 'triadic';
  if (r < 0.9) return 'complementary';
  return 'split-complementary';
}

function buildHueBetweenPalette(input: {
  rng: () => number;
  count: number;
  anchors?: [string, string] | string[];
  steps?: number;
}): string[] | null {
  const { rng, count } = input;
  const anchors = Array.isArray(input.anchors) ? input.anchors : [];
  const aHex = anchors[0];
  const bHex = anchors[anchors.length - 1];
  if (!aHex || !bHex) return null;

  const aRgb = parseHex(aHex);
  const bRgb = parseHex(bHex);
  if (!aRgb || !bRgb) return null;

  const a = rgbToHsl(aRgb);
  const b = rgbToHsl(bRgb);
  const steps = Math.max(2, Math.min(250, Math.round(Number(input.steps) || count)));

  const ramp: string[] = [];
  const hueDelta = shortestHueDelta(a.h, b.h);
  for (let i = 0; i < steps; i++) {
    const t = steps <= 1 ? 0 : i / (steps - 1);
    const h = a.h + hueDelta * t + randomWeighted(rng, -2.5, 2.5, 0);
    const s = a.s + (b.s - a.s) * t + randomWeighted(rng, -3, 3, 0);
    const l = a.l + (b.l - a.l) * t + randomWeighted(rng, -3, 3, 0);
    ramp.push(hslToHex(h, clamp(s, 18, 98), clamp(l, 22, 88)));
  }

  if (count <= steps) {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / Math.max(1, count - 1)) * (steps - 1));
      out.push(ramp[Math.max(0, Math.min(steps - 1, idx))]);
    }
    return out;
  }

  const out = ramp.slice();
  while (out.length < count) {
    out.push(ramp[out.length % ramp.length] ?? ramp[ramp.length - 1]);
  }
  return out;
}

/**
 * Generate a random (non-preset) but coherent color theme.
 * Produces `count` foreground colors plus a matching background color.
 */
export function generateRandomColorTheme(count: number = 5): RandomColorTheme {
  const seed = Math.floor(Math.random() * 0xffffffff);
  return generateRandomColorThemeFromSeed(seed, count);
}

export function generateRandomColorThemeFromSeed(seed: number, count: number = 5, options?: RandomColorThemeOptions): RandomColorTheme {
  const rng = createRng(seed);
  const total = Math.max(1, Math.round(Number(count) || 5));

  const baseHue = rng() * 360;
  const requestedScheme = options?.scheme ?? 'auto';

  let colors: string[];
  if (requestedScheme === 'hue-between') {
    const between = buildHueBetweenPalette({
      rng,
      count: total,
      anchors: options?.hueBetweenAnchors,
      steps: options?.hueBetweenSteps
    });
    if (between) {
      colors = between;
    } else {
      const fallbackScheme = pickScheme(rng, 'auto');
      const fallbackOffsets =
        fallbackScheme === 'analogous'
          ? [-25, -10, 0, 10, 25]
          : fallbackScheme === 'triadic'
            ? [0, 120, 240, 30, 150]
            : fallbackScheme === 'complementary'
              ? [0, 180, 12, 192, -12]
              : [0, 150, 210, 20, 170];

      const saturationBase = randomWeighted(rng, 55, 92, 75);
      const lightnessBase = randomWeighted(rng, 45, 68, 56);
      const offsets = Array.from({ length: total }, (_, i) => fallbackOffsets[i % fallbackOffsets.length]);
      colors = offsets.map((off, i) => {
        const h = baseHue + off + randomWeighted(rng, -6, 6, 0);
        const s = saturationBase + randomWeighted(rng, -10, 10, 0);
        const l = lightnessBase + randomWeighted(rng, -10, 10, 0) + (i % 2 === 0 ? 4 : -2);
        return hslToHex(h, s, l);
      });
    }
  } else {
    const scheme = pickScheme(rng, requestedScheme);
    const hueOffsets =
      scheme === 'analogous'
        ? [-25, -10, 0, 10, 25]
        : scheme === 'triadic'
          ? [0, 120, 240, 30, 150]
          : scheme === 'complementary'
            ? [0, 180, 12, 192, -12]
            : [0, 150, 210, 20, 170];

    const offsets = Array.from({ length: total }, (_, i) => hueOffsets[i % hueOffsets.length]);

    const saturationBase = randomWeighted(rng, 55, 92, 75);
    const lightnessBase = randomWeighted(rng, 45, 68, 56);

    colors = offsets.map((off, i) => {
      const h = baseHue + off + randomWeighted(rng, -6, 6, 0);
      const s = saturationBase + randomWeighted(rng, -10, 10, 0);
      // Slight stagger to avoid same-looking swatches.
      const l = lightnessBase + randomWeighted(rng, -10, 10, 0) + (i % 2 === 0 ? 4 : -2);
      return hslToHex(h, s, l);
    });
  }

  // Background: same base hue, low saturation, dark.
  const themeHue = (() => {
    const first = parseHex(colors[0] ?? '#000000');
    const last = parseHex(colors[colors.length - 1] ?? '#000000');
    if (!first && !last) return baseHue;
    if (!first) return rgbToHsl(last as Rgb).h;
    if (!last) return rgbToHsl(first).h;
    const a = rgbToHsl(first).h;
    const d = shortestHueDelta(a, rgbToHsl(last).h);
    return a + d * 0.5;
  })();

  const backgroundColor = hslToHex(
    themeHue + randomWeighted(rng, -10, 10, 0),
    randomWeighted(rng, 8, 22, 14),
    randomWeighted(rng, 6, 14, 10)
  );

  return { colors, backgroundColor };
}
