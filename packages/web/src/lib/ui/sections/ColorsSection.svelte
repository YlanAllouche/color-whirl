<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { ColorPreset } from '$lib/color-presets';

  import PaletteOverrideItem from '$lib/ui/inspector/colors/PaletteOverrideItem.svelte';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type PaletteBlock = 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi';
  type HarmonyMode = 'monochromatic' | 'adjacent' | 'complementary';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }>;
    selectedColorPreset: ColorPreset | null;
    cycleColorPreset: (delta: number) => void;
    applySelectedColorPreset: () => void;
    updateColor: (index: number, next: string) => void;
    replaceColors: (colors: string[]) => void;
    moveColor: (fromIndex: number, toIndex: number) => void;
    removeColor: (index: number) => void;
    addColor: () => void;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (paletteIndex: number, block: PaletteBlock) => void;
    selectedColorPresetId: string;
  };

  let {
    config,
    is3DType,
    supportsEmission,
    isLocked,
    toggleLock,
    colorPresetGroups,
    selectedColorPreset,
    cycleColorPreset,
    applySelectedColorPreset,
    updateColor,
    replaceColors,
    moveColor,
    removeColor,
    addColor,
    togglePaletteOverride,
    updatePaletteOverride,
    togglePaletteBlock,
    selectedColorPresetId = $bindable()
  }: Props = $props();

  let openOverrideByIndex = $state<Record<number, boolean>>({});
  let harmonyMode = $state<HarmonyMode>('monochromatic');
  let harmonyLength = $state(5);
  let harmonyIncludeAccent = $state(true);
  let harmonyAnchorA = $state('#ff5f56');
  let harmonyAnchorB = $state('#4db6ff');
  let harmonyInitialized = $state(false);

  let dragFromIndex = $state(-1);
  let dragOverIndex = $state(-1);

  $effect(() => {
    if (harmonyInitialized) return;
    harmonyLength = Math.max(2, config.colors.length || 5);
    if (config.colors[0]) harmonyAnchorA = normalizeHex(config.colors[0]) ?? harmonyAnchorA;
    if (config.colors[1]) harmonyAnchorB = normalizeHex(config.colors[1]) ?? harmonyAnchorB;
    harmonyInitialized = true;
  });

  type Rgb = { r: number; g: number; b: number };
  type Hsv = { h: number; s: number; v: number };

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function wrapHue(h: number): number {
    const wrapped = h % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
  }

  function parseHex(input: string): Rgb | null {
    const clean = input.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(clean)) {
      const r = Number.parseInt(clean[0] + clean[0], 16);
      const g = Number.parseInt(clean[1] + clean[1], 16);
      const b = Number.parseInt(clean[2] + clean[2], 16);
      return { r, g, b };
    }
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    const n = Number.parseInt(clean, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function normalizeHex(input: string): string | null {
    const rgb = parseHex(input);
    if (!rgb) return null;
    return toHex(rgb);
  }

  function toHex({ r, g, b }: Rgb): string {
    const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
    const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
    const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`;
  }

  function rgbToHsv({ r, g, b }: Rgb): Hsv {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;

    let h = 0;
    if (d > 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }

    const s = max === 0 ? 0 : d / max;
    return { h: wrapHue(h), s: s * 100, v: max * 100 };
  }

  function hsvToRgb({ h, s, v }: Hsv): Rgb {
    const hh = wrapHue(h);
    const ss = clamp(s, 0, 100) / 100;
    const vv = clamp(v, 0, 100) / 100;
    const c = vv * ss;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = vv - c;

    let rn = 0;
    let gn = 0;
    let bn = 0;

    if (hh < 60) {
      rn = c;
      gn = x;
    } else if (hh < 120) {
      rn = x;
      gn = c;
    } else if (hh < 180) {
      gn = c;
      bn = x;
    } else if (hh < 240) {
      gn = x;
      bn = c;
    } else if (hh < 300) {
      rn = x;
      bn = c;
    } else {
      rn = c;
      bn = x;
    }

    return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
  }

  function colorToHsv(color: string): Hsv {
    const rgb = parseHex(color) ?? { r: 255, g: 255, b: 255 };
    return rgbToHsv(rgb);
  }

  function updateColorFromHex(index: number, raw: string) {
    const next = normalizeHex(raw);
    if (!next) return;
    updateColor(index, next);
  }

  function toggleOverrideEditor(index: number) {
    openOverrideByIndex = { ...openOverrideByIndex, [index]: !openOverrideByIndex[index] };
  }

  function getOverrideStatus(index: number): { label: string; active: boolean } {
    const ov = (config as any).palette?.overrides?.[index] as any;
    if (!ov) return { label: 'No override', active: false };
    const hasScoped = !!(ov.emission || ov.texture || ov.edge || ov.geometry || ov.bubbles || ov.voronoi || ov.facades?.grazing || ov.facades?.side || ov.facades?.outline);
    if (ov.enabled && hasScoped) return { label: 'Override on', active: true };
    if (ov.enabled) return { label: 'Enabled', active: true };
    return { label: 'Configured', active: false };
  }

  async function copyHex(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function makeHarmonyPalette(): string[] {
    const a = colorToHsv(harmonyAnchorA);
    const b = colorToHsv(harmonyAnchorB);
    const n = clamp(Math.round(harmonyLength), 2, 24);
    const out: string[] = [];

    if (harmonyMode === 'complementary') {
      const hues = [a.h, b.h, wrapHue(a.h + 180), wrapHue(b.h + 180)];
      for (let i = 0; i < n; i++) {
        const t = n <= 1 ? 0 : i / (n - 1);
        const hue = hues[i % hues.length];
        const sat = a.s + (b.s - a.s) * t;
        const val = a.v + (b.v - a.v) * (1 - t);
        out.push(toHex(hsvToRgb({ h: hue, s: clamp(sat, 32, 98), v: clamp(val, 26, 100) })));
      }
      return out;
    }

    const reserveAccent = harmonyIncludeAccent && (harmonyMode === 'monochromatic' || harmonyMode === 'adjacent') ? 1 : 0;
    const mainCount = Math.max(1, n - reserveAccent);

    for (let i = 0; i < mainCount; i++) {
      const t = mainCount <= 1 ? 0 : i / (mainCount - 1);
      const sat = a.s + (b.s - a.s) * t;
      const val = clamp(18 + 80 * (0.25 + t * 0.75), 18, 100);
      const hue =
        harmonyMode === 'monochromatic'
          ? a.h
          : wrapHue(a.h + (t - 0.5) * 60 + (b.h - a.h) * 0.15);
      out.push(toHex(hsvToRgb({ h: hue, s: clamp(sat, 12, 100), v: val })));
    }

    if (reserveAccent > 0) {
      const accentHue = wrapHue(a.h + 180);
      const accentSat = clamp(0.6 * a.s + 0.4 * b.s + 14, 24, 100);
      const accentVal = clamp(0.55 * a.v + 0.45 * b.v + 12, 20, 100);
      out.unshift(toHex(hsvToRgb({ h: accentHue, s: accentSat, v: accentVal })));
    }

    return out.slice(0, n);
  }

  function applyHarmonyPalette() {
    replaceColors(makeHarmonyPalette());
  }

  function swapColorWithBackground(index: number) {
    const color = normalizeHex(config.colors[index] ?? '#ffffff') ?? (config.colors[index] ?? '#ffffff');
    const background = normalizeHex(config.backgroundColor) ?? config.backgroundColor;
    const nextColors = config.colors.slice();
    nextColors[index] = background;
    config.backgroundColor = color;
    replaceColors(nextColors);
  }

  function handleDragStart(index: number) {
    dragFromIndex = index;
    dragOverIndex = index;
  }

  function handleDragEnter(index: number) {
    dragOverIndex = index;
  }

  function handleDrop(index: number) {
    const from = dragFromIndex;
    dragFromIndex = -1;
    dragOverIndex = -1;
    if (from < 0 || from === index) return;
    moveColor(from, index);
  }

  function handleDragEnd() {
    dragFromIndex = -1;
    dragOverIndex = -1;
  }
</script>

<CollapsiblePanel id="colors" title="Colors" icon="palette" defaultOpen={true} searchKeys="palette preset background">
  <label class="control-row">
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('colors')}
      onclick={() => toggleLock('colors')}
      title="Click to lock/unlock for randomize"
    >
      Lock colors
    </button>
    <span class="setting-hint">Presets + palette overrides</span>
  </label>

  <label class="control-row">
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('backgroundColor')}
      onclick={() => toggleLock('backgroundColor')}
      title="Click to lock/unlock for randomize"
    >
      Background (scheme)
    </button>
    <input type="color" bind:value={config.backgroundColor} />
  </label>
  <div class="palette-controls">
    <div class="palette-row">
      <button type="button" class="palette-nav" onclick={() => cycleColorPreset(-1)} title="Previous preset">Prev</button>
      <Dropdown
        bind:value={selectedColorPresetId}
        size="sm"
        title="Apply a preset to colors + background"
        ariaLabel="Color preset"
        options={colorPresetGroups.map((g) => ({
          group: g.group,
          options: g.presets.map((preset) => ({ value: preset.id, label: preset.label }))
        }))}
        onChange={applySelectedColorPreset}
      />
      <button type="button" class="palette-nav" onclick={() => cycleColorPreset(1)} title="Next preset">Next</button>
    </div>
    {#if selectedColorPreset}
      <div class="palette-preview" title={selectedColorPreset.source ?? ''}>
        <span class="swatch swatch-bg" style={`background: ${selectedColorPreset.backgroundColor}`}></span>
        {#each selectedColorPreset.colors.slice(0, 10) as c}
          <span class="swatch" style={`background: ${c}`}></span>
        {/each}
      </div>
    {/if}
  </div>

  <details class="control-details">
    <summary class="control-details-summary">Harmony helper</summary>

    <label class="control-row">
      <span class="setting-title">Mode</span>
      <Dropdown
        value={harmonyMode}
        ariaLabel="Harmony mode"
        options={[
          { value: 'monochromatic', label: 'Monochromatic' },
          { value: 'adjacent', label: 'Adjacent' },
          { value: 'complementary', label: 'Complementary' }
        ]}
        onChange={(v) => {
          harmonyMode = String(v) as HarmonyMode;
        }}
      />
    </label>

    <label class="control-row">
      <span class="setting-title">Anchor A</span>
      <input type="color" bind:value={harmonyAnchorA} />
    </label>

    <label class="control-row">
      <span class="setting-title">Anchor B</span>
      <input type="color" bind:value={harmonyAnchorB} />
    </label>

    <label class="control-row">
      <span class="setting-title">Length</span>
      <input
        type="number"
        min="2"
        max="24"
        value={harmonyLength}
        oninput={(e) => {
          harmonyLength = clamp(Number((e.currentTarget as HTMLInputElement).value || 2), 2, 24);
        }}
      />
    </label>

    {#if harmonyMode !== 'complementary'}
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={harmonyIncludeAccent} />
        <span class="setting-title">Add complementary accent</span>
      </label>
    {/if}

    <div class="row-actions">
      <button type="button" class="palette-nav" onclick={applyHarmonyPalette}>Apply harmony palette</button>
    </div>
  </details>

  <div class="colors-list palette-list">
    {#each config.colors as color, i (i)}
      {@const ovStatus = getOverrideStatus(i)}
      <div
        class={`palette-item ${dragOverIndex === i ? 'is-drop-target' : ''}`}
        role="listitem"
        draggable="true"
        ondragstart={() => handleDragStart(i)}
        ondragenter={() => handleDragEnter(i)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => handleDrop(i)}
        ondragend={handleDragEnd}
      >
        <div class="palette-item-head">
          <span class="mono">#{i + 1}</span>
          <span class="swatch" style={`background: ${color}`}></span>
          <span class="mono">{color}</span>
          <span class={`override-pill ${ovStatus.active ? 'active' : ''}`}>{ovStatus.label}</span>
        </div>

        <div class="palette-item-grid">
          <label class="palette-field color-field">
            <span>Pick</span>
            <input type="color" value={color} oninput={(e) => updateColor(i, (e.currentTarget as HTMLInputElement).value)} />
          </label>

          <label class="palette-field">
            <span>Hex</span>
            <input
              class="hex-input"
              type="text"
              value={color}
              spellcheck="false"
              onblur={(e) => updateColorFromHex(i, (e.currentTarget as HTMLInputElement).value)}
              onkeydown={(e) => {
                if (e.key !== 'Enter') return;
                updateColorFromHex(i, (e.currentTarget as HTMLInputElement).value);
              }}
            />
          </label>
        </div>

        <div class="palette-item-actions">
          <button type="button" class="palette-nav" onclick={() => copyHex(color)}>Copy hex</button>
          <button type="button" class="palette-nav" onclick={() => swapColorWithBackground(i)}>Swap BG</button>
          <button type="button" class="palette-nav" onclick={() => toggleOverrideEditor(i)}>
            {openOverrideByIndex[i] ? 'Hide override' : 'Override'}
          </button>
          <button class="remove-btn" onclick={() => removeColor(i)} disabled={config.colors.length <= 1}>×</button>
        </div>

        {#if openOverrideByIndex[i]}
          <div class="palette-inline-override">
            <PaletteOverrideItem
              {config}
              {color}
              index={i}
              {is3DType}
              {supportsEmission}
              open={true}
              {togglePaletteOverride}
              {updatePaletteOverride}
              {togglePaletteBlock}
            />
          </div>
        {/if}
      </div>
    {/each}
    <button class="add-btn" onclick={addColor}>+ Add Color</button>
  </div>
</CollapsiblePanel>
