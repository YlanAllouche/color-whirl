import * as THREE from 'three';
import type { BubblesConfig } from './types.js';

type Vec3 = { x: number; y: number; z: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function fract(n: number): number {
  return n - Math.floor(n);
}

function hash1(p: Vec3): number {
  const dot = p.x * 127.1 + p.y * 311.7 + p.z * 74.7;
  return fract(Math.sin(dot) * 43758.5453123);
}

function hash3(p: Vec3): Vec3 {
  return {
    x: hash1({ x: p.x + 0.0, y: p.y + 0.0, z: p.z + 0.0 }),
    y: hash1({ x: p.x + 17.0, y: p.y + 0.0, z: p.z + 0.0 }),
    z: hash1({ x: p.x + 0.0, y: p.y + 37.0, z: p.z + 0.0 })
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function buildBubblesSeed(seed: number, offset: number): number {
  const base = (Number(seed) >>> 0) % 100000;
  return base * 0.001 + (Number.isFinite(offset) ? Number(offset) : 0);
}

export interface Bubble {
  center: THREE.Vector3;
  radius: number;
}

export interface BubblesInteriorWallOptions {
  bubbles: Bubble[];
  palette: string[];
  wallThickness: number;
  /** Optional: match bubble softness for better alignment with discard region */
  softness?: number;
  maxMeshes?: number;
  tintStrength?: number;
  opacity?: number;
}

export function buildBubbles(
  config: BubblesConfig,
  objectScale: THREE.Vector3,
  baseSeed: number,
  options?: { maxBubbles?: number; bounds?: THREE.Box3 }
): Bubble[] {
  const freqRaw = Math.max(0.000001, Number(config.frequency) || 0);
  const variance = clamp(Number(config.frequencyVariance) || 0, 0, 1);
  const freqRand = hash1({ x: baseSeed, y: baseSeed + 3.1, z: baseSeed + 7.2 });
  const freq = freqRaw * (1 + (freqRand - 0.5) * 2 * variance);
  if (freq <= 0) return [];

  const invFreq = 1 / freq;
  const radiusMin = Math.max(0, Number(config.radiusMin) || 0);
  const radiusMax = Math.max(radiusMin, Number(config.radiusMax) || 0);
  const bubbles: Array<{ cell: Vec3; center: Vec3; radius: number; priority: number }> = [];

  const scale = new THREE.Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z));
  const invScale = new THREE.Vector3(1 / scale.x, 1 / scale.y, 1 / scale.z);

  const requested = Math.max(0, Number.isFinite(options?.maxBubbles) ? Math.round(options?.maxBubbles || 0) : 0);
  const defaultLimit = Math.max(1, Math.round(Number(config.count) || 0) || 4);
  const limit = requested > 0 ? requested : defaultLimit;

  const pad = radiusMax + 0.15;
  const bounds = options?.bounds;

  // Work in unscaled (shader) space, then scale to world.
  const minUnscaled = bounds ? bounds.min.clone().multiply(invScale) : new THREE.Vector3(-1.25, -1.25, -1.25);
  const maxUnscaled = bounds ? bounds.max.clone().multiply(invScale) : new THREE.Vector3(1.25, 1.25, 1.25);

  minUnscaled.subScalar(pad);
  maxUnscaled.addScalar(pad);

  const minCell = new THREE.Vector3(
    Math.floor(minUnscaled.x * freq) - 2,
    Math.floor(minUnscaled.y * freq) - 2,
    Math.floor(minUnscaled.z * freq) - 2
  );
  const maxCell = new THREE.Vector3(
    Math.ceil(maxUnscaled.x * freq) + 2,
    Math.ceil(maxUnscaled.y * freq) + 2,
    Math.ceil(maxUnscaled.z * freq) + 2
  );

  const nx = Math.max(1, Math.round(maxCell.x - minCell.x + 1));
  const ny = Math.max(1, Math.round(maxCell.y - minCell.y + 1));
  const nz = Math.max(1, Math.round(maxCell.z - minCell.z + 1));
  const totalCells = nx * ny * nz;

  const addCell = (cell: Vec3) => {
    const jitter = hash3({ x: cell.x + baseSeed, y: cell.y + baseSeed, z: cell.z + baseSeed });
    const center: Vec3 = {
      x: (cell.x + jitter.x) * invFreq,
      y: (cell.y + jitter.y) * invFreq,
      z: (cell.z + jitter.z) * invFreq
    };

    // Tight AABB cull in unscaled space.
    if (center.x < minUnscaled.x || center.x > maxUnscaled.x) return;
    if (center.y < minUnscaled.y || center.y > maxUnscaled.y) return;
    if (center.z < minUnscaled.z || center.z > maxUnscaled.z) return;

    const radius = lerp(
      radiusMin,
      radiusMax,
      hash1({ x: cell.x + baseSeed + 13.37, y: cell.y + baseSeed + 9.91, z: cell.z + baseSeed + 2.17 })
    );
    const priority = hash1({ x: cell.x + baseSeed + 5.0, y: cell.y + baseSeed + 2.0, z: cell.z + baseSeed + 11.0 });
    bubbles.push({ cell, center, radius, priority });
  };

  if (totalCells <= 250_000) {
    for (let ix = minCell.x; ix <= maxCell.x; ix++) {
      for (let iy = minCell.y; iy <= maxCell.y; iy++) {
        for (let iz = minCell.z; iz <= maxCell.z; iz++) {
          addCell({ x: ix, y: iy, z: iz });
        }
      }
    }
  } else {
    // Sample a subset of cells deterministically when the covered region is huge.
    const sampleCount = Math.max(2000, Math.min(40_000, limit * 400));
    const seen = new Set<string>();
    for (let i = 0; i < sampleCount; i++) {
      const r = hash3({ x: baseSeed + i * 19.19, y: baseSeed + i * 7.77, z: baseSeed + i * 3.33 });
      const cx = Math.floor(lerp(minCell.x, maxCell.x + 0.999, r.x));
      const cy = Math.floor(lerp(minCell.y, maxCell.y + 0.999, r.y));
      const cz = Math.floor(lerp(minCell.z, maxCell.z + 0.999, r.z));
      const key = `${cx},${cy},${cz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addCell({ x: cx, y: cy, z: cz });
    }
  }

  bubbles.sort((a, b) => a.priority - b.priority);
  const selected = bubbles.slice(0, Math.max(1, Math.min(bubbles.length, limit)));

  const minScale = Math.min(scale.x, scale.y, scale.z);
  return selected.map((b) => ({
    center: new THREE.Vector3(b.center.x * scale.x, b.center.y * scale.y, b.center.z * scale.z),
    radius: b.radius * minScale
  }));
}

export function buildBubblesInteriorWalls(options: BubblesInteriorWallOptions): THREE.Group | null {
  const walls = new THREE.Group();
  const thickness = Math.max(0, options.wallThickness || 0);
  if (thickness <= 1e-6) return null;

  const softness = Math.max(0, Number(options.softness) || 0);

  const bubbles = options.bubbles ?? [];
  if (bubbles.length === 0) return null;

  const palette = options.palette && options.palette.length > 0 ? options.palette : ['#ffffff'];
  const tintStrength = clamp(Number(options.tintStrength) || 0.0, 0, 1);
  const opacity = clamp(Number(options.opacity) || 0.9, 0, 1);

  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const materials = palette.map((hex) => {
    const baseColor = new THREE.Color(hex);
    const inverted = new THREE.Color(1 - baseColor.r, 1 - baseColor.g, 1 - baseColor.b);
    const darkBase = new THREE.Color(0.03, 0.03, 0.05);
    const invertedBlend = baseColor.clone().lerp(inverted, 0.2 + 0.25 * tintStrength);
    const finalColor = invertedBlend.clone().lerp(darkBase, clamp(0.55 + 0.35 * tintStrength, 0, 1));
    return new THREE.MeshStandardMaterial({
      color: finalColor,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: opacity < 1,
      opacity,
      depthWrite: false
    });
  });

  const maxMeshes = Math.max(1, Math.min(bubbles.length, Math.round(Math.max(0, options.maxMeshes || 0)) || bubbles.length));
  let placed = 0;
  for (let i = 0; i < bubbles.length && placed < maxMeshes; i++) {
    const bubble = bubbles[i];
    // The shader starts fading/discarding only once depth > wallThickness (+ softness).
    // Place interior geometry near that boundary so it becomes visible through the carved region.
    const radius = Math.max(0.01, bubble.radius - thickness - softness);
    if (radius <= 0) continue;

    const mat = materials[placed % materials.length];
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.scale.setScalar(radius);
    mesh.position.copy(bubble.center);
    mesh.renderOrder = 1;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    walls.add(mesh);
    placed++;
  }

  if (walls.children.length === 0) return null;
  return walls;
}
