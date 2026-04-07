export function hash01(seed: number, a: number, b: number): number {
  let x = (Number(seed) >>> 0) ^ (Math.imul(a | 0, 374761393) >>> 0) ^ (Math.imul(b | 0, 668265263) >>> 0);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}
