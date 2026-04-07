import * as THREE from 'three';
import { clamp } from './utils.js';

export function createBulgedPrismGeometry(options: {
  base: 'prism' | 'pyramidTri' | 'pyramidSquare';
  wallBulgeX: number;
  wallBulgeY: number;
  taper: number;
  curveSegments: number;
}): THREE.BufferGeometry {
  const base = options.base;
  const bulgeX = clamp(Number(options.wallBulgeX) || 0, -1, 1);
  const bulgeY = clamp(Number(options.wallBulgeY) || 0, -1, 1);
  const taper = clamp(Number(options.taper) || 1, 0, 1);
  const curveSegments = Math.max(2, Math.round(Number(options.curveSegments) || 2));

  const isPyramid = base === 'pyramidTri' || base === 'pyramidSquare';

  if (isPyramid) {
    const radialSegments = base === 'pyramidTri' ? 3 : 4;
    const geom = new THREE.ConeGeometry(1, 1, radialSegments, 1);

    // ConeGeometry apex at +0.5, base at -0.5; rotate to match CylinderGeometry
    geom.rotateY(Math.PI);

    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    geom.computeVertexNormals();
    return geom;
  }

  const isSquareBase = base === 'prism';
  const r = 1;
  const v: THREE.Vector2[] = [];

  if (isSquareBase) {
    const a = r / Math.SQRT2;
    v.push(new THREE.Vector2(a, a), new THREE.Vector2(-a, a), new THREE.Vector2(-a, -a), new THREE.Vector2(a, -a));
  } else {
    const a0 = Math.PI / 6;
    const angles = [a0, a0 + (2 * Math.PI) / 3, a0 + (4 * Math.PI) / 3];
    for (const a of angles) v.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }

  const shape = new THREE.Shape();
  shape.moveTo(v[0].x, v[0].y);

  const ctrlScale = 0.35;
  const sides = v.length;
  for (let i = 0; i < sides; i++) {
    const a = v[i];
    const b = v[(i + 1) % sides];
    const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
    const edge = new THREE.Vector2().subVectors(b, a);
    let n = new THREE.Vector2(-edge.y, edge.x);
    const len = Math.hypot(n.x, n.y) || 1;
    n.multiplyScalar(1 / len);

    if (n.dot(mid) < 0) n.multiplyScalar(-1);

    const axisBulge = bulgeX * Math.abs(n.x) + bulgeY * Math.abs(n.y);
    if (Math.abs(axisBulge) < 1e-6) {
      shape.lineTo(b.x, b.y);
    } else {
      const ctrl = mid.clone().addScaledVector(n, axisBulge * ctrlScale);
      shape.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
    }
  }
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    steps: 1,
    curveSegments,
    bevelEnabled: false
  });

  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -0.5, 0);

  if (taper < 0.999999) {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = clamp(y + 0.5, 0, 1);
      const s = 1 - (1 - taper) * t;
      pos.setXYZ(i, x * s, y, z * s);
    }
    pos.needsUpdate = true;
  }

  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  geom.computeVertexNormals();
  return geom;
}
