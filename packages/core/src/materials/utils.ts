import * as THREE from 'three';

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function chainOnBeforeCompile(
  material: THREE.Material,
  fn: (shader: any) => void,
  keyPart: string
): void {
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
