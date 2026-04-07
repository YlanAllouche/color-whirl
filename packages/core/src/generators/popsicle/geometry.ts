import * as THREE from 'three';
import { clamp, degToRad } from './utils.js';

export interface StickDimensions {
  width: number;
  height: number;
  depth: number;
}

export function getStickDimensions(
  canvasWidth: number,
  canvasHeight: number,
  stickThickness: number,
  stickSize: number,
  stickRatio: number
): StickDimensions {
  const aspect = canvasWidth / canvasHeight;

  // Normalize to frustum size (10 units) with aspect ratio correction
  const baseSize = 8; // Use 80% of the 10-unit frustum

  const safeSize = clamp(Number.isFinite(stickSize) ? stickSize : 1.0, 0.01, 100);
  const safeRatio = clamp(Number.isFinite(stickRatio) ? stickRatio : 3.0, 0.05, 100);

  // Start from the historical defaults (expressed as fractions of viewport width/height),
  // then apply ratio while keeping the overall footprint (area) stable.
  const baseWidth = baseSize * aspect * 0.15 * safeSize;
  const baseHeight = baseSize * 0.8 * safeSize;
  const area = baseWidth * baseHeight;

  const width = Math.sqrt(area / safeRatio);
  const height = Math.sqrt(area * safeRatio);

  return {
    width,
    height,
    depth: baseSize * aspect * 0.02 * stickThickness * safeSize
  };
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
  const safeRoundness = Math.max(0, Math.min(1, roundness));
  const safeBevel = Math.max(0, Math.min(1, bevel));
  const safeChipAmount = Math.max(0, Math.min(1, chipAmount));
  const safeChipJaggedness = Math.max(0, Math.min(1, chipJaggedness));
  const q = Math.max(0, Math.min(1, quality));

  const maxRadius = Math.min(width, height) / 2;
  const radius = maxRadius * safeRoundness;

  const rng = (() => {
    let t = ((seed >>> 0) || 1) ^ 0x9e3779b9;
    return () => {
      // mulberry32
      t += 0x6D2B79F5;
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
      const px = bx + ix * amt;
      const py = by + iy * amt;
      shape.lineTo(px, py);
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
    // Chamfer/chipped: use a straight-corner profile in the 2D shape.
    const c = radius;
    shape.moveTo(x + c, y);
    shape.lineTo(x + width - c, y);
    // Bottom-right corner
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width - c, y, x + width, y + c, -1, 1);
    }
    shape.lineTo(x + width, y + c);

    shape.lineTo(x + width, y + height - c);
    // Top-right corner
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + width, y + height - c, x + width - c, y + height, -1, -1);
    }
    shape.lineTo(x + width - c, y + height);

    shape.lineTo(x + c, y + height);
    // Top-left corner
    if (profile === 'chipped' && safeChipAmount > 0) {
      addChippedCorner(x + c, y + height, x, y + height - c, 1, -1);
    }
    shape.lineTo(x, y + height - c);

    shape.lineTo(x, y + c);
    // Bottom-left corner
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

export function getStackingOffset(
  index: number,
  stickDimensions: StickDimensions,
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  z: number
): { x: number; y: number; z: number; rotationZ: number } {
  // Helix with configurable overhang angle and rotation center offset
  // stickOverhang: degrees each stick rotates from the previous
  const rotationAngle = index * degToRad(stickOverhang);

  // Rotation center offset: -100% = far left/bottom, 0% = center, +100% = far right/top
  // We need to apply the rotation around a point other than (0,0)
  const offsetXPercent = rotationCenterOffsetX / 100;
  const offsetYPercent = rotationCenterOffsetY / 100;

  // Calculate the rotation pivot point relative to stick center
  // The stick extends from -height/2 to +height/2 in its local Y axis
  const pivotX = offsetXPercent * (stickDimensions.width / 2);
  const pivotY = offsetYPercent * (stickDimensions.height / 2);

  // Apply rotation around the pivot point
  // First translate to pivot, rotate, then translate back
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);

  // Position offset from rotation around pivot
  const offsetX = pivotX * (1 - cos) + pivotY * sin;
  const offsetY = pivotY * (1 - cos) - pivotX * sin;

  return {
    x: offsetX,
    y: offsetY,
    z,
    rotationZ: rotationAngle
  };
}
