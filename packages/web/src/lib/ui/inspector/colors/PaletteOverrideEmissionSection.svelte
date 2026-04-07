<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
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
  <summary class="control-details-summary">Emission</summary>
  <label class="control-row checkbox">
    <input type="checkbox" checked={!!ov?.emission} oninput={() => togglePaletteBlock(index, 'emission')} />
    <span class="setting-title">Override emission</span>
  </label>

  {#if ov?.emission}
    <label class="control-row checkbox">
      <input
        type="checkbox"
        checked={!!ov.emission.enabled}
        oninput={(e) => {
          const checked = (e.currentTarget as HTMLInputElement).checked;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            emission: { ...(cur?.emission ?? {}), enabled: checked }
          }));
        }}
      />
      <span class="setting-title">Emit</span>
    </label>
    <label class="control-row slider">
      <span class="setting-title">Intensity: {Number(ov.emission.intensity ?? config.emission.intensity).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.emission.intensity ?? config.emission.intensity)}
        min="0"
        max="20"
        step="0.05"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            emission: { ...(cur?.emission ?? {}), intensity: v }
          }));
        }}
      />
    </label>
  {/if}
</details>
