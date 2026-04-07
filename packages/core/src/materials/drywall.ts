import * as THREE from 'three';
import { createRng } from '../types.js';
import { clamp } from './utils.js';

export type DrywallMaps = { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture };

const drywallCache = new Map<string, DrywallMaps>();

export function createDrywallMaps(seed: number, grainAmount: number): DrywallMaps {
  const amt = clamp(grainAmount, 0, 1);
  const key = `${seed >>> 0}:${amt.toFixed(3)}`;
  const existing = drywallCache.get(key);
  if (existing) return existing;

  const rng = createRng((seed ^ 0xA3C59AC3) >>> 0);

  const size = 256;
  const gridSize = 64;
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const smoothstep = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const sampleGrid = (u: number, v: number): number => {
    const x = u * gridSize;
    const y = v * gridSize;
    const x0 = Math.floor(x) % gridSize;
    const y0 = Math.floor(y) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;
    const tx = smoothstep(x - Math.floor(x));
    const ty = smoothstep(y - Math.floor(y));
    const g00 = grid[y0 * gridSize + x0];
    const g10 = grid[y0 * gridSize + x1];
    const g01 = grid[y1 * gridSize + x0];
    const g11 = grid[y1 * gridSize + x1];
    return lerp(lerp(g00, g10, tx), lerp(g01, g11, tx), ty);
  };

  const heightAt = (u: number, v: number): number => {
    // Orange-peel-ish: a couple low/mid octaves plus a small high-frequency grit.
    let h = 0;
    let amp = 1;
    let freq = 1;
    for (let o = 0; o < 4; o++) {
      h += amp * sampleGrid(u * freq, v * freq);
      amp *= 0.55;
      freq *= 2.05;
    }
    const grit = sampleGrid(u * 10.0, v * 10.0);
    h = h * 0.82 + grit * 0.18;
    return h;
  };

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      height[y * size + x] = heightAt(u, v);
    }
  }

  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const strength = 0.65 + amt * 2.35;

  const idx = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height[idx(x - 1, y)];
      const hR = height[idx(x + 1, y)];
      const hD = height[idx(x, y - 1)];
      const hU = height[idx(x, y + 1)];

      const dx = (hR - hL) * 0.5;
      const dy = (hU - hD) * 0.5;

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      const i = (y * size + x) * 4;
      normalData[i + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[i + 3] = 255;

      const h = height[y * size + x];
      const r = clamp(0.35 + (0.55 + amt * 0.35) * h, 0, 1);
      const rv = Math.round(r * 255);
      roughData[i + 0] = rv;
      roughData[i + 1] = rv;
      roughData[i + 2] = rv;
      roughData[i + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.needsUpdate = true;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.needsUpdate = true;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const maps: DrywallMaps = { normalMap, roughnessMap };
  drywallCache.set(key, maps);
  return maps;
}
