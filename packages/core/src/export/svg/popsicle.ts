import type { WallpaperConfig } from '../../types.js';
import { svgEnd, svgStart } from './utils.js';

export function generatePopsicleSVG(config: Extract<WallpaperConfig, { type: 'popsicle' }>): string {
  const { width, height, colors, backgroundColor, stickCount, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY } = config;
  const opacityValue = Number(config.stickOpacity);
  const stickOpacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1;

  const palette = colors.length > 0 ? colors : ['#ffffff'];

  const safeSize = Math.max(0.01, Number.isFinite(Number(config.stickSize)) ? Number(config.stickSize) : 1.0);
  const safeRatio = Math.max(0.05, Number.isFinite(Number(config.stickRatio)) ? Number(config.stickRatio) : 3.0);

  const baseStickWidth = width * 0.15 * safeSize;
  const baseStickHeight = height * 0.8 * safeSize;
  const area = baseStickWidth * baseStickHeight;
  const stickWidth = Math.sqrt(area / safeRatio);
  const stickHeight = Math.sqrt(area * safeRatio);

  let svg = svgStart(width, height, backgroundColor);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < stickCount; i++) {
    const color = palette[i % palette.length];
    let x = centerX;
    let y = centerY;

    const rotationAngle = (i * stickOverhang * Math.PI) / 180;
    const offsetXPercent = rotationCenterOffsetX / 100;
    const offsetYPercent = rotationCenterOffsetY / 100;
    const pivotX = offsetXPercent * (stickWidth / 2);
    const pivotY = offsetYPercent * (stickHeight / 2);
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    const offsetX = pivotX * (1 - cos) + pivotY * sin;
    const offsetY = pivotY * (1 - cos) - pivotX * sin;

    x += offsetX;
    y += offsetY;
    const rotation = (rotationAngle * 180) / Math.PI;

    const profile =
      (config as any).stickEndProfile === 'chamfer' || (config as any).stickEndProfile === 'chipped'
        ? (config as any).stickEndProfile
        : 'rounded';
    const maxRadius = Math.min(stickWidth, stickHeight) / 2;
    const r = maxRadius * Math.max(0, Math.min(1, Number((config as any).stickRoundness) || 0));

    if (profile === 'rounded' || r <= 0) {
      svg += `  <rect x="${x - stickWidth / 2}" y="${y - stickHeight / 2}" width="${stickWidth}" height="${stickHeight}" rx="${r}" ry="${r}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>\n`;
      continue;
    }

    const chipAmount = Math.max(0, Math.min(1, Number((config as any).stickChipAmount) || 0));
    const chipJag = Math.max(0, Math.min(1, Number((config as any).stickChipJaggedness) || 0));
    const x0 = x - stickWidth / 2;
    const y0 = y - stickHeight / 2;
    const c = r;

    const rng = (() => {
      let t = (((config.seed >>> 0) || 1) ^ 0x9e3779b9) >>> 0;
      return () => {
        t += 0x6d2b79f5;
        let xx = Math.imul(t ^ (t >>> 15), 1 | t);
        xx ^= xx + Math.imul(xx ^ (xx >>> 7), 61 | xx);
        return ((xx ^ (xx >>> 14)) >>> 0) / 4294967296;
      };
    })();

    const pts: Array<[number, number]> = [];
    const push = (px: number, py: number) => pts.push([px, py]);
    const addChippedCorner = (fromX: number, fromY: number, toX: number, toY: number, inwardX: number, inwardY: number) => {
      if (profile !== 'chipped' || chipAmount <= 0) return;
      const segBase = 2 + Math.round(chipJag * 6);
      const segs = Math.max(2, Math.min(10, segBase));
      const invLen = 1 / Math.max(1e-6, Math.hypot(inwardX, inwardY));
      const ix = inwardX * invLen;
      const iy = inwardY * invLen;
      for (let si = 1; si < segs; si++) {
        const tt = si / segs;
        const bx = fromX + (toX - fromX) * tt;
        const by = fromY + (toY - fromY) * tt;
        const jitter = (rng() - 0.5) * 2;
        const amt = chipAmount * c * (0.25 + 0.55 * chipJag) * (0.35 + 0.65 * Math.abs(jitter));
        push(bx + ix * amt, by + iy * amt);
      }
    };

    push(x0 + c, y0);
    push(x0 + stickWidth - c, y0);
    addChippedCorner(x0 + stickWidth - c, y0, x0 + stickWidth, y0 + c, -1, 1);
    push(x0 + stickWidth, y0 + c);
    push(x0 + stickWidth, y0 + stickHeight - c);
    addChippedCorner(x0 + stickWidth, y0 + stickHeight - c, x0 + stickWidth - c, y0 + stickHeight, -1, -1);
    push(x0 + stickWidth - c, y0 + stickHeight);
    push(x0 + c, y0 + stickHeight);
    addChippedCorner(x0 + c, y0 + stickHeight, x0, y0 + stickHeight - c, 1, -1);
    push(x0, y0 + stickHeight - c);
    push(x0, y0 + c);
    addChippedCorner(x0, y0 + c, x0 + c, y0, 1, 1);
    push(x0 + c, y0);

    const d =
      'M ' +
      pts
        .map(([px, py], idx) => {
          const cmd = idx === 0 ? '' : 'L ';
          return `${cmd}${px.toFixed(3)} ${py.toFixed(3)}`;
        })
        .join(' ') +
      ' Z';

    svg += `  <path d="${d}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>\n`;
  }

  svg += svgEnd();
  return svg;
}
