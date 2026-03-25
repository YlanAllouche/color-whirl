import * as THREE from 'three';

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

import { validateSvgSource } from './svg-utils.js';

type Point = { x: number; y: number };

export type SvgToneLayer2D = {
  fillPath: Path2D;
  strokePath: Path2D;
};

export type SvgToneGeometry3D = {
  geometry: THREE.BufferGeometry;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type ParsedPath = {
  fillTone: number;
  strokeTone: number;
  points: Point[][];
  closedPoints: Point[][];
  shapes: THREE.Shape[];
  bounds: Bounds | null;
  area: number;
};

type ToneBucket = {
  score: number;
  fillPts: Point[][];
  strokePts: Point[][];
  shapes: THREE.Shape[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function srgbToLinear(v: number): number {
  const x = clamp01(v / 255);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function luminanceFromRgb(r: number, g: number, b: number): number {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = clamp01(r / 255);
  const gn = clamp01(g / 255);
  const bn = clamp01(b / 255);
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) * 0.5;
  const d = max - min;
  if (d <= 1e-6) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h / 6) * 360, s, l };
}

function toneFromColor(input: unknown): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'none' || lower === 'transparent' || lower.includes('url(') || lower === 'currentcolor') return null;

  const c = new THREE.Color();
  try {
    c.setStyle(raw);
  } catch {
    return null;
  }

  const r = Math.round(clamp01(c.r) * 255);
  const g = Math.round(clamp01(c.g) * 255);
  const b = Math.round(clamp01(c.b) * 255);
  const lum = luminanceFromRgb(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const chromaWeight = 0.12 * hsl.s * Math.cos((hsl.h * Math.PI) / 180);
  return clamp01(lum + chromaWeight);
}

function createEmptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function expandBounds(target: Bounds, x: number, y: number): void {
  if (x < target.minX) target.minX = x;
  if (x > target.maxX) target.maxX = x;
  if (y < target.minY) target.minY = y;
  if (y > target.maxY) target.maxY = y;
}

function mergeBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

function isFiniteBounds(b: Bounds | null): b is Bounds {
  return !!b && Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.maxX) && Number.isFinite(b.maxY);
}

function pathAreaEstimate(bounds: Bounds | null, closedPoints: Point[][], shapes: THREE.Shape[]): number {
  let total = 0;
  for (const s of shapes) {
    try {
      total += Math.abs(THREE.ShapeUtils.area(s.getPoints(48)));
      for (const hole of s.holes ?? []) total -= Math.abs(THREE.ShapeUtils.area(hole.getPoints(48)));
    } catch {
      // Ignore malformed shape area estimates.
    }
  }
  if (total > 0) return total;
  for (const pts of closedPoints) {
    if (pts.length < 3) continue;
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      acc += a.x * b.y - b.x * a.y;
    }
    total += Math.abs(acc) * 0.5;
  }
  if (total > 0) return total;
  if (!isFiniteBounds(bounds)) return 1;
  return Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
}

function mergeCloseTones(entries: Array<{ tone: number; weight: number }>, maxTones: number): number[] {
  if (entries.length === 0) return [0.5];
  const sorted = entries
    .filter((e) => Number.isFinite(e.tone) && Number.isFinite(e.weight) && e.weight > 0)
    .sort((a, b) => a.tone - b.tone)
    .map((e) => ({ tone: clamp01(e.tone), weight: e.weight }));
  if (sorted.length === 0) return [0.5];

  const merged: Array<{ tone: number; weight: number }> = [];
  const threshold = 0.045;
  for (const entry of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.tone - entry.tone) <= threshold) {
      const nextWeight = prev.weight + entry.weight;
      prev.tone = (prev.tone * prev.weight + entry.tone * entry.weight) / nextWeight;
      prev.weight = nextWeight;
    } else {
      merged.push({ ...entry });
    }
  }

  while (merged.length > maxTones) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < merged.length - 1; i++) {
      const a = merged[i];
      const b = merged[i + 1];
      const gap = Math.abs(a.tone - b.tone);
      const harmonic = (a.weight * b.weight) / Math.max(1e-9, a.weight + b.weight);
      const cost = gap * harmonic;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const a = merged[bestIdx];
    const b = merged[bestIdx + 1];
    const nextWeight = a.weight + b.weight;
    merged.splice(bestIdx, 2, { tone: (a.tone * a.weight + b.tone * b.weight) / nextWeight, weight: nextWeight });
  }

  return merged.map((e) => e.tone).sort((a, b) => a - b);
}

function nearestToneIndex(tone: number, centers: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const d = Math.abs(tone - centers[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function parseSvgPaths(svgSource: string): { paths: ParsedPath[]; bounds: Bounds } {
  const source = validateSvgSource(svgSource);
  let data: any;
  try {
    const loader = new SVGLoader();
    data = loader.parse(source);
  } catch (err: any) {
    throw new Error(`Invalid SVG: failed to parse (${String(err?.message || err)})`);
  }

  const globalBounds = createEmptyBounds();
  const parsed: ParsedPath[] = [];

  for (const p of data?.paths ?? []) {
    const style = (p as any)?.userData?.style ?? {};
    const fillTone = toneFromColor(style.fill);
    const strokeTone = toneFromColor(style.stroke);

    const subPaths = (p as any)?.subPaths ?? [];
    const points: Point[][] = [];
    const closedPoints: Point[][] = [];
    let localBounds: Bounds | null = null;

    for (const sp of subPaths) {
      const pts = (sp as any).getPoints ? (sp as any).getPoints(80) : [];
      if (!pts || pts.length < 2) continue;
      const arr: Point[] = [];
      let subBounds = createEmptyBounds();
      for (const v of pts) {
        const x = Number(v?.x);
        const y = Number(v?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        arr.push({ x, y });
        expandBounds(subBounds, x, y);
        expandBounds(globalBounds, x, y);
      }
      if (arr.length < 2 || !isFiniteBounds(subBounds)) continue;
      points.push(arr);
      localBounds = mergeBounds(localBounds, subBounds);

      const dx = arr[arr.length - 1].x - arr[0].x;
      const dy = arr[arr.length - 1].y - arr[0].y;
      const maxDim = Math.max(1e-9, subBounds.maxX - subBounds.minX, subBounds.maxY - subBounds.minY);
      const eps2 = Math.pow(maxDim * 0.0015, 2);
      if (dx * dx + dy * dy <= eps2) closedPoints.push(arr);
    }

    let shapes: THREE.Shape[] = [];
    try {
      shapes = SVGLoader.createShapes(p as any);
    } catch {
      shapes = [];
    }

    if (points.length === 0 && shapes.length === 0) continue;
    const bounds = localBounds;
    const area = pathAreaEstimate(bounds, closedPoints, shapes);
    parsed.push({
      fillTone: fillTone ?? strokeTone ?? 0.5,
      strokeTone: strokeTone ?? fillTone ?? 0.5,
      points,
      closedPoints,
      shapes,
      bounds,
      area
    });
  }

  if (!isFiniteBounds(globalBounds) || parsed.length === 0) {
    throw new Error('Invalid SVG: no drawable paths found');
  }

  return { paths: parsed, bounds: globalBounds };
}

function makeToneBuckets(paths: ParsedPath[], maxTones: number): ToneBucket[] {
  const cap = Math.max(1, Math.min(64, Math.round(Number(maxTones) || 8)));
  const weightedTones: Array<{ tone: number; weight: number }> = [];
  for (const path of paths) {
    if (path.closedPoints.length > 0 || path.shapes.length > 0) weightedTones.push({ tone: path.fillTone, weight: path.area * 1.2 });
    if (path.points.length > 0) weightedTones.push({ tone: path.strokeTone, weight: Math.max(1, path.area * 0.8) });
  }
  const centers = mergeCloseTones(weightedTones, cap);
  const buckets: ToneBucket[] = centers.map((tone) => ({ score: tone, fillPts: [], strokePts: [], shapes: [] }));

  for (const path of paths) {
    const fillIdx = nearestToneIndex(path.fillTone, centers);
    const strokeIdx = nearestToneIndex(path.strokeTone, centers);
    for (const pts of path.closedPoints) buckets[fillIdx].fillPts.push(pts);
    for (const pts of path.points) buckets[strokeIdx].strokePts.push(pts);
    for (const s of path.shapes) buckets[fillIdx].shapes.push(s);
  }

  return buckets;
}

function normalizePoint(point: Point, bounds: Bounds): Point {
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cy = (bounds.minY + bounds.maxY) * 0.5;
  const maxDim = Math.max(1e-9, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  return { x: (point.x - cx) / maxDim, y: (point.y - cy) / maxDim };
}

export function extractSvgToneLayers2D(svgSource: string, maxTones: number): SvgToneLayer2D[] {
  const { paths, bounds } = parseSvgPaths(svgSource);
  const buckets = makeToneBuckets(paths, maxTones);
  const layers: SvgToneLayer2D[] = [];

  for (const bucket of buckets) {
    const fillPath = new Path2D();
    const strokePath = new Path2D();

    for (const pts of bucket.strokePts) {
      const p0 = normalizePoint(pts[0], bounds);
      strokePath.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normalizePoint(pts[i], bounds);
        strokePath.lineTo(p.x, p.y);
      }
    }

    for (const pts of bucket.fillPts) {
      const p0 = normalizePoint(pts[0], bounds);
      fillPath.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normalizePoint(pts[i], bounds);
        fillPath.lineTo(p.x, p.y);
      }
      fillPath.closePath();
    }

    layers.push({ fillPath, strokePath });
  }

  return layers;
}

export function extractSvgToneGeometries3D(
  svgSource: string,
  maxTones: number,
  options: { curveSegments: number; bevelEnabled: boolean; bevelSizeNorm: number; bevelSegments: number; depthScene: number }
): SvgToneGeometry3D[] {
  const { paths, bounds } = parseSvgPaths(svgSource);
  const buckets = makeToneBuckets(paths, maxTones);
  const width = Math.max(1e-9, bounds.maxX - bounds.minX);
  const height = Math.max(1e-9, bounds.maxY - bounds.minY);
  const maxDim = Math.max(width, height);
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cy = (bounds.minY + bounds.maxY) * 0.5;
  const depthSvg = Math.max(0.000001, options.depthScene) * maxDim;
  const bevelSvg = options.bevelEnabled ? clamp(options.bevelSizeNorm, 0, 0.2) * maxDim : 0;
  const scale = 1 / Math.max(1e-9, maxDim);

  const out: SvgToneGeometry3D[] = [];
  for (const bucket of buckets) {
    if (bucket.shapes.length === 0) continue;
    const geom = new THREE.ExtrudeGeometry(bucket.shapes, {
      depth: depthSvg,
      bevelEnabled: options.bevelEnabled && bevelSvg > 0 && options.bevelSegments > 0,
      bevelSize: bevelSvg,
      bevelThickness: bevelSvg,
      bevelSegments: Math.max(1, options.bevelSegments),
      curveSegments: Math.max(1, Math.round(options.curveSegments)),
      steps: 1
    });
    geom.applyMatrix4(new THREE.Matrix4().makeTranslation(-cx, -cy, -depthSvg * 0.5));
    geom.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    out.push({ geometry: geom });
  }

  if (out.length === 0) {
    throw new Error('Invalid SVG: no closed shapes found to extrude');
  }

  return out;
}
