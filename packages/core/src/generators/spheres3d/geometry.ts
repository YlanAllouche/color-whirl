import * as THREE from 'three';
import type { Spheres3DConfig } from '../../types.js';
import { clamp, clamp01 } from './utils.js';

export function getSpheres3DGeometry(config: Spheres3DConfig): { geometry: THREE.BufferGeometry; flatShading: boolean } {
  const rawShape = (config.spheres as any)?.shape as any;
  const kind = rawShape?.kind === 'spherifiedBox' ? 'spherifiedBox' : rawShape?.kind === 'geodesicPoly' ? 'geodesicPoly' : 'uvSphere';

  if (kind === 'uvSphere') {
    const seg = Math.round(8 + clamp(config.geometry.quality, 0, 1) * 48);
    const geometry = new THREE.SphereGeometry(1, seg, seg);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, flatShading: false };
  }

  const roundness = clamp01(Number(rawShape?.roundness ?? 1));
  const faceting = clamp01(Number(rawShape?.faceting ?? 0));
  const quality = clamp01(Number(config.geometry.quality ?? 0.6));

  if (kind === 'geodesicPoly') {
    const detailMax = Math.max(1, Math.round(1 + quality * 4));
    const detail = Math.max(0, Math.min(detailMax, Math.round(roundness * detailMax)));
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const flatShading = faceting > 0.6 || detail === 0;
    return { geometry, flatShading };
  }

  // faceting=1 -> cube-ish (few segments). faceting=0 -> smoother (more segments).
  const segMax = Math.round(3 + quality * 18); // 3..21
  const segMin = 1;
  const seg = Math.max(segMin, Math.round(segMin + (1 - faceting) * (segMax - segMin)));

  // Use an inscribed cube so the bounding radius stays ~1 when roundness=0.
  const size = 2 / Math.sqrt(3);
  const geometry = new THREE.BoxGeometry(size, size, size, seg, seg, seg);

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const t = roundness;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    if (!(len > 1e-12)) continue;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    const sx = x + (nx - x) * t;
    const sy = y + (ny - y) * t;
    const sz = z + (nz - z) * t;
    pos.setXYZ(i, sx, sy, sz);
  }
  pos.needsUpdate = true;

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const flatShading = faceting > 0.6 || seg <= 2;
  return { geometry, flatShading };
}
