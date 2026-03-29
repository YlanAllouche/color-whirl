import * as THREE from 'three';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function subdivideGeometry(geoIn: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
  let geo = geoIn.toNonIndexed();
  const iters = Math.max(0, Math.min(3, Math.round(Number(iterations) || 0)));
  for (let it = 0; it < iters; it++) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;

    const nextPos: number[] = [];
    const nextNor: number[] = [];
    const nextUv: number[] = [];

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const n0 = new THREE.Vector3();
    const n1 = new THREE.Vector3();
    const n2 = new THREE.Vector3();
    const u0 = new THREE.Vector2();
    const u1 = new THREE.Vector2();
    const u2 = new THREE.Vector2();

    const v01 = new THREE.Vector3();
    const v12 = new THREE.Vector3();
    const v20 = new THREE.Vector3();
    const n01 = new THREE.Vector3();
    const n12 = new THREE.Vector3();
    const n20 = new THREE.Vector3();
    const u01 = new THREE.Vector2();
    const u12 = new THREE.Vector2();
    const u20 = new THREE.Vector2();

    const pushV = (v: THREE.Vector3) => {
      nextPos.push(v.x, v.y, v.z);
    };
    const pushN = (n: THREE.Vector3) => {
      nextNor.push(n.x, n.y, n.z);
    };
    const pushU = (u: THREE.Vector2) => {
      nextUv.push(u.x, u.y);
    };

    for (let i = 0; i < pos.count; i += 3) {
      v0.fromBufferAttribute(pos, i + 0);
      v1.fromBufferAttribute(pos, i + 1);
      v2.fromBufferAttribute(pos, i + 2);

      if (nor) {
        n0.fromBufferAttribute(nor, i + 0);
        n1.fromBufferAttribute(nor, i + 1);
        n2.fromBufferAttribute(nor, i + 2);
      } else {
        n0.set(0, 0, 1);
        n1.set(0, 0, 1);
        n2.set(0, 0, 1);
      }

      if (uv) {
        u0.fromBufferAttribute(uv, i + 0);
        u1.fromBufferAttribute(uv, i + 1);
        u2.fromBufferAttribute(uv, i + 2);
      } else {
        u0.set(0, 0);
        u1.set(0, 0);
        u2.set(0, 0);
      }

      v01.copy(v0).add(v1).multiplyScalar(0.5);
      v12.copy(v1).add(v2).multiplyScalar(0.5);
      v20.copy(v2).add(v0).multiplyScalar(0.5);

      n01.copy(n0).add(n1).normalize();
      n12.copy(n1).add(n2).normalize();
      n20.copy(n2).add(n0).normalize();

      u01.copy(u0).add(u1).multiplyScalar(0.5);
      u12.copy(u1).add(u2).multiplyScalar(0.5);
      u20.copy(u2).add(u0).multiplyScalar(0.5);

      // 4 sub-tris
      // (v0, v01, v20)
      pushV(v0);
      pushV(v01);
      pushV(v20);
      pushN(n0);
      pushN(n01);
      pushN(n20);
      pushU(u0);
      pushU(u01);
      pushU(u20);

      // (v01, v1, v12)
      pushV(v01);
      pushV(v1);
      pushV(v12);
      pushN(n01);
      pushN(n1);
      pushN(n12);
      pushU(u01);
      pushU(u1);
      pushU(u12);

      // (v20, v12, v2)
      pushV(v20);
      pushV(v12);
      pushV(v2);
      pushN(n20);
      pushN(n12);
      pushN(n2);
      pushU(u20);
      pushU(u12);
      pushU(u2);

      // (v01, v12, v20)
      pushV(v01);
      pushV(v12);
      pushV(v20);
      pushN(n01);
      pushN(n12);
      pushN(n20);
      pushU(u01);
      pushU(u12);
      pushU(u20);
    }

    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(nextPos, 3));
    if (nextNor.length > 0) next.setAttribute('normal', new THREE.Float32BufferAttribute(nextNor, 3));
    if (nextUv.length > 0) next.setAttribute('uv', new THREE.Float32BufferAttribute(nextUv, 2));
    geo.dispose();
    geo = next;
  }

  return geo;
}

export function createRoundedBox(
  width: number,
  height: number,
  depth: number,
  endProfile: 'rounded' | 'chamfer' | 'chipped',
  roundness: number,
  chipAmount: number,
  chipJaggedness: number,
  bevel: number,
  quality: number,
  seed: number
): THREE.BufferGeometry {
  const safeRoundness = clamp(roundness, 0, 1);
  const safeBevel = clamp(bevel, 0, 1);
  const safeChipAmount = clamp(chipAmount, 0, 1);
  const safeChipJaggedness = clamp(chipJaggedness, 0, 1);
  const q = clamp(quality, 0, 1);

  const maxRadius = Math.min(width, height) / 2;
  const radius = maxRadius * safeRoundness;

  const rng = (() => {
    let t = ((seed >>> 0) || 1) ^ 0x9e3779b9;
    return () => {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  const profile = endProfile === 'chamfer' || endProfile === 'chipped' || endProfile === 'rounded' ? endProfile : 'rounded';

  const addChippedCorner = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    inwardX: number,
    inwardY: number
  ) => {
    const segBase = 2 + Math.round(safeChipJaggedness * 6);
    const segs = Math.max(2, Math.min(10, segBase));
    const invLen = 1 / Math.max(1e-6, Math.hypot(inwardX, inwardY));
    const ix = inwardX * invLen;
    const iy = inwardY * invLen;

    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const bx = fromX + (toX - fromX) * t;
      const by = fromY + (toY - fromY) * t;
      const jitter = (rng() - 0.5) * 2;
      const amt = safeChipAmount * radius * (0.25 + 0.55 * safeChipJaggedness) * (0.35 + 0.65 * Math.abs(jitter));
      shape.lineTo(bx + ix * amt, by + iy * amt);
    }
  };

  if (radius <= 0) {
    shape.moveTo(x, y);
    shape.lineTo(x + width, y);
    shape.lineTo(x + width, y + height);
    shape.lineTo(x, y + height);
    shape.closePath();
  } else if (profile === 'rounded') {
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
  } else {
    const c = radius;
    shape.moveTo(x + c, y);
    shape.lineTo(x + width - c, y);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width - c, y, x + width, y + c, -1, 1);
    }
    shape.lineTo(x + width, y + c);
    shape.lineTo(x + width, y + height - c);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width, y + height - c, x + width - c, y + height, -1, -1);
    }
    shape.lineTo(x + width - c, y + height);
    shape.lineTo(x + c, y + height);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + c, y + height, x, y + height - c, 1, -1);
    }
    shape.lineTo(x, y + height - c);
    shape.lineTo(x, y + c);
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x, y + c, x + c, y, 1, 1);
    }
    shape.lineTo(x + c, y);
  }

  const maxBevel = Math.min(width, height) * 0.15;
  const bevelSize = maxBevel * safeBevel;
  const bevelThickness = maxBevel * safeBevel;

  const curveSegments = Math.round(12 + q * 96); // 12..108
  const bevelSegments = Math.round(2 + q * 24); // 2..26

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: depth,
    bevelEnabled: safeBevel > 0,
    bevelSegments,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}
