<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, is3DType, isLocked, toggleLock }: Props = $props();
</script>

{#if is3DType}
  <CollapsiblePanel id="camera" title="Camera" icon="camera" defaultOpen={false}>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.azimuth')}
        onclick={() => toggleLock('camera.azimuth')}
        title="Click to lock/unlock for randomize"
      >
        Azimuth: {config.camera.azimuth}°
      </button>
      <input type="range" bind:value={config.camera.azimuth} min="0" max="360" step="5" />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.elevation')}
        onclick={() => toggleLock('camera.elevation')}
        title="Click to lock/unlock for randomize"
      >
        Elevation: {config.camera.elevation}°
      </button>
      <input type="range" bind:value={config.camera.elevation} min="-80" max="80" step="5" />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.distance')}
        onclick={() => toggleLock('camera.distance')}
        title="Click to lock/unlock for randomize"
      >
        Distance: {config.camera.distance.toFixed(1)}
      </button>
      <input type="range" bind:value={config.camera.distance} min="5" max="50" step="0.1" />
    </label>
  </CollapsiblePanel>
{/if}
