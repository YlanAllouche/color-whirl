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

<CollapsiblePanel id="ridges2d" title="Ridges (2D)" icon="waves" defaultOpen={true}>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('ridges.gridStepPx')} onclick={() => toggleLock('ridges.gridStepPx')} title="Click to lock/unlock for randomize">Grid step: {Math.round(config.ridges.gridStepPx)}px</button>
    <input type="range" bind:value={config.ridges.gridStepPx} min="2" max="24" step="1" />
  </label>

  <details class="control-details" open>
    <summary class="control-details-summary">Field detail</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.frequency')} onclick={() => toggleLock('ridges.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.ridges.frequency.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.frequency} min="0.1" max="8" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.detailFrequency')} onclick={() => toggleLock('ridges.detailFrequency')} title="Click to lock/unlock for randomize">Detail freq: {config.ridges.detailFrequency.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.detailFrequency} min="0.1" max="25" step="0.1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.detailAmplitude')} onclick={() => toggleLock('ridges.detailAmplitude')} title="Click to lock/unlock for randomize">Detail amp: {config.ridges.detailAmplitude.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.detailAmplitude} min="0" max="1" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.octaves')} onclick={() => toggleLock('ridges.octaves')} title="Click to lock/unlock for randomize">Octaves: {Math.round(config.ridges.octaves)}</button>
      <input type="range" bind:value={config.ridges.octaves} min="1" max="8" step="1" />
    </label>
  </details>

  <details class="control-details" open>
    <summary class="control-details-summary">Warp</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.warpAmount')} onclick={() => toggleLock('ridges.warpAmount')} title="Click to lock/unlock for randomize">Warp: {config.ridges.warpAmount.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.warpAmount} min="0" max="3" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.warpFrequency')} onclick={() => toggleLock('ridges.warpFrequency')} title="Click to lock/unlock for randomize">Warp freq: {config.ridges.warpFrequency.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.warpFrequency} min="0.1" max="6" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.warpDepth')} onclick={() => toggleLock('ridges.warpDepth')} title="Click to lock/unlock for randomize">Warp depth: {config.ridges.warpDepth.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.warpDepth} min="0" max="1" step="0.01" />
    </label>
  </details>

  <details class="control-details" open>
    <summary class="control-details-summary">Remap</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.contrast')} onclick={() => toggleLock('ridges.contrast')} title="Click to lock/unlock for randomize">Contrast: {config.ridges.contrast.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.contrast} min="0.3" max="3" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.bias')} onclick={() => toggleLock('ridges.bias')} title="Click to lock/unlock for randomize">Bias: {config.ridges.bias.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.bias} min="-0.5" max="0.5" step="0.01" />
    </label>
  </details>

  <details class="control-details" open>
    <summary class="control-details-summary">Contours</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.levels')} onclick={() => toggleLock('ridges.levels')} title="Click to lock/unlock for randomize">Levels: {Math.round(config.ridges.levels)}</button>
      <input type="range" bind:value={config.ridges.levels} min="3" max="36" step="1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.levelJitter')} onclick={() => toggleLock('ridges.levelJitter')} title="Click to lock/unlock for randomize">Level jitter: {config.ridges.levelJitter.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.levelJitter} min="0" max="0.3" step="0.01" />
    </label>
  </details>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('ridges.lineWidthPx')} onclick={() => toggleLock('ridges.lineWidthPx')} title="Click to lock/unlock for randomize">Line width: {config.ridges.lineWidthPx.toFixed(2)}px</button>
    <input type="range" bind:value={config.ridges.lineWidthPx} min="0.25" max="5" step="0.05" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('ridges.lineOpacity')} onclick={() => toggleLock('ridges.lineOpacity')} title="Click to lock/unlock for randomize">Line opacity: {config.ridges.lineOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.ridges.lineOpacity} min="0" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('ridges.smoothing')} onclick={() => toggleLock('ridges.smoothing')} title="Click to lock/unlock for randomize">Smoothing: {config.ridges.smoothing.toFixed(2)}</button>
    <input type="range" bind:value={config.ridges.smoothing} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Fill bands</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.ridges.fillBands.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('ridges.fillBands.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('ridges.fillBands.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.fillBands.opacity')} onclick={() => toggleLock('ridges.fillBands.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.ridges.fillBands.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.ridges.fillBands.opacity} min="0" max="1" step="0.01" disabled={!config.ridges.fillBands.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('ridges.paletteMode')} onclick={() => toggleLock('ridges.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <select bind:value={config.ridges.paletteMode}>
        <option value="cycle">Cycle</option>
        <option value="weighted">Weighted</option>
      </select>
    </label>

    {#if config.ridges.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('ridges')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('ridges')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('ridges.colorWeights')} onclick={() => toggleLock('ridges.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.ridges.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.ridges.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('ridges', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
