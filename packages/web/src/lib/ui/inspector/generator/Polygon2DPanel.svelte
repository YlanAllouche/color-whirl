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

<CollapsiblePanel id="polygon2d" title="Polygon (2D)" icon="pentagon" defaultOpen={true}>
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.mode')} onclick={() => toggleLock('polygons.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <Dropdown
      bind:value={config.polygons.mode}
      ariaLabel="Polygon mode"
      options={[
        { value: 'scatter', label: 'Scatter' },
        { value: 'grid', label: 'Grid' }
      ]}
    />
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.shape')} onclick={() => toggleLock('polygons.shape')} title="Click to lock/unlock for randomize">Shape</button>
    <Dropdown
      bind:value={config.polygons.shape}
      ariaLabel="Polygon shape"
      options={[
        { value: 'polygon', label: 'Polygon' },
        { value: 'star', label: 'Star' }
      ]}
    />
  </label>

  {#if config.polygons.mode === 'grid'}
    <details class="control-details">
      <summary class="control-details-summary">Grid</summary>
      <label class="control-row">
        <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.kind')} onclick={() => toggleLock('polygons.grid.kind')} title="Click to lock/unlock for randomize">Kind</button>
        <Dropdown
          bind:value={config.polygons.grid.kind}
          ariaLabel="Polygon grid kind"
          options={[
            { value: 'square', label: 'Square' },
            { value: 'diamond', label: 'Diamond' }
          ]}
        />
      </label>

      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.cellPx')} onclick={() => toggleLock('polygons.grid.cellPx')} title="Click to lock/unlock for randomize">Cell: {Math.round(config.polygons.grid.cellPx)}px</button>
        <input type="range" bind:value={config.polygons.grid.cellPx} min="6" max="240" step="1" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.jitter')} onclick={() => toggleLock('polygons.grid.jitter')} title="Click to lock/unlock for randomize">Grid jitter: {config.polygons.grid.jitter.toFixed(2)}</button>
        <input type="range" bind:value={config.polygons.grid.jitter} min="0" max="1" step="0.01" />
      </label>
    </details>
  {/if}

  {#if config.polygons.shape === 'star'}
    <details class="control-details">
      <summary class="control-details-summary">Star</summary>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('polygons.star.innerScale')} onclick={() => toggleLock('polygons.star.innerScale')} title="Click to lock/unlock for randomize">Inner scale: {config.polygons.star.innerScale.toFixed(2)}</button>
        <input type="range" bind:value={config.polygons.star.innerScale} min="0.05" max="0.95" step="0.01" />
      </label>
    </details>
  {/if}

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.count')} onclick={() => toggleLock('polygons.count')} title="Click to lock/unlock for randomize">Count: {config.polygons.count}</button>
    <input type="range" bind:value={config.polygons.count} min="0" max="4000" step="10" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.edges')} onclick={() => toggleLock('polygons.edges')} title="Click to lock/unlock for randomize">Edges: {Math.round(config.polygons.edges)}</button>
    <input type="range" bind:value={config.polygons.edges} min="3" max="16" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.rMinPx')} onclick={() => toggleLock('polygons.rMinPx')} title="Click to lock/unlock for randomize">Radius min: {Math.round(config.polygons.rMinPx)}px</button>
    <input type="range" bind:value={config.polygons.rMinPx} min="1" max="240" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.rMaxPx')} onclick={() => toggleLock('polygons.rMaxPx')} title="Click to lock/unlock for randomize">Radius max: {Math.round(config.polygons.rMaxPx)}px</button>
    <input type="range" bind:value={config.polygons.rMaxPx} min="1" max="420" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.jitter')} onclick={() => toggleLock('polygons.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.polygons.jitter.toFixed(2)}</button>
    <input type="range" bind:value={config.polygons.jitter} min="0" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.rotateJitterDeg')} onclick={() => toggleLock('polygons.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round(config.polygons.rotateJitterDeg)}deg</button>
    <input type="range" bind:value={config.polygons.rotateJitterDeg} min="0" max="360" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('polygons.fillOpacity')} onclick={() => toggleLock('polygons.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.polygons.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.polygons.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.polygons.stroke.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('polygons.stroke.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('polygons.stroke.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.widthPx')} onclick={() => toggleLock('polygons.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.polygons.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.polygons.stroke.widthPx} min="0" max="24" step="1" disabled={!config.polygons.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.color')} onclick={() => toggleLock('polygons.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.polygons.stroke.color} disabled={!config.polygons.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.opacity')} onclick={() => toggleLock('polygons.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.polygons.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.polygons.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.polygons.stroke.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('polygons.paletteMode')} onclick={() => toggleLock('polygons.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.polygons.paletteMode}
        ariaLabel="Polygon palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>

    {#if config.polygons.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('polygons')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('polygons')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('polygons.colorWeights')} onclick={() => toggleLock('polygons.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.polygons.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.polygons.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('polygons', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
