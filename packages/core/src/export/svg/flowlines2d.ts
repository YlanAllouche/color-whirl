import type { WallpaperConfig } from '../../types.js';
import { buildFlowlines2D } from '../../generators/flowlines2d.js';
import { clamp01, svgEnd, svgStart } from './utils.js';

export function generateFlowlines2DSVG(config: Extract<WallpaperConfig, { type: 'flowlines2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const palette = colors.length > 0 ? colors : ['#ffffff'];

  const flow: any = (config as any).flowlines ?? {};
  const strokeW = Math.max(0.05, Number(flow.stroke?.widthPx) || 1);
  const strokeOpacity = clamp01(Number(flow.stroke?.opacity) || 0);

  let svg = svgStart(width, height, backgroundColor);
  if (!(strokeOpacity > 0) || !(strokeW > 0)) {
    svg += svgEnd();
    return svg;
  }

  const instances = buildFlowlines2D(config as any);
  for (const inst of instances) {
    const pts = inst.points;
    if (!pts || pts.length < 2) continue;
    const col = palette[inst.colorIndex % palette.length] ?? '#ffffff';
    const d = 'M ' + pts.map((p, i) => `${i === 0 ? '' : 'L '}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ');
    svg += `  <path d="${d}" fill="none" stroke="${col}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity.toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
  }
  svg += svgEnd();
  return svg;
}
