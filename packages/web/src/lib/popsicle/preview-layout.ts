import * as THREE from 'three';
import { applyOrthographicCameraFromConfig, autoFitOrthographicCameraToBox } from '@wallpaper-maker/core';

export type Bounds = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

export function applyOrthoCameraFromConfig(
  camera: THREE.OrthographicCamera,
  config: {
    mode?: 'auto' | 'manual';
    distance: number;
    zoom?: number;
    panX?: number;
    panY?: number;
    azimuth: number;
    elevation: number;
    near?: number;
    far?: number;
  }
): void {
  applyOrthographicCameraFromConfig(camera, config);
}

export function autoFitOrthoCameraToBox(camera: THREE.OrthographicCamera, box: THREE.Box3, padding: number = 0.92): void {
  const pad = clamp(Number(padding), 0.5, 0.999);
  autoFitOrthographicCameraToBox(camera, box, { padding: pad, minNear: 0.001, pushBackIfSlicing: true });
}

export function symmetricBoxFromSize(size: THREE.Vector3): THREE.Box3 {
  const half = size.clone().multiplyScalar(0.5);
  return new THREE.Box3(new THREE.Vector3(-half.x, -half.y, -half.z), new THREE.Vector3(half.x, half.y, half.z));
}

export function minDistanceToFitBoundingSphere(radius: number, aspect: number, vFovDeg: number, padding: number = 0.92): number {
  const r = Math.max(0, Number(radius) || 0);
  if (r <= 0) return 0;
  const pad = clamp(Number(padding), 0.5, 0.999);
  const vHalf = (clamp(Number(vFovDeg) || 0, 1, 179) * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(1e-6, aspect));
  const half = Math.min(vHalf, hHalf);
  const tanHalf = Math.max(1e-6, Math.tan(half));
  // Conservative: keep the near side of the sphere within the frustum.
  return r + r / (tanHalf * pad);
}

export function getStickDimensions(
  canvasWidth: number,
  canvasHeight: number,
  stickThickness: number,
  stickSize: number,
  stickRatio: number
): { width: number; height: number; depth: number } {
  const aspect = canvasWidth / canvasHeight;
  const baseSize = 8;

  const safeSize = clamp(Number.isFinite(stickSize) ? stickSize : 1.0, 0.01, 100);
  const safeRatio = clamp(Number.isFinite(stickRatio) ? stickRatio : 3.0, 0.05, 100);

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

export function getStackingOffset(
  index: number,
  stickDimensions: { width: number; height: number; depth: number },
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number,
  zOverride?: number
): { x: number; y: number; z: number; rotationZ: number } {
  const rotationAngle = index * degToRad(stickOverhang);

  const offsetXPercent = rotationCenterOffsetX / 100;
  const offsetYPercent = rotationCenterOffsetY / 100;

  const pivotX = offsetXPercent * (stickDimensions.width / 2);
  const pivotY = offsetYPercent * (stickDimensions.height / 2);

  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);

  const offsetX = pivotX * (1 - cos) + pivotY * sin;
  const offsetY = pivotY * (1 - cos) - pivotX * sin;

  return {
    x: offsetX,
    y: offsetY,
    z: typeof zOverride === 'number' && Number.isFinite(zOverride) ? zOverride : index * (stickDimensions.depth + stickGap),
    rotationZ: rotationAngle
  };
}

export function computeBounds(
  stickDimensions: { width: number; height: number; depth: number },
  stickCount: number,
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number,
  outlineScale: number = 1
): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  const oScale = Math.max(1, Number(outlineScale) || 1);

  // Conservative radius in XY accounting for rotation.
  const halfDiag =
    Math.sqrt((stickDimensions.width * 0.5) * (stickDimensions.width * 0.5) + (stickDimensions.height * 0.5) * (stickDimensions.height * 0.5)) *
    oScale;
  const halfDepth = stickDimensions.depth * 0.5 * oScale;

  for (let i = 0; i < stickCount; i++) {
    const o = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap);
    min.x = Math.min(min.x, o.x - halfDiag);
    min.y = Math.min(min.y, o.y - halfDiag);
    min.z = Math.min(min.z, o.z - halfDepth);
    max.x = Math.max(max.x, o.x + halfDiag);
    max.y = Math.max(max.y, o.y + halfDiag);
    max.z = Math.max(max.z, o.z + halfDepth);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  return { min, max, center, size, radius };
}

export function computeBoundsPerStick(options: {
  stickCount: number;
  getStickDimensions: (i: number) => { width: number; height: number; depth: number };
  stickOverhang: number;
  rotationCenterOffsetX: number;
  rotationCenterOffsetY: number;
  stickGap: number;
  outlineScale?: number;
}): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  const oScale = Math.max(1, Number(options.outlineScale ?? 1) || 1);
  const safeGap = Number.isFinite(Number(options.stickGap)) ? Number(options.stickGap) : 0;

  let zCursor = 0;
  let prevDepth = 0;

  for (let i = 0; i < options.stickCount; i++) {
    const dims = options.getStickDimensions(i);
    if (i === 0) {
      zCursor = 0;
    } else {
      zCursor += prevDepth * 0.5 + dims.depth * 0.5 + safeGap;
    }
    prevDepth = dims.depth;

    const o = getStackingOffset(
      i,
      dims,
      options.stickOverhang,
      options.rotationCenterOffsetX,
      options.rotationCenterOffsetY,
      safeGap,
      zCursor
    );

    const halfDiag = Math.sqrt((dims.width * 0.5) * (dims.width * 0.5) + (dims.height * 0.5) * (dims.height * 0.5)) * oScale;
    const halfDepth = dims.depth * 0.5 * oScale;

    min.x = Math.min(min.x, o.x - halfDiag);
    min.y = Math.min(min.y, o.y - halfDiag);
    min.z = Math.min(min.z, o.z - halfDepth);
    max.x = Math.max(max.x, o.x + halfDiag);
    max.y = Math.max(max.y, o.y + halfDiag);
    max.z = Math.max(max.z, o.z + halfDepth);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  return { min, max, center, size, radius };
}
