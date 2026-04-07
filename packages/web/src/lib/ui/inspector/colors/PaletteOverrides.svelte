<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import PaletteOverrideItem from './PaletteOverrideItem.svelte';
  import type { PaletteOverrideBlock } from './paletteOverrideTypes';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (paletteIndex: number, block: PaletteOverrideBlock) => void;
  };

  let { config, is3DType, supportsEmission, togglePaletteOverride, updatePaletteOverride, togglePaletteBlock }: Props =
    $props();
</script>

<details class="control-details">
  <summary class="control-details-summary">Per-color overrides</summary>
  <div class="palette-overrides">
    {#each config.colors as color, index}
      <PaletteOverrideItem
        {config}
        {color}
        {index}
        {is3DType}
        {supportsEmission}
        {togglePaletteOverride}
        {updatePaletteOverride}
        {togglePaletteBlock}
      />
    {/each}
  </div>
</details>
