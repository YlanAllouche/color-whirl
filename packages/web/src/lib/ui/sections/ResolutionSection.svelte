<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';

  type Props = {
    config: WallpaperConfig;
    RESOLUTION_PRESETS: Record<string, { width: number; height: number }>;
    applyResolutionPreset: (preset: string) => void;
  };

  let { config, RESOLUTION_PRESETS, applyResolutionPreset }: Props = $props();
</script>

<!-- Resolution Controls -->
<section class="control-section">
  <h3>Resolution</h3>
  <div class="preset-buttons">
    {#each Object.keys(RESOLUTION_PRESETS) as preset}
      <button onclick={() => applyResolutionPreset(preset)}>{preset}</button>
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
</section>
