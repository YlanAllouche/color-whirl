export function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base: any, patch: any): any {
  if (Array.isArray(base)) {
    return Array.isArray(patch) ? patch.slice() : base.slice();
  }

  if (isPlainObject(base)) {
    const out: Record<string, any> = {};
    const patchObj = isPlainObject(patch) ? patch : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(patchObj)]);
    for (const key of keys) {
      out[key] = deepMerge(base[key], patchObj[key]);
    }
    return out;
  }

  return patch == null ? base : patch;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
