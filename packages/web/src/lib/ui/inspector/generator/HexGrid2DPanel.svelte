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

<CollapsiblePanel id="hexgrid2d" title="Hex Grid (2D)" icon="hexagon" defaultOpen={true}>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('hexgrid.radiusPx')} onclick={() => toggleLock('hexgrid.radiusPx')} title="Click to lock/unlock for randomize">Radius: {Math.round(config.hexgrid.radiusPx)}px</button>
    <input type="range" bind:value={config.hexgrid.radiusPx} min="3" max="140" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('hexgrid.marginPx')} onclick={() => toggleLock('hexgrid.marginPx')} title="Click to lock/unlock for randomize">Margin: {Math.round(config.hexgrid.marginPx)}px</button>
    <input type="range" bind:value={config.hexgrid.marginPx} min="0" max="60" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('hexgrid.overscanPx')} onclick={() => toggleLock('hexgrid.overscanPx')} title="Click to lock/unlock for randomize">Overscan: {Math.round(config.hexgrid.overscanPx)}px</button>
    <input type="range" bind:value={config.hexgrid.overscanPx} min="0" max="400" step="5" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('hexgrid.fillOpacity')} onclick={() => toggleLock('hexgrid.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.hexgrid.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.hexgrid.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Origin</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.originPx.x')} onclick={() => toggleLock('hexgrid.originPx.x')} title="Click to lock/unlock for randomize">X: {Math.round(config.hexgrid.originPx.x)}px</button>
      <input type="range" bind:value={config.hexgrid.originPx.x} min="-500" max="500" step="1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.originPx.y')} onclick={() => toggleLock('hexgrid.originPx.y')} title="Click to lock/unlock for randomize">Y: {Math.round(config.hexgrid.originPx.y)}px</button>
      <input type="range" bind:value={config.hexgrid.originPx.y} min="-500" max="500" step="1" />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.hexgrid.stroke.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('hexgrid.stroke.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('hexgrid.stroke.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.widthPx')} onclick={() => toggleLock('hexgrid.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.hexgrid.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.hexgrid.stroke.widthPx} min="0" max="24" step="1" disabled={!config.hexgrid.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.join')} onclick={() => toggleLock('hexgrid.stroke.join')} title="Click to lock/unlock for randomize">Join</button>
      <select bind:value={config.hexgrid.stroke.join} disabled={!config.hexgrid.stroke.enabled}>
        <option value="round">Round</option>
        <option value="miter">Miter</option>
        <option value="bevel">Bevel</option>
      </select>
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.color')} onclick={() => toggleLock('hexgrid.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.hexgrid.stroke.color} disabled={!config.hexgrid.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.opacity')} onclick={() => toggleLock('hexgrid.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.hexgrid.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.hexgrid.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.hexgrid.stroke.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Coloring</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.paletteMode')} onclick={() => toggleLock('hexgrid.coloring.paletteMode')} title="Click to lock/unlock for randomize">Palette mode</button>
      <select bind:value={config.hexgrid.coloring.paletteMode}>
        <option value="cycle">Cycle</option>
        <option value="weighted">Weighted</option>
      </select>
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.weightsMode')} onclick={() => toggleLock('hexgrid.coloring.weightsMode')} title="Click to lock/unlock for randomize">Weights</button>
      <select bind:value={config.hexgrid.coloring.weightsMode}>
        <option value="auto">Auto</option>
        <option value="preset">Preset</option>
        <option value="custom">Custom</option>
      </select>
    </label>

    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.preset')} onclick={() => toggleLock('hexgrid.coloring.preset')} title="Click to lock/unlock for randomize">Preset</button>
      <select bind:value={config.hexgrid.coloring.preset} disabled={config.hexgrid.coloring.weightsMode !== 'preset'}>
        <option value="equal">Equal</option>
        <option value="dominant">Dominant</option>
        <option value="accents">Accents</option>
        <option value="rare-accents">Rare accents</option>
      </select>
    </label>

    {#if config.hexgrid.coloring.weightsMode === 'custom'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('hexgrid')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('hexgrid')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.weights')} onclick={() => toggleLock('hexgrid.coloring.weights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.hexgrid.coloring.weights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.hexgrid.coloring.weights[i] ?? 1}
            oninput={(e) => {
              updateWeight('hexgrid', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Grouping</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.mode')} onclick={() => toggleLock('hexgrid.grouping.mode')} title="Click to lock/unlock for randomize">Mode</button>
      <select bind:value={config.hexgrid.grouping.mode}>
        <option value="none">None</option>
        <option value="voronoi">Voronoi</option>
        <option value="noise">Noise</option>
        <option value="random-walk">Random walk</option>
      </select>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.strength')} onclick={() => toggleLock('hexgrid.grouping.strength')} title="Click to lock/unlock for randomize">Strength: {config.hexgrid.grouping.strength.toFixed(2)}</button>
      <input type="range" bind:value={config.hexgrid.grouping.strength} min="0" max="1" step="0.01" disabled={config.hexgrid.grouping.mode === 'none'} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.targetGroupCount')} onclick={() => toggleLock('hexgrid.grouping.targetGroupCount')} title="Click to lock/unlock for randomize">Target groups: {config.hexgrid.grouping.targetGroupCount}</button>
      <input type="range" bind:value={config.hexgrid.grouping.targetGroupCount} min="1" max="250" step="1" disabled={config.hexgrid.grouping.mode === 'none'} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Effect</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.kind')} onclick={() => toggleLock('hexgrid.effect.kind')} title="Click to lock/unlock for randomize">Kind</button>
      <select bind:value={config.hexgrid.effect.kind}>
        <option value="none">None</option>
        <option value="bevel">Bevel</option>
        <option value="grain">Grain</option>
        <option value="gradient">Gradient</option>
      </select>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.amount')} onclick={() => toggleLock('hexgrid.effect.amount')} title="Click to lock/unlock for randomize">Amount: {config.hexgrid.effect.amount.toFixed(2)}</button>
      <input type="range" bind:value={config.hexgrid.effect.amount} min="0" max="1" step="0.01" disabled={config.hexgrid.effect.kind === 'none'} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.frequency')} onclick={() => toggleLock('hexgrid.effect.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.hexgrid.effect.frequency.toFixed(2)}</button>
      <input type="range" bind:value={config.hexgrid.effect.frequency} min="0.1" max="10" step="0.05" disabled={config.hexgrid.effect.kind === 'none'} />
    </label>
  </details>
</CollapsiblePanel>
