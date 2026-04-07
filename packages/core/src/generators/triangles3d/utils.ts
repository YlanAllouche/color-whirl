import * as THREE from 'three';
import type { EnvironmentStyle } from '../../types.js';

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function cameraZoomFromDistance(distance: number): number {
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

export function chainOnBeforeCompile(material: THREE.Material, fn: (shader: any) => void, keyPart: string): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    (prev as any)?.(shader, renderer);
    fn(shader);
  };

  const prevKey = (material as any).customProgramCacheKey;
  (material as any).customProgramCacheKey = () => {
    const a = typeof prevKey === 'function' ? String(prevKey.call(material)) : '';
    return a ? `${a}|${keyPart}` : keyPart;
  };
  material.needsUpdate = true;
}

export function makeSolidRedTexture01(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function createProceduralEnvironment(
  renderer: THREE.WebGLRenderer,
  style: EnvironmentStyle,
  rotationDeg: number
): { texture: THREE.Texture; dispose: () => void } {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);

  const rot = ((((rotationDeg % 360) + 360) % 360) / 360) * width;

  const addSoftbox = (u: number, v: number, radius: number, strength: number) => {
    return (x: number, y: number) => {
      const dx = x - u;
      const dy = y - v;
      const d2 = dx * dx + dy * dy;
      const r2 = radius * radius;
      if (d2 >= r2) return 0;
      const t = 1 - d2 / r2;
      return strength * t * t;
    };
  };

  const spotA = addSoftbox(0.25, 0.22, 0.12, 0.9);
  const spotB = addSoftbox(0.72, 0.18, 0.16, 0.7);
  const spotC = addSoftbox(0.52, 0.55, 0.22, 0.45);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const xx = (x + rot) % width;
      const u = xx / (width - 1);

      let r = 0;
      let g = 0;
      let b = 0;

      if (style === 'overcast') {
        const top = 0.78;
        const bot = 0.46;
        const t = clamp01(1 - v);
        const k = bot + (top - bot) * Math.pow(t, 1.4);
        r = k;
        g = k;
        b = k;
      } else if (style === 'sunset') {
        const t = clamp01(1 - v);
        const warm = 0.55 + 0.4 * Math.pow(t, 1.2);
        r = warm;
        g = 0.35 + 0.25 * Math.pow(t, 1.1);
        b = 0.32 + 0.18 * Math.pow(1 - t, 1.7);
      } else {
        const t = clamp01(1 - v);
        const sky = 0.74 * Math.pow(t, 1.6);
        const floor = 0.06 + 0.05 * (1 - t);
        const k = floor + sky;
        r = k;
        g = k;
        b = k;
      }

      const s = spotA(u, v) + spotB(u, v) + spotC(u, v);
      r = clamp01(r + s);
      g = clamp01(g + s);
      b = clamp01(b + s);

      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose()
  };
}
