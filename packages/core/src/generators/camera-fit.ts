import * as THREE from 'three';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getBoxCorners(box: THREE.Box3): THREE.Vector3[] {
  const min = box.min;
  const max = box.max;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

export type OrthoCameraConfigInput = {
  mode?: 'auto' | 'manual';
  distance: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  azimuth: number;
  elevation: number;
  near?: number;
  far?: number;
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

export function applyOrthographicCameraFromConfig(camera: THREE.OrthographicCamera, config: OrthoCameraConfigInput): void {
  const azimuthRad = degToRad(Number(config.azimuth) || 0);
  const elevationDeg = clamp(Number(config.elevation) || 0, -80, 80);
  const elevationRad = degToRad(elevationDeg);
  const d = Math.max(0.01, Number(config.distance) || 0.01);

  const target = new THREE.Vector3(0, 0, 0);
  const position = new THREE.Vector3(
    d * Math.cos(elevationRad) * Math.sin(azimuthRad),
    d * Math.sin(elevationRad),
    d * Math.cos(elevationRad) * Math.cos(azimuthRad)
  );

  if (config.mode === 'manual') {
    const forward = target.clone().sub(position).normalize();
    let right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-8) right = new THREE.Vector3(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const panX = Number.isFinite(Number(config.panX)) ? Number(config.panX) : 0;
    const panY = Number.isFinite(Number(config.panY)) ? Number(config.panY) : 0;
    const panOffset = right.multiplyScalar(panX).add(up.multiplyScalar(panY));
    position.add(panOffset);
    target.add(panOffset);

    const zoom = Number(config.zoom);
    camera.zoom = Number.isFinite(zoom) ? Math.max(0.01, zoom) : 1;

    const near = Number(config.near);
    const far = Number(config.far);
    const nextNear = Number.isFinite(near) ? Math.max(0.001, near) : 0.001;
    const nextFarRaw = Number.isFinite(far) ? far : 1000;
    camera.near = nextNear;
    camera.far = Math.max(nextNear + 0.001, nextFarRaw);
  } else {
    camera.zoom = cameraZoomFromDistance(d);
  }

  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

/**
 * Best-effort auto-framing for orthographic cameras.
 *
 * This prevents random (or user) configs from producing unusable cropped renders by
 * reducing zoom (zooming out) when the scene bounds would extend past the viewport.
 * It also tightens near/far planes to avoid accidental near-plane slicing.
 */
export function autoFitOrthographicCameraToBox(
  camera: THREE.OrthographicCamera,
  worldBounds: THREE.Box3,
  options?: {
    /** 0..1: fraction of viewport reserved for content (default 0.92). */
    padding?: number;
    /** Minimum near plane (default 0.01). */
    minNear?: number;
    /** Ensure bounds are entirely in front of the camera (default true). */
    pushBackIfSlicing?: boolean;
  }
): void {
  if (!worldBounds || worldBounds.isEmpty()) return;

  const padding = clamp(Number(options?.padding ?? 0.92), 0.5, 0.999);
  const minNear = Math.max(0.001, Number(options?.minNear ?? 0.01));
  const pushBackIfSlicing = options?.pushBackIfSlicing ?? true;

  const corners = getBoxCorners(worldBounds);

  const tmpDir = new THREE.Vector3();

  const measure = (): { maxAbsX: number; maxAbsY: number; minZ: number; maxZ: number } => {
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    let maxAbsX = 0;
    let maxAbsY = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < corners.length; i++) {
      const p = corners[i].clone().applyMatrix4(inv);
      const x = Math.abs(p.x);
      const y = Math.abs(p.y);
      if (x > maxAbsX) maxAbsX = x;
      if (y > maxAbsY) maxAbsY = y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    return { maxAbsX, maxAbsY, minZ, maxZ };
  };

  let m = measure();

  // If any part of the bounds is at/behind the camera plane, the near plane will slice geometry
  // and can reveal interiors. Push the camera back along its view direction until it's safe.
  if (pushBackIfSlicing) {
    const sliceEps = 1e-4;
    const zThreshold = -minNear + sliceEps;
    if (m.maxZ > zThreshold) {
      const delta = (m.maxZ - zThreshold) + Math.max(0.01, (m.maxZ - m.minZ) * 0.02);
      camera.getWorldDirection(tmpDir); // forward
      camera.position.addScaledVector(tmpDir, -delta); // move backward
      m = measure();
    }
  }

  const halfW0 = Math.abs(camera.right - camera.left) * 0.5;
  const halfH0 = Math.abs(camera.top - camera.bottom) * 0.5;

  const eps = 1e-6;
  const zoomMaxX = m.maxAbsX > eps ? (halfW0 * padding) / m.maxAbsX : Infinity;
  const zoomMaxY = m.maxAbsY > eps ? (halfH0 * padding) / m.maxAbsY : Infinity;
  const zoomMax = Math.min(zoomMaxX, zoomMaxY);
  if (Number.isFinite(zoomMax) && zoomMax > 0) {
    camera.zoom = Math.min(camera.zoom, zoomMax);
  }

  // Near/far: camera looks down -Z; visible points have negative z in camera space.
  const nearDist = Math.max(0, -m.maxZ);
  const farDist = Math.max(0, -m.minZ);
  if (Number.isFinite(nearDist) && Number.isFinite(farDist) && farDist > 0) {
    const depth = Math.max(eps, farDist - nearDist);
    const pad = Math.max(0.05, depth * 0.05);
    const nextNear = Math.max(minNear, nearDist - pad);
    const nextFar = Math.max(nextNear + 1.0, farDist + pad);
    camera.near = nextNear;
    camera.far = nextFar;
  }

  camera.updateProjectionMatrix();
}
