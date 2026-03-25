import { iconToSVG, replaceIDs } from '@iconify/utils';

export type IconProviderId = 'lucide' | 'tabler' | 'ph' | 'heroicons' | 'oui';

type IconifyIconsJson = {
  prefix?: string;
  width?: number;
  height?: number;
  icons: Record<string, any>;
};

type LoadedProvider = {
  id: IconProviderId;
  json: IconifyIconsJson;
  names: string[];
};

const cache = new Map<IconProviderId, LoadedProvider>();

export function getIconProviderLabel(id: IconProviderId): string {
  switch (id) {
    case 'lucide':
      return 'Lucide';
    case 'tabler':
      return 'Tabler';
    case 'ph':
      return 'Phosphor';
    case 'heroicons':
      return 'Heroicons';
    case 'oui':
      return 'OUI';
  }
}

async function importIconsJson(id: IconProviderId): Promise<IconifyIconsJson> {
  switch (id) {
    case 'lucide':
      return (await import('@iconify-json/lucide/icons.json')).default as any;
    case 'tabler':
      return (await import('@iconify-json/tabler/icons.json')).default as any;
    case 'ph':
      return (await import('@iconify-json/ph/icons.json')).default as any;
    case 'heroicons':
      // Iconify has multiple heroicons sets; this one is the base prefix.
      return (await import('@iconify-json/heroicons/icons.json')).default as any;
    case 'oui':
      return (await import('@iconify-json/oui/icons.json')).default as any;
  }
}

export async function loadIconProvider(id: IconProviderId): Promise<LoadedProvider> {
  const existing = cache.get(id);
  if (existing) return existing;

  const json = await importIconsJson(id);
  const names = Object.keys(json?.icons ?? {}).sort();
  const loaded: LoadedProvider = { id, json, names };
  cache.set(id, loaded);
  return loaded;
}

export async function listProviderIcons(id: IconProviderId): Promise<string[]> {
  return (await loadIconProvider(id)).names;
}

export async function getProviderIconSvg(id: IconProviderId, name: string): Promise<string> {
  const loaded = await loadIconProvider(id);
  const icon = loaded.json?.icons?.[name];
  if (!icon) throw new Error(`Icon not found: ${id}:${name}`);

  const out = iconToSVG(icon, {
    width: loaded.json.width ?? 24,
    height: loaded.json.height ?? 24
  });

  const attrs: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg',
    ...Object.fromEntries(Object.entries(out.attributes ?? {}).map(([k, v]) => [k, String(v)]))
  };

  // Ensure explicit size + viewBox so downstream renderers normalize correctly.
  if (!('width' in attrs)) attrs.width = String(loaded.json.width ?? 24);
  if (!('height' in attrs)) attrs.height = String(loaded.json.height ?? 24);
  if (!('viewBox' in attrs) && !('viewbox' in attrs)) {
    const w = Number(attrs.width) || loaded.json.width || 24;
    const h = Number(attrs.height) || loaded.json.height || 24;
    attrs.viewBox = `0 0 ${w} ${h}`;
  }

  const body = replaceIDs(out.body);
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v).replace(/\"/g, '&quot;')}"`)
    .join(' ');

  return `<svg ${attrStr}>${body}</svg>`;
}
