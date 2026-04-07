<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';
  import type { PaletteOverrideBlock } from './paletteOverrideTypes';

  type Props = {
    config: WallpaperConfig;
    index: number;
    ov: any;
    togglePaletteBlock: (paletteIndex: number, block: PaletteOverrideBlock) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
  };

  let { config, index, ov, togglePaletteBlock, updatePaletteOverride }: Props = $props();
</script>

<details class="control-details">
  <summary class="control-details-summary">Bubbles</summary>
  <label class="control-row checkbox">
    <input type="checkbox" checked={!!ov?.bubbles} oninput={() => togglePaletteBlock(index, 'bubbles')} />
    <span class="setting-title">Override bubbles</span>
  </label>

  {#if ov?.bubbles}
    <label class="control-row">
      <span class="setting-title">Mode</span>
      <Dropdown
        value={(ov.bubbles as any)?.mode ?? (config as any).bubbles.mode}
        ariaLabel="Bubble mode"
        options={[
          { value: 'through', label: 'Through' },
          { value: 'cap', label: 'Cap' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), mode: v === 'cap' ? 'cap' : 'through' }
          }));
        }}
      />
    </label>

    <label class="control-row checkbox">
      <input
        type="checkbox"
        checked={!!ov.bubbles.enabled}
        oninput={(e) => {
          const checked = (e.currentTarget as HTMLInputElement).checked;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), enabled: checked }
          }));
        }}
      />
      <span class="setting-title">Enable</span>
    </label>

    <label class="control-row checkbox">
      <input
        type="checkbox"
        checked={!!(ov.bubbles as any)?.interior?.enabled}
        oninput={(e) => {
          const checked = (e.currentTarget as HTMLInputElement).checked;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: {
              ...((cur as any)?.bubbles ?? {}),
              interior: {
                ...(((cur as any)?.bubbles?.interior ?? (config as any).bubbles?.interior ?? {}) as any),
                enabled: checked
              }
            }
          }));
        }}
        disabled={String((ov.bubbles as any)?.mode ?? (config as any).bubbles.mode) !== 'through'}
      />
      <span class="setting-title">Interior surfaces</span>
    </label>

    <label class="control-row slider">
      <span class="setting-title">Samples: {Math.round(Number((ov.bubbles as any)?.count ?? (config as any).bubbles.count))}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.count ?? (config as any).bubbles.count)}
        min="1"
        max="8"
        step="1"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), count: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Frequency: {Number((ov.bubbles as any)?.frequency ?? (config as any).bubbles.frequency).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.frequency ?? (config as any).bubbles.frequency)}
        min="0.2"
        max="8"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), frequency: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Variance: {Number((ov.bubbles as any)?.frequencyVariance ?? (config as any).bubbles.frequencyVariance).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.frequencyVariance ?? (config as any).bubbles.frequencyVariance)}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), frequencyVariance: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Radius min: {Number((ov.bubbles as any)?.radiusMin ?? (config as any).bubbles.radiusMin).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.radiusMin ?? (config as any).bubbles.radiusMin)}
        min="0"
        max="1.5"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), radiusMin: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Radius max: {Number((ov.bubbles as any)?.radiusMax ?? (config as any).bubbles.radiusMax).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.radiusMax ?? (config as any).bubbles.radiusMax)}
        min="0"
        max="2.5"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), radiusMax: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Softness: {Number((ov.bubbles as any)?.softness ?? (config as any).bubbles.softness).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.softness ?? (config as any).bubbles.softness)}
        min="0"
        max="0.5"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), softness: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Wall thickness: {Number((ov.bubbles as any)?.wallThickness ?? (config as any).bubbles.wallThickness).toFixed(2)}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.wallThickness ?? (config as any).bubbles.wallThickness)}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), wallThickness: v }
          }));
        }}
      />
    </label>

    <label class="control-row slider">
      <span class="setting-title">Seed offset: {Math.round(Number((ov.bubbles as any)?.seedOffset ?? (config as any).bubbles.seedOffset))}</span>
      <input
        type="range"
        value={Number((ov.bubbles as any)?.seedOffset ?? (config as any).bubbles.seedOffset)}
        min="-200"
        max="200"
        step="1"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            bubbles: { ...((cur as any)?.bubbles ?? {}), seedOffset: v }
          }));
        }}
      />
    </label>
  {/if}
</details>
