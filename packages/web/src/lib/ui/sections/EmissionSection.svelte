<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    showEmissionSection: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, showEmissionSection, isLocked, toggleLock }: Props = $props();
</script>

{#if showEmissionSection}
  <CollapsiblePanel id="emission" title="Emission" icon="zap" defaultOpen={false}>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.emission.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('emission.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('emission.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>

    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('emission.paletteIndex')}
        onclick={() => toggleLock('emission.paletteIndex')}
        title="Click to lock/unlock for randomize"
      >
        Palette Index
      </button>
      <Dropdown
        bind:value={config.emission.paletteIndex}
        ariaLabel="Emission palette index"
        disabled={!config.emission.enabled}
        options={config.colors.map((c, i) => ({ value: i, label: `${i}: ${c}` }))}
      />
    </label>

    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('emission.intensity')}
        onclick={() => toggleLock('emission.intensity')}
        title="Click to lock/unlock for randomize"
      >
        Intensity: {config.emission.intensity.toFixed(2)}
      </button>
      <input type="range" bind:value={config.emission.intensity} min="0" max="20" step="0.05" disabled={!config.emission.enabled} />
    </label>
  </CollapsiblePanel>
{/if}
