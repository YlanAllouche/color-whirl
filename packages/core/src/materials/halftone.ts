import * as THREE from 'three';
import { clamp, chainOnBeforeCompile } from './utils.js';

const toonGradientCache = new Map<string, THREE.DataTexture>();

export function getToonGradientMap(bands: number): THREE.DataTexture {
  const b = Math.max(2, Math.min(16, Math.round(bands)));
  const key = String(b);
  const existing = toonGradientCache.get(key);
  if (existing) return existing;

  // 1D gradient map: repeated band steps.
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const stepped = Math.floor(t * b) / Math.max(1, b - 1);
    const v = Math.round(clamp(stepped, 0, 1) * 255);
    const i = x * 4;
    data[i + 0] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  toonGradientCache.set(key, tex);
  return tex;
}

export function applyHalftone(material: THREE.Material): void {
  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Halftone overlay\nfloat ht = 0.0;\nvec2 p = gl_FragCoord.xy * 0.065;\nfloat a = sin(p.x) * sin(p.y);\nht = smoothstep(0.25, 0.75, a);\ngl_FragColor.rgb *= mix(1.0, 0.86, ht);`
      );
    },
    'halftone-v1'
  );
}
