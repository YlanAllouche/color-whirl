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
  <CollapsiblePanel id="lighting" title="Lighting" icon="sun" defaultOpen={false} searchKeys="light shadows">
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.lighting.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('lighting.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('lighting.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable Lighting
      </button>
    </label>
    {#if config.lighting.enabled}
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('lighting.intensity')}
          onclick={() => toggleLock('lighting.intensity')}
          title="Click to lock/unlock for randomize"
        >
          Intensity: {config.lighting.intensity.toFixed(1)}
        </button>
        <input type="range" bind:value={config.lighting.intensity} min="0" max="3" step="0.1" />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('lighting.position.x')}
          onclick={() => toggleLock('lighting.position.x')}
          title="Click to lock/unlock for randomize"
        >
          Position X: {config.lighting.position.x}
        </button>
        <input type="range" bind:value={config.lighting.position.x} min="-10" max="10" step="0.5" />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('lighting.position.y')}
          onclick={() => toggleLock('lighting.position.y')}
          title="Click to lock/unlock for randomize"
        >
          Position Y: {config.lighting.position.y}
        </button>
        <input type="range" bind:value={config.lighting.position.y} min="-10" max="10" step="0.5" />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('lighting.position.z')}
          onclick={() => toggleLock('lighting.position.z')}
          title="Click to lock/unlock for randomize"
        >
          Position Z: {config.lighting.position.z}
        </button>
        <input type="range" bind:value={config.lighting.position.z} min="0" max="20" step="0.5" />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('lighting.ambientIntensity')}
          onclick={() => toggleLock('lighting.ambientIntensity')}
          title="Click to lock/unlock for randomize"
        >
          Ambient: {config.lighting.ambientIntensity.toFixed(1)}
        </button>
        <input type="range" bind:value={config.lighting.ambientIntensity} min="0" max="1" step="0.1" />
      </label>
    {/if}
  </CollapsiblePanel>
{/if}
