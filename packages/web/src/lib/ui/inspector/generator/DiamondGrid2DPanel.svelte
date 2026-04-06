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

<CollapsiblePanel id="diamondgrid2d" title="Diamond Grid (2D)" icon="grid-3x3" defaultOpen={true}>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.tileWidthPx')} onclick={() => toggleLock('diamondgrid.tileWidthPx')} title="Click to lock/unlock for randomize">Tile width: {Math.round(config.diamondgrid.tileWidthPx)}px</button>
    <input type="range" bind:value={config.diamondgrid.tileWidthPx} min="8" max="520" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.tileHeightPx')} onclick={() => toggleLock('diamondgrid.tileHeightPx')} title="Click to lock/unlock for randomize">Tile height: {Math.round(config.diamondgrid.tileHeightPx)}px</button>
    <input type="range" bind:value={config.diamondgrid.tileHeightPx} min="8" max="360" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.marginPx')} onclick={() => toggleLock('diamondgrid.marginPx')} title="Click to lock/unlock for randomize">Margin: {Math.round(config.diamondgrid.marginPx)}px</button>
    <input type="range" bind:value={config.diamondgrid.marginPx} min="0" max="40" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.fillOpacity')} onclick={() => toggleLock('diamondgrid.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.diamondgrid.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.diamondgrid.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Bevel</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.diamondgrid.bevel.enabled} />
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('diamondgrid.bevel.enabled'); }} title="Click to lock/unlock for randomize">Enable</button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.amount')} onclick={() => toggleLock('diamondgrid.bevel.amount')} title="Click to lock/unlock for randomize">Amount: {config.diamondgrid.bevel.amount.toFixed(2)}</button>
      <input type="range" bind:value={config.diamondgrid.bevel.amount} min="0" max="1" step="0.01" disabled={!config.diamondgrid.bevel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.lightDeg')} onclick={() => toggleLock('diamondgrid.bevel.lightDeg')} title="Click to lock/unlock for randomize">Light angle: {Math.round(config.diamondgrid.bevel.lightDeg)}°</button>
      <input type="range" bind:value={config.diamondgrid.bevel.lightDeg} min="0" max="360" step="1" disabled={!config.diamondgrid.bevel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.variation')} onclick={() => toggleLock('diamondgrid.bevel.variation')} title="Click to lock/unlock for randomize">Variation: {config.diamondgrid.bevel.variation.toFixed(2)}</button>
      <input type="range" bind:value={config.diamondgrid.bevel.variation} min="0" max="1" step="0.01" disabled={!config.diamondgrid.bevel.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Sparkles</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.diamondgrid.sparkles.enabled} />
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('diamondgrid.sparkles.enabled'); }} title="Click to lock/unlock for randomize">Enable</button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.density')} onclick={() => toggleLock('diamondgrid.sparkles.density')} title="Click to lock/unlock for randomize">Density: {config.diamondgrid.sparkles.density.toFixed(3)}</button>
      <input type="range" bind:value={config.diamondgrid.sparkles.density} min="0" max="0.5" step="0.001" disabled={!config.diamondgrid.sparkles.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.countMax')} onclick={() => toggleLock('diamondgrid.sparkles.countMax')} title="Click to lock/unlock for randomize">Count max: {config.diamondgrid.sparkles.countMax}</button>
      <input type="range" bind:value={config.diamondgrid.sparkles.countMax} min="1" max="12" step="1" disabled={!config.diamondgrid.sparkles.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.sizeMaxPx')} onclick={() => toggleLock('diamondgrid.sparkles.sizeMaxPx')} title="Click to lock/unlock for randomize">Size max: {config.diamondgrid.sparkles.sizeMaxPx.toFixed(1)}px</button>
      <input type="range" bind:value={config.diamondgrid.sparkles.sizeMaxPx} min="1" max="60" step="0.5" disabled={!config.diamondgrid.sparkles.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.opacity')} onclick={() => toggleLock('diamondgrid.sparkles.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.diamondgrid.sparkles.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.diamondgrid.sparkles.opacity} min="0" max="1" step="0.01" disabled={!config.diamondgrid.sparkles.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.coloring.paletteMode')} onclick={() => toggleLock('diamondgrid.coloring.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.diamondgrid.coloring.paletteMode}
        ariaLabel="Diamond grid palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>
    {#if config.diamondgrid.coloring.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('diamondgrid')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('diamondgrid')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.coloring.colorWeights')} onclick={() => toggleLock('diamondgrid.coloring.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.diamondgrid.coloring.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input type="range" min="0" max="5" step="0.05" value={config.diamondgrid.coloring.colorWeights[i] ?? 1} oninput={(e) => updateWeight('diamondgrid', i, Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
