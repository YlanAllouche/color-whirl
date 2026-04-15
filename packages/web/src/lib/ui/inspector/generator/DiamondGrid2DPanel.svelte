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

<CollapsiblePanel id="diamondgrid2d" title="Diamond Grid (2D)" icon="grid-3x3" defaultOpen={true} searchKeys="lozenge">
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
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.overscanPx')} onclick={() => toggleLock('diamondgrid.overscanPx')} title="Click to lock/unlock for randomize">Overscan: {Math.round(config.diamondgrid.overscanPx)}px</button>
    <input type="range" bind:value={config.diamondgrid.overscanPx} min="0" max="400" step="5" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.fillOpacity')} onclick={() => toggleLock('diamondgrid.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.diamondgrid.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.diamondgrid.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Origin</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.originPx.x')} onclick={() => toggleLock('diamondgrid.originPx.x')} title="Click to lock/unlock for randomize">X: {Math.round(config.diamondgrid.originPx.x)}px</button>
      <input type="range" bind:value={config.diamondgrid.originPx.x} min="-500" max="500" step="1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.originPx.y')} onclick={() => toggleLock('diamondgrid.originPx.y')} title="Click to lock/unlock for randomize">Y: {Math.round(config.diamondgrid.originPx.y)}px</button>
      <input type="range" bind:value={config.diamondgrid.originPx.y} min="-500" max="500" step="1" />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.diamondgrid.stroke.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('diamondgrid.stroke.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('diamondgrid.stroke.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.stroke.widthPx')} onclick={() => toggleLock('diamondgrid.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.diamondgrid.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.diamondgrid.stroke.widthPx} min="0" max="24" step="1" disabled={!config.diamondgrid.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.stroke.join')} onclick={() => toggleLock('diamondgrid.stroke.join')} title="Click to lock/unlock for randomize">Join</button>
      <Dropdown
        bind:value={config.diamondgrid.stroke.join}
        ariaLabel="Diamond grid stroke join"
        disabled={!config.diamondgrid.stroke.enabled}
        options={[
          { value: 'round', label: 'Round' },
          { value: 'miter', label: 'Miter' },
          { value: 'bevel', label: 'Bevel' }
        ]}
      />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.stroke.color')} onclick={() => toggleLock('diamondgrid.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.diamondgrid.stroke.color} disabled={!config.diamondgrid.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.stroke.opacity')} onclick={() => toggleLock('diamondgrid.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.diamondgrid.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.diamondgrid.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.diamondgrid.stroke.enabled} />
    </label>
  </details>

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
