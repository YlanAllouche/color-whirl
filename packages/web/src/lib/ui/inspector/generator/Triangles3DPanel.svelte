<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

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

<CollapsiblePanel id="triangles3d" title="Triangles (3D)" icon="triangle" defaultOpen={true}>
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.mode')} onclick={() => toggleLock('prisms.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <select bind:value={config.prisms.mode}>
      <option value="tessellation">Tessellation</option>
      <option value="scatter">Scatter</option>
      <option value="stackedPrisms">Stacked prisms</option>
    </select>
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.base')} onclick={() => toggleLock('prisms.base')} title="Click to lock/unlock for randomize">Shape</button>
    <select bind:value={config.prisms.base}>
      <option value="prism">Prism</option>
      <option value="pyramidTri">Pyramid (tri)</option>
      <option value="pyramidSquare">Pyramid (square)</option>
    </select>
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.count')} onclick={() => toggleLock('prisms.count')} title="Click to lock/unlock for randomize">Count: {config.prisms.count}</button>
    <input type="range" bind:value={config.prisms.count} min="0" max="2500" step="10" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.radius')} onclick={() => toggleLock('prisms.radius')} title="Click to lock/unlock for randomize">Radius: {config.prisms.radius.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.radius} min="0.05" max="2.0" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.height')} onclick={() => toggleLock('prisms.height')} title="Click to lock/unlock for randomize">Height: {config.prisms.height.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.height} min="0.02" max="3.0" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.taper')} onclick={() => toggleLock('prisms.taper')} title="Click to lock/unlock for randomize">Taper: {config.prisms.taper.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.taper} min="0" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.wallBulgeX')} onclick={() => toggleLock('prisms.wallBulgeX')} title="Click to lock/unlock for randomize">Wall bulge X: {config.prisms.wallBulgeX.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.wallBulgeX} min="-1" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.wallBulgeY')} onclick={() => toggleLock('prisms.wallBulgeY')} title="Click to lock/unlock for randomize">Wall bulge Y: {config.prisms.wallBulgeY.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.wallBulgeY} min="-1" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.spread')} onclick={() => toggleLock('prisms.spread')} title="Click to lock/unlock for randomize">Spread: {config.prisms.spread.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.spread} min="0" max="20" step="0.05" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.jitter')} onclick={() => toggleLock('prisms.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.prisms.jitter.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.jitter} min="0" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('prisms.opacity')} onclick={() => toggleLock('prisms.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.prisms.opacity.toFixed(2)}</button>
    <input type="range" bind:value={config.prisms.opacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('prisms.paletteMode')} onclick={() => toggleLock('prisms.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <select bind:value={config.prisms.paletteMode}>
        <option value="cycle">Cycle</option>
        <option value="weighted">Weighted</option>
      </select>
    </label>

    {#if config.prisms.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('prisms')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('prisms')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('prisms.colorWeights')} onclick={() => toggleLock('prisms.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.prisms.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.prisms.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('prisms', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
