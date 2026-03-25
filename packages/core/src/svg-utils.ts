export const MAX_SVG_SOURCE_LENGTH = 100_000;

export function validateSvgSource(input: unknown): string {
  const source = typeof input === 'string' ? input : '';
  const s = source.trim();

  if (!s) {
    throw new Error('Invalid SVG: missing source');
  }
  if (s.length > MAX_SVG_SOURCE_LENGTH) {
    throw new Error(`Invalid SVG: source too large (max ${MAX_SVG_SOURCE_LENGTH} chars)`);
  }

  const lower = s.toLowerCase();
  if (!lower.includes('<svg')) {
    throw new Error('Invalid SVG: missing <svg> root element');
  }

  // Basic abuse prevention. This is intentionally conservative.
  if (lower.includes('<script')) {
    throw new Error('Invalid SVG: <script> is not allowed');
  }

  // Reject inline event handlers like onload=, onclick=, etc.
  // Note: whitespace + quoting variants.
  const onAttr = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;
  if (onAttr.test(s)) {
    throw new Error('Invalid SVG: event handler attributes (on*) are not allowed');
  }

  // Extra: reject javascript: URLs.
  const jsUrl = /\bjavascript\s*:/i;
  if (jsUrl.test(s)) {
    throw new Error('Invalid SVG: javascript: URLs are not allowed');
  }

  return s;
}

export function extractSvgRootAttributes(svgSource: string): {
  viewBox: { minX: number; minY: number; width: number; height: number };
  inner: string;
} {
  const s = validateSvgSource(svgSource);

  const open = /<svg\b[^>]*>/i.exec(s);
  const closeIdx = s.toLowerCase().lastIndexOf('</svg>');
  if (!open || closeIdx < 0) {
    throw new Error('Invalid SVG: could not find <svg> ... </svg>');
  }

  const openTag = open[0];
  const inner = s.slice(open.index + openTag.length, closeIdx);

  const viewBoxMatch = /\bviewbox\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(openTag);
  const parseNums = (txt: string): number[] =>
    txt
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .split(/[\s,]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));

  let minX = 0;
  let minY = 0;
  let width = 24;
  let height = 24;

  if (viewBoxMatch) {
    const nums = parseNums(viewBoxMatch[1] ?? '');
    if (nums.length >= 4) {
      minX = nums[0];
      minY = nums[1];
      width = nums[2] > 0 ? nums[2] : width;
      height = nums[3] > 0 ? nums[3] : height;
    }
  } else {
    const wMatch = /\bwidth\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(openTag);
    const hMatch = /\bheight\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(openTag);
    const parseSize = (m: RegExpExecArray | null, fallback: number): number => {
      if (!m) return fallback;
      const raw = String(m[1] ?? '').replace(/^['"]|['"]$/g, '');
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    width = parseSize(wMatch, width);
    height = parseSize(hMatch, height);
  }

  return { viewBox: { minX, minY, width, height }, inner };
}

export function stripSvgPresentationAttributes(svgInner: string): string {
  // Allow our generated wrapper to control fill/stroke/opacity.
  // This is best-effort and intentionally shallow.
  let s = svgInner;
  s = s.replace(/\s(fill|stroke|opacity|fill-opacity|stroke-opacity)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s(style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return s;
}

export function inferSvgRenderMode(svgSource: string): 'fill' | 'stroke' | 'fill+stroke' {
  const s = validateSvgSource(svgSource);
  const open = /<svg\b[^>]*>/i.exec(s);
  const openTag = open?.[0] ?? '';

  const extractAttrValues = (name: string, haystack: string): string[] => {
    const re = new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'gi');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack))) {
      const raw = String(m[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
      if (!raw) continue;
      out.push(raw);
    }
    return out;
  };

  const normalize = (v: string) => v.trim().toLowerCase();

  // Prefer root-level hints (common in icon sets like Lucide).
  const rootFill = extractAttrValues('fill', openTag).map(normalize);
  const rootStroke = extractAttrValues('stroke', openTag).map(normalize);

  const rootFillNone = rootFill.includes('none');
  const rootHasStroke = rootStroke.some((v) => v !== 'none');

  if (rootFillNone && rootHasStroke) return 'stroke';

  // Broader scan: any explicit fill/stroke present in the SVG.
  const fillVals = extractAttrValues('fill', s).map(normalize);
  const strokeVals = extractAttrValues('stroke', s).map(normalize);

  const hasFill = fillVals.some((v) => v !== 'none') || /\bfill\s*=\s*(['"])url\(/i.test(s) || /\bfill\s*:\s*url\(/i.test(s);
  const hasStroke = strokeVals.some((v) => v !== 'none');

  if (hasFill && hasStroke) return 'fill+stroke';
  if (hasStroke && !hasFill) return 'stroke';
  if (hasFill && !hasStroke) return 'fill';

  // Fallback: try to show something for unknown/unstyled SVGs.
  return 'stroke';
}
