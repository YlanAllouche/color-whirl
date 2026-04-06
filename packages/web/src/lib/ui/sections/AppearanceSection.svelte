<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, is3DType, isLocked, toggleLock }: Props = $props();
</script>

{#if is3DType}
  <CollapsiblePanel id="appearance" title="Appearance" icon="sliders-horizontal" defaultOpen={true}>
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('texture')}
        onclick={() => toggleLock('texture')}
        title="Click to lock/unlock for randomize"
      >
        Texture
      </button>
      <Dropdown
        bind:value={config.texture}
        ariaLabel="Texture"
        options={[
          { value: 'glossy', label: 'Glossy' },
          { value: 'matte', label: 'Matte' },
          { value: 'metallic', label: 'Metallic' },
          { value: 'drywall', label: 'Drywall' },
          { value: 'glass', label: 'Glass' },
          { value: 'mirror', label: 'Mirror' },
          { value: 'cel', label: 'Cel' }
        ]}
      />
    </label>

    {#if config.texture === 'drywall'}
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('textureParams.drywall.grainAmount')}
          onclick={() => toggleLock('textureParams.drywall.grainAmount')}
          title="Click to lock/unlock for randomize"
        >
          Grain: {config.textureParams.drywall.grainAmount.toFixed(2)}
        </button>
        <input type="range" bind:value={config.textureParams.drywall.grainAmount} min="0" max="1" step="0.01" />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('textureParams.drywall.grainScale')}
          onclick={() => toggleLock('textureParams.drywall.grainScale')}
          title="Click to lock/unlock for randomize"
        >
          Grain Scale: {config.textureParams.drywall.grainScale.toFixed(2)}
        </button>
        <input type="range" bind:value={config.textureParams.drywall.grainScale} min="0.5" max="8" step="0.05" />
      </label>
    {/if}

    {#if config.texture === 'glass'}
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('textureParams.glass.style')}
          onclick={() => toggleLock('textureParams.glass.style')}
          title="Click to lock/unlock for randomize"
        >
          Glass Style
        </button>
        <Dropdown
          bind:value={config.textureParams.glass.style}
          ariaLabel="Glass style"
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'frosted', label: 'Frosted' },
            { value: 'thick', label: 'Thick' },
            { value: 'stylized', label: 'Stylized' }
          ]}
        />
      </label>
    {/if}

    {#if config.texture === 'cel'}
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('textureParams.cel.bands')}
          onclick={() => toggleLock('textureParams.cel.bands')}
          title="Click to lock/unlock for randomize"
        >
          Bands: {Math.round(config.textureParams.cel.bands)}
        </button>
        <input type="range" bind:value={config.textureParams.cel.bands} min="2" max="8" step="1" />
      </label>
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.textureParams.cel.halftone} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('textureParams.cel.halftone')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('textureParams.cel.halftone');
          }}
          title="Click to lock/unlock for randomize"
        >
          Halftone
        </button>
      </label>
    {/if}

    <!-- Voronoi moved to its own top-level section -->
  </CollapsiblePanel>
{/if}
