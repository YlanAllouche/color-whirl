type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLocalStorageJson<T extends Json>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalStorageJson(key: string, value: Json): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / disabled storage.
  }
}

export function readLocalStorageBool(key: string): boolean | null {
  const v = readLocalStorageJson<Json>(key);
  return typeof v === 'boolean' ? v : null;
}

export function readLocalStorageNumber(key: string): number | null {
  const v = readLocalStorageJson<Json>(key);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function readLocalStorageString(key: string): string | null {
  const v = readLocalStorageJson<Json>(key);
  return typeof v === 'string' ? v : null;
}

export function writeLocalStorageBool(key: string, value: boolean): void {
  writeLocalStorageJson(key, value);
}

export function writeLocalStorageNumber(key: string, value: number): void {
  if (!Number.isFinite(value)) return;
  writeLocalStorageJson(key, value);
}

export function writeLocalStorageString(key: string, value: string): void {
  writeLocalStorageJson(key, value);
}
