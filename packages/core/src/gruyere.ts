import * as THREE from 'three';
import type { GruyereConfig } from './types.js';

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

export function buildGruyereSeed(seed: number, offset: number): number {
  const base = (Number(seed) >>> 0) % 100000;
  return base * 0.001 + (Number.isFinite(offset) ? Number(offset) : 0);
}

export interface GruyereHole {
  center: THREE.Vector3;
  radius: number;
}

export interface GruyereInteriorWallOptions {
  holes: GruyereHole[];
  palette: string[];
  wallThickness: number;
  maxMeshes?: number;
  tintStrength?: number;
  opacity?: number;
}

export function buildGruyereHoles(
  config: GruyereConfig,
  objectScale: THREE.Vector3,
  baseSeed: number,
  maxHoles?: number
): GruyereHole[] {
  const freqRaw = Math.max(0.000001, Number(config.frequency) || 0);
  const variance = clamp(Number(config.frequencyVariance) || 0, 0, 1);
  const freqRand = hash1({ x: baseSeed, y: baseSeed + 3.1, z: baseSeed + 7.2 });
  const freq = freqRaw * (1 + (freqRand - 0.5) * 2 * variance);
  if (freq <= 0) return [];

  const invFreq = 1 / freq;
  const gridRadius = Math.max(1, Math.round(freq)) + 2;
  const radiusMin = Math.max(0, Number(config.radiusMin) || 0);
  const radiusMax = Math.max(radiusMin, Number(config.radiusMax) || 0);
  const holes: Array<{ center: Vec3; radius: number; priority: number }> = [];

  for (let ix = -gridRadius; ix <= gridRadius; ix++) {
    for (let iy = -gridRadius; iy <= gridRadius; iy++) {
      for (let iz = -gridRadius; iz <= gridRadius; iz++) {
        const cell = { x: ix, y: iy, z: iz };
        const jitter = hash3({ x: cell.x + baseSeed, y: cell.y + baseSeed, z: cell.z + baseSeed });
        const center: Vec3 = {
          x: (cell.x + jitter.x) * invFreq,
          y: (cell.y + jitter.y) * invFreq,
          z: (cell.z + jitter.z) * invFreq
        };

        const limit = 1.1 + radiusMax;
        if (Math.abs(center.x) > limit || Math.abs(center.y) > limit || Math.abs(center.z) > limit) continue;

        const radius = lerp(
          radiusMin,
          radiusMax,
          hash1({ x: cell.x + baseSeed + 13.37, y: cell.y + baseSeed + 9.91, z: cell.z + baseSeed + 2.17 })
        );
        const priority = hash1({ x: cell.x + baseSeed + 5.0, y: cell.y + baseSeed + 2.0, z: cell.z + baseSeed + 11.0 });
        holes.push({ center, radius, priority });
      }
    }
  }

  holes.sort((a, b) => a.priority - b.priority);
  const requested = Math.max(0, Number.isFinite(maxHoles) ? Math.round(maxHoles || 0) : 0);
  const defaultLimit = Math.max(1, Math.round(Number(config.count) || 0) || 4);
  const limit = Math.max(1, Math.min(holes.length, requested > 0 ? requested : defaultLimit));
  const selected = holes.slice(0, limit);

  const scale = new THREE.Vector3(Math.max(1e-6, objectScale.x), Math.max(1e-6, objectScale.y), Math.max(1e-6, objectScale.z));
  const minScale = Math.min(scale.x, scale.y, scale.z);

  return selected.map((h) => ({
    center: new THREE.Vector3(h.center.x * scale.x, h.center.y * scale.y, h.center.z * scale.z),
    radius: h.radius * minScale
  }));
}

export function buildGruyereInteriorWalls(options: GruyereInteriorWallOptions): THREE.Group | null {
  const walls = new THREE.Group();
  const thickness = Math.max(0, options.wallThickness || 0);
  if (thickness <= 1e-6) return null;

  const holes = options.holes ?? [];
  if (holes.length === 0) return null;

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

  const maxMeshes = Math.max(1, Math.min(holes.length, Math.round(Math.max(0, options.maxMeshes || 0)) || holes.length));
  let placed = 0;
  for (let i = 0; i < holes.length && placed < maxMeshes; i++) {
    const hole = holes[i];
    const radius = Math.max(0.01, hole.radius - thickness * 0.5);
    if (radius <= 0) continue;

    const mat = materials[placed % materials.length];
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.scale.setScalar(radius);
    mesh.position.copy(hole.center);
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
