<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: WallpaperConfig;
    RESOLUTION_PRESETS: Record<string, { width: number; height: number }>;
    applyResolutionPreset: (preset: string) => void;
  };

  let { config, RESOLUTION_PRESETS, applyResolutionPreset }: Props = $props();
</script>

<CollapsiblePanel id="resolution" title="Resolution" icon="monitor" defaultOpen={false} searchKeys="size width height">
  <div class="preset-buttons">
    {#each Object.keys(RESOLUTION_PRESETS) as preset}
      <button type="button" onclick={() => applyResolutionPreset(preset)}>{preset}</button>
    {/each}
  </div>
  <div class="input-row">
    <label>
      <span>W</span>
      <input type="number" bind:value={config.width} min="100" max="8000" />
    </label>
    <label>
      <span>H</span>
      <input type="number" bind:value={config.height} min="100" max="8000" />
    </label>
  </div>
</CollapsiblePanel>
