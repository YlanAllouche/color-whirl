import { iconToSVG, replaceIDs } from '@iconify/utils';

export type IconProviderId = 'lucide' | 'tabler' | 'ph' | 'heroicons' | 'oui';

export type IconProviderMeta = {
  id: IconProviderId;
  label: string;
  shortLabel: string;
  badgeTone: 'blue' | 'teal' | 'green' | 'amber' | 'rose';
};

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

const PROVIDER_META: Record<IconProviderId, IconProviderMeta> = {
  lucide: { id: 'lucide', label: 'Lucide', shortLabel: 'LUC', badgeTone: 'blue' },
  tabler: { id: 'tabler', label: 'Tabler', shortLabel: 'TAB', badgeTone: 'teal' },
  ph: { id: 'ph', label: 'Phosphor', shortLabel: 'PH', badgeTone: 'green' },
  heroicons: { id: 'heroicons', label: 'Heroicons', shortLabel: 'HRO', badgeTone: 'amber' },
  oui: { id: 'oui', label: 'OUI', shortLabel: 'OUI', badgeTone: 'rose' }
};

export const ICON_PROVIDER_IDS = Object.keys(PROVIDER_META) as IconProviderId[];

export function getIconProviderMeta(id: IconProviderId): IconProviderMeta {
  return PROVIDER_META[id];
}

export function getIconProviderLabel(id: IconProviderId): string {
  return getIconProviderMeta(id).label;
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

  // Iconify JSON packs often store default width/height at the set level,
  // while individual icons omit it. iconToSVG defaults missing dims to 16,
  // which can produce a wrong viewBox (and clipped icons).
  const iconData = {
    ...(icon as any),
    width: (icon as any)?.width ?? loaded.json.width ?? 24,
    height: (icon as any)?.height ?? loaded.json.height ?? 24
  };

  const out = iconToSVG(iconData, {
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

export async function getProviderIconPreviewSvg(id: IconProviderId, name: string, size = 20): Promise<string> {
  const svg = await getProviderIconSvg(id, name);
  const normalizedSize = Number.isFinite(size) ? Math.max(12, Math.min(48, Math.round(size))) : 20;

  return svg
    .replace(/\swidth="[^"]*"/i, '')
    .replace(/\sheight="[^"]*"/i, '')
    .replace('<svg ', `<svg width="${normalizedSize}" height="${normalizedSize}" aria-hidden="true" focusable="false" `);
}
