<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: any;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    setEqualWeights: (target: any) => void;
    setRandomWeights: (target: any) => void;
    updateWeight: (target: any, index: number, value: number) => void;
  };

  let { config, isLocked, toggleLock, setEqualWeights, setRandomWeights, updateWeight }: Props = $props();
</script>

<CollapsiblePanel id="circles2d" title="Circles (2D)" icon="circle" defaultOpen={true} searchKeys="rings">
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('circles.mode')} onclick={() => toggleLock('circles.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <Dropdown
      bind:value={config.circles.mode}
      ariaLabel="Circle mode"
      options={[
        { value: 'scatter', label: 'Scatter' },
        { value: 'grid', label: 'Grid' }
      ]}
    />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('circles.count')} onclick={() => toggleLock('circles.count')} title="Click to lock/unlock for randomize">Count: {config.circles.count}</button>
    <input type="range" bind:value={config.circles.count} min="0" max="4000" step="10" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('circles.rMinPx')} onclick={() => toggleLock('circles.rMinPx')} title="Click to lock/unlock for randomize">Radius min: {Math.round(config.circles.rMinPx)}px</button>
    <input type="range" bind:value={config.circles.rMinPx} min="1" max="240" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('circles.rMaxPx')} onclick={() => toggleLock('circles.rMaxPx')} title="Click to lock/unlock for randomize">Radius max: {Math.round(config.circles.rMaxPx)}px</button>
    <input type="range" bind:value={config.circles.rMaxPx} min="1" max="420" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('circles.jitter')} onclick={() => toggleLock('circles.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.circles.jitter.toFixed(2)}</button>
    <input type="range" bind:value={config.circles.jitter} min="0" max="1" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('circles.fillOpacity')} onclick={() => toggleLock('circles.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.circles.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.circles.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.circles.stroke.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('circles.stroke.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('circles.stroke.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.widthPx')} onclick={() => toggleLock('circles.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.circles.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.circles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.circles.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.color')} onclick={() => toggleLock('circles.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.circles.stroke.color} disabled={!config.circles.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.opacity')} onclick={() => toggleLock('circles.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.circles.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.circles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.circles.stroke.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Croissant</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.circles.croissant.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('circles.croissant.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('circles.croissant.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.innerScale')} onclick={() => toggleLock('circles.croissant.innerScale')} title="Click to lock/unlock for randomize">Inner scale: {config.circles.croissant.innerScale.toFixed(2)}</button>
      <input type="range" bind:value={config.circles.croissant.innerScale} min="0.05" max="0.98" step="0.01" disabled={!config.circles.croissant.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.offset')} onclick={() => toggleLock('circles.croissant.offset')} title="Click to lock/unlock for randomize">Offset: {config.circles.croissant.offset.toFixed(2)}</button>
      <input type="range" bind:value={config.circles.croissant.offset} min="0" max="1" step="0.01" disabled={!config.circles.croissant.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.angleJitterDeg')} onclick={() => toggleLock('circles.croissant.angleJitterDeg')} title="Click to lock/unlock for randomize">Angle jitter: {Math.round(config.circles.croissant.angleJitterDeg)}deg</button>
      <input type="range" bind:value={config.circles.croissant.angleJitterDeg} min="0" max="180" step="1" disabled={!config.circles.croissant.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('circles.paletteMode')} onclick={() => toggleLock('circles.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.circles.paletteMode}
        ariaLabel="Circle palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>

    {#if config.circles.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('circles')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('circles')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('circles.colorWeights')} onclick={() => toggleLock('circles.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.circles.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.circles.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('circles', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
