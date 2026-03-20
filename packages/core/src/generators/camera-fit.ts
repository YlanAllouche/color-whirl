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
