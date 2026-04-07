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

<CollapsiblePanel id="flowlines2d" title="Flow Lines (2D)" icon="wind" defaultOpen={true} searchKeys="streamlines">
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('flowlines.frequency')} onclick={() => toggleLock('flowlines.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.flowlines.frequency.toFixed(2)}</button>
    <input type="range" bind:value={config.flowlines.frequency} min="0.05" max="12" step="0.05" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('flowlines.density')} onclick={() => toggleLock('flowlines.density')} title="Click to lock/unlock for randomize">Density: {config.flowlines.density.toFixed(2)}</button>
    <input type="range" bind:value={config.flowlines.density} min="0" max="1" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('flowlines.spacingPx')} onclick={() => toggleLock('flowlines.spacingPx')} title="Click to lock/unlock for randomize">Spacing: {Math.round(config.flowlines.spacingPx)}px</button>
    <input type="range" bind:value={config.flowlines.spacingPx} min="2" max="40" step="1" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Integration</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.spawn')} onclick={() => toggleLock('flowlines.spawn')} title="Click to lock/unlock for randomize">Spawn</button>
      <Dropdown
        bind:value={config.flowlines.spawn}
        ariaLabel="Flowlines spawn"
        options={[
          { value: 'grid', label: 'Grid' },
          { value: 'random', label: 'Random' }
        ]}
      />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.stepPx')} onclick={() => toggleLock('flowlines.stepPx')} title="Click to lock/unlock for randomize">Step: {config.flowlines.stepPx.toFixed(2)}px</button>
      <input type="range" bind:value={config.flowlines.stepPx} min="0.1" max="6" step="0.05" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.maxSteps')} onclick={() => toggleLock('flowlines.maxSteps')} title="Click to lock/unlock for randomize">Max steps: {config.flowlines.maxSteps}</button>
      <input type="range" bind:value={config.flowlines.maxSteps} min="20" max="1200" step="10" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.maxLines')} onclick={() => toggleLock('flowlines.maxLines')} title="Click to lock/unlock for randomize">Max lines: {config.flowlines.maxLines}</button>
      <input type="range" bind:value={config.flowlines.maxLines} min="0" max="20000" step="50" />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.widthPx')} onclick={() => toggleLock('flowlines.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {config.flowlines.stroke.widthPx.toFixed(2)}px</button>
      <input type="range" bind:value={config.flowlines.stroke.widthPx} min="0.05" max="8" step="0.05" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.opacity')} onclick={() => toggleLock('flowlines.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.flowlines.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.flowlines.stroke.opacity} min="0" max="1" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.taper')} onclick={() => toggleLock('flowlines.stroke.taper')} title="Click to lock/unlock for randomize">Taper: {config.flowlines.stroke.taper.toFixed(2)}</button>
      <input type="range" bind:value={config.flowlines.stroke.taper} min="0" max="1" step="0.01" />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('flowlines.paletteMode')} onclick={() => toggleLock('flowlines.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.flowlines.paletteMode}
        ariaLabel="Flowlines palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>
    {#if config.flowlines.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('flowlines')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('flowlines')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('flowlines.colorWeights')} onclick={() => toggleLock('flowlines.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.flowlines.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input type="range" min="0" max="5" step="0.05" value={config.flowlines.colorWeights[i] ?? 1} oninput={(e) => updateWeight('flowlines', i, Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
