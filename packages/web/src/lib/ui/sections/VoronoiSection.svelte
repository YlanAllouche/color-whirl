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
  <CollapsiblePanel id="voronoi" title="Voronoi" icon="grid-3x3" defaultOpen={false} searchKeys="cells foam">
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={(config as any).voronoi.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('voronoi.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('voronoi.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.space')} onclick={() => toggleLock('voronoi.space')} title="Click to lock/unlock for randomize">
        Space
      </button>
      <Dropdown
        bind:value={(config as any).voronoi.space}
        ariaLabel="Voronoi space"
        disabled={!((config as any).voronoi.enabled)}
        options={[
          { value: 'world', label: 'World' },
          { value: 'object', label: 'Object' }
        ]}
      />
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.kind')} onclick={() => toggleLock('voronoi.kind')} title="Click to lock/unlock for randomize">
        Kind
      </button>
      <Dropdown
        bind:value={(config as any).voronoi.kind}
        ariaLabel="Voronoi kind"
        disabled={!((config as any).voronoi.enabled)}
        options={[
          { value: 'edges', label: 'Edges' },
          { value: 'cells', label: 'Cells' }
        ]}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.scale')} onclick={() => toggleLock('voronoi.scale')} title="Click to lock/unlock for randomize">
        Scale: {Number((config as any).voronoi.scale).toFixed(2)}
      </button>
      <input type="range" bind:value={(config as any).voronoi.scale} min="0.1" max="30" step="0.1" disabled={!((config as any).voronoi.enabled)} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.seedOffset')} onclick={() => toggleLock('voronoi.seedOffset')} title="Click to lock/unlock for randomize">
        Seed offset: {Math.round(Number((config as any).voronoi.seedOffset) || 0)}
      </button>
      <input type="range" bind:value={(config as any).voronoi.seedOffset} min="-200" max="200" step="1" disabled={!((config as any).voronoi.enabled)} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.amount')} onclick={() => toggleLock('voronoi.amount')} title="Click to lock/unlock for randomize">
        Amount: {Number((config as any).voronoi.amount).toFixed(2)}
      </button>
      <input type="range" bind:value={(config as any).voronoi.amount} min="0" max="1" step="0.01" disabled={!((config as any).voronoi.enabled)} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.edgeWidth')} onclick={() => toggleLock('voronoi.edgeWidth')} title="Click to lock/unlock for randomize">
        Edge width: {Number((config as any).voronoi.edgeWidth).toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.edgeWidth}
        min="0"
        max="1"
        step="0.01"
        disabled={!((config as any).voronoi.enabled) || ((config as any).voronoi.kind !== 'edges' && (config as any).voronoi.materialKind !== 'edges')}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.softness')} onclick={() => toggleLock('voronoi.softness')} title="Click to lock/unlock for randomize">
        Softness: {Number((config as any).voronoi.softness).toFixed(2)}
      </button>
      <input type="range" bind:value={(config as any).voronoi.softness} min="0" max="1" step="0.01" disabled={!((config as any).voronoi.enabled)} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.crackleAmount')} onclick={() => toggleLock('voronoi.crackleAmount')} title="Click to lock/unlock for randomize">
        Crackle: {Number((config as any).voronoi.crackleAmount).toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.crackleAmount}
        min="0"
        max="1"
        step="0.01"
        disabled={!((config as any).voronoi.enabled) || ((config as any).voronoi.kind !== 'edges' && (config as any).voronoi.materialKind !== 'edges')}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.crackleScale')} onclick={() => toggleLock('voronoi.crackleScale')} title="Click to lock/unlock for randomize">
        Crackle scale: {Number((config as any).voronoi.crackleScale).toFixed(1)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.crackleScale}
        min="0.5"
        max="24"
        step="0.1"
        disabled={!((config as any).voronoi.enabled) || !((config as any).voronoi.crackleAmount > 0) || ((config as any).voronoi.kind !== 'edges' && (config as any).voronoi.materialKind !== 'edges')}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.colorStrength')} onclick={() => toggleLock('voronoi.colorStrength')} title="Click to lock/unlock for randomize">
        Color strength: {Number((config as any).voronoi.colorStrength).toFixed(2)}
      </button>
      <input type="range" bind:value={(config as any).voronoi.colorStrength} min="0" max="1" step="0.01" disabled={!((config as any).voronoi.enabled)} />
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.materialMode')} onclick={() => toggleLock('voronoi.materialMode')} title="Click to lock/unlock for randomize">
        Material
      </button>
      <Dropdown
        bind:value={(config as any).voronoi.materialMode}
        ariaLabel="Voronoi material"
        disabled={!((config as any).voronoi.enabled)}
        options={[
          { value: 'none', label: 'None' },
          { value: 'roughness', label: 'Roughness' },
          { value: 'normal', label: 'Normal' },
          { value: 'both', label: 'Both' }
        ]}
      />
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.materialKind')} onclick={() => toggleLock('voronoi.materialKind')} title="Click to lock/unlock for randomize">
        Material kind
      </button>
      <Dropdown
        bind:value={(config as any).voronoi.materialKind}
        ariaLabel="Voronoi material kind"
        disabled={!((config as any).voronoi.enabled)}
        options={[
          { value: 'match', label: 'Match kind' },
          { value: 'edges', label: 'Edges' },
          { value: 'cells', label: 'Cells' }
        ]}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.roughnessStrength')} onclick={() => toggleLock('voronoi.roughnessStrength')} title="Click to lock/unlock for randomize">
        Roughness feel: {Number((config as any).voronoi.roughnessStrength).toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.roughnessStrength}
        min="0"
        max="1"
        step="0.01"
        disabled={!((config as any).voronoi.enabled) || ['none', 'normal'].includes((config as any).voronoi.materialMode)}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.normalStrength')} onclick={() => toggleLock('voronoi.normalStrength')} title="Click to lock/unlock for randomize">
        Normal feel: {Number((config as any).voronoi.normalStrength).toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.normalStrength}
        min="0"
        max="1"
        step="0.01"
        disabled={!((config as any).voronoi.enabled) || ['none', 'roughness'].includes((config as any).voronoi.materialMode)}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.normalScale')} onclick={() => toggleLock('voronoi.normalScale')} title="Click to lock/unlock for randomize">
        Normal scale: {Number((config as any).voronoi.normalScale).toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={(config as any).voronoi.normalScale}
        min="0"
        max="1"
        step="0.01"
        disabled={!((config as any).voronoi.enabled) || ['none', 'roughness'].includes((config as any).voronoi.materialMode)}
      />
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.colorMode')} onclick={() => toggleLock('voronoi.colorMode')} title="Click to lock/unlock for randomize">
        Color mode
      </button>
      <Dropdown
        bind:value={(config as any).voronoi.colorMode}
        ariaLabel="Voronoi color mode"
        disabled={!((config as any).voronoi.enabled)}
        options={[
          { value: 'darken', label: 'Darken' },
          { value: 'lighten', label: 'Lighten' },
          { value: 'tint', label: 'Tint' }
        ]}
      />
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('voronoi.tintColor')} onclick={() => toggleLock('voronoi.tintColor')} title="Click to lock/unlock for randomize">
        Tint color
      </button>
      <input type="color" bind:value={(config as any).voronoi.tintColor} disabled={!((config as any).voronoi.enabled) || (config as any).voronoi.colorMode !== 'tint'} />
    </label>

    <div class="divider">
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={(config as any).voronoi.nucleus.enabled} disabled={!((config as any).voronoi.enabled)} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('voronoi.nucleus.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('voronoi.nucleus.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Nucleus
        </button>
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('voronoi.nucleus.size')} onclick={() => toggleLock('voronoi.nucleus.size')} title="Click to lock/unlock for randomize">
          Nucleus size: {Number((config as any).voronoi.nucleus.size).toFixed(2)}
        </button>
        <input type="range" bind:value={(config as any).voronoi.nucleus.size} min="0" max="0.5" step="0.01" disabled={!((config as any).voronoi.enabled) || !((config as any).voronoi.nucleus.enabled)} />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('voronoi.nucleus.softness')} onclick={() => toggleLock('voronoi.nucleus.softness')} title="Click to lock/unlock for randomize">
          Nucleus softness: {Number((config as any).voronoi.nucleus.softness).toFixed(2)}
        </button>
        <input type="range" bind:value={(config as any).voronoi.nucleus.softness} min="0" max="1" step="0.01" disabled={!((config as any).voronoi.enabled) || !((config as any).voronoi.nucleus.enabled)} />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('voronoi.nucleus.strength')} onclick={() => toggleLock('voronoi.nucleus.strength')} title="Click to lock/unlock for randomize">
          Nucleus strength: {Number((config as any).voronoi.nucleus.strength).toFixed(2)}
        </button>
        <input type="range" bind:value={(config as any).voronoi.nucleus.strength} min="0" max="1" step="0.01" disabled={!((config as any).voronoi.enabled) || !((config as any).voronoi.nucleus.enabled)} />
      </label>
      <label class="control-row">
        <button type="button" class="setting-title" class:locked={isLocked('voronoi.nucleus.color')} onclick={() => toggleLock('voronoi.nucleus.color')} title="Click to lock/unlock for randomize">
          Nucleus color
        </button>
        <input type="color" bind:value={(config as any).voronoi.nucleus.color} disabled={!((config as any).voronoi.enabled) || !((config as any).voronoi.nucleus.enabled)} />
      </label>
    </div>
  </CollapsiblePanel>
{/if}
