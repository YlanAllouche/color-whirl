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
      <select bind:value={config.texture}>
        <option value="glossy">Glossy</option>
        <option value="matte">Matte</option>
        <option value="metallic">Metallic</option>
        <option value="drywall">Drywall</option>
        <option value="glass">Glass</option>
        <option value="mirror">Mirror</option>
        <option value="cel">Cel</option>
      </select>
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
        <select bind:value={config.textureParams.glass.style}>
          <option value="simple">Simple</option>
          <option value="frosted">Frosted</option>
          <option value="thick">Thick</option>
          <option value="stylized">Stylized</option>
        </select>
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
