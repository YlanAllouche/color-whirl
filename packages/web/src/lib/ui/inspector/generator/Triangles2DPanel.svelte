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

<CollapsiblePanel id="triangles2d" title="Triangles (2D)" icon="triangle" defaultOpen={true} searchKeys="tris">
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.mode')} onclick={() => toggleLock('triangles.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <Dropdown
      bind:value={config.triangles.mode}
      ariaLabel="Triangle mode"
      options={[
        { value: 'tessellation', label: 'Tessellation' },
        { value: 'scatter', label: 'Scatter' },
        { value: 'lowpoly', label: 'Low poly' }
      ]}
    />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.density')} onclick={() => toggleLock('triangles.density')} title="Click to lock/unlock for randomize">Density: {config.triangles.density.toFixed(2)}</button>
    <input type="range" bind:value={config.triangles.density} min="0.1" max="3.5" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.scalePx')} onclick={() => toggleLock('triangles.scalePx')} title="Click to lock/unlock for randomize">Scale: {Math.round(config.triangles.scalePx)}px</button>
    <input type="range" bind:value={config.triangles.scalePx} min="6" max="320" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.jitter')} onclick={() => toggleLock('triangles.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.triangles.jitter.toFixed(2)}</button>
    <input type="range" bind:value={config.triangles.jitter} min="0" max="1" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.rotateJitterDeg')} onclick={() => toggleLock('triangles.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round(config.triangles.rotateJitterDeg)}deg</button>
    <input type="range" bind:value={config.triangles.rotateJitterDeg} min="0" max="180" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.insetPx')} onclick={() => toggleLock('triangles.insetPx')} title="Click to lock/unlock for randomize">Inset: {Math.round(config.triangles.insetPx)}px</button>
    <input type="range" bind:value={config.triangles.insetPx} min="0" max="120" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('triangles.fillOpacity')} onclick={() => toggleLock('triangles.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.triangles.fillOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.triangles.fillOpacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.triangles.stroke.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('triangles.stroke.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('triangles.stroke.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.widthPx')} onclick={() => toggleLock('triangles.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.triangles.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.triangles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.triangles.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.color')} onclick={() => toggleLock('triangles.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.triangles.stroke.color} disabled={!config.triangles.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.opacity')} onclick={() => toggleLock('triangles.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.triangles.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.triangles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.triangles.stroke.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Shading</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.triangles.shading.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('triangles.shading.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('triangles.shading.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.shading.lightDeg')} onclick={() => toggleLock('triangles.shading.lightDeg')} title="Click to lock/unlock for randomize">Light: {Math.round(config.triangles.shading.lightDeg)}deg</button>
      <input type="range" bind:value={config.triangles.shading.lightDeg} min="0" max="360" step="1" disabled={!config.triangles.shading.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.shading.strength')} onclick={() => toggleLock('triangles.shading.strength')} title="Click to lock/unlock for randomize">Strength: {config.triangles.shading.strength.toFixed(2)}</button>
      <input type="range" bind:value={config.triangles.shading.strength} min="0" max="1" step="0.01" disabled={!config.triangles.shading.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('triangles.paletteMode')} onclick={() => toggleLock('triangles.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.triangles.paletteMode}
        ariaLabel="Triangle palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>

    {#if config.triangles.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('triangles2d')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('triangles2d')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('triangles.colorWeights')} onclick={() => toggleLock('triangles.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.triangles.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.triangles.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('triangles2d', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
