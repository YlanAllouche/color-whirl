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

<CollapsiblePanel id="spheres3d" title="Spheres (3D)" icon="circle" defaultOpen={true}>
  <details class="control-details">
    <summary class="control-details-summary">Shape</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.kind')} onclick={() => toggleLock('spheres.shape.kind')} title="Click to lock/unlock for randomize">Kind</button>
      <Dropdown
        bind:value={config.spheres.shape.kind}
        ariaLabel="Sphere shape"
        options={[
          { value: 'uvSphere', label: 'UV sphere' },
          { value: 'spherifiedBox', label: 'Spherified box' },
          { value: 'geodesicPoly', label: 'Geodesic poly' }
        ]}
      />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.roundness')} onclick={() => toggleLock('spheres.shape.roundness')} title="Click to lock/unlock for randomize">Roundness: {config.spheres.shape.roundness.toFixed(2)}</button>
      <input type="range" bind:value={config.spheres.shape.roundness} min="0" max="1" step="0.01" disabled={config.spheres.shape.kind === 'uvSphere'} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.faceting')} onclick={() => toggleLock('spheres.shape.faceting')} title="Click to lock/unlock for randomize">Faceting: {config.spheres.shape.faceting.toFixed(2)}</button>
      <input type="range" bind:value={config.spheres.shape.faceting} min="0" max="1" step="0.01" disabled={config.spheres.shape.kind === 'uvSphere'} />
    </label>
  </details>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.count')} onclick={() => toggleLock('spheres.count')} title="Click to lock/unlock for randomize">Count: {config.spheres.count}</button>
    <input type="range" bind:value={config.spheres.count} min="1" max="800" step="1" />
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.distribution')} onclick={() => toggleLock('spheres.distribution')} title="Click to lock/unlock for randomize">Distribution</button>
    <Dropdown
      bind:value={config.spheres.distribution}
      ariaLabel="Sphere distribution"
      options={[
        { value: 'jitteredGrid', label: 'Jittered grid' },
        { value: 'scatter', label: 'Scatter' },
        { value: 'layeredDepth', label: 'Layered depth' }
      ]}
    />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.radiusMin')} onclick={() => toggleLock('spheres.radiusMin')} title="Click to lock/unlock for randomize">Radius min: {config.spheres.radiusMin.toFixed(2)}</button>
    <input type="range" bind:value={config.spheres.radiusMin} min="0.05" max="2.0" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.radiusMax')} onclick={() => toggleLock('spheres.radiusMax')} title="Click to lock/unlock for randomize">Radius max: {config.spheres.radiusMax.toFixed(2)}</button>
    <input type="range" bind:value={config.spheres.radiusMax} min="0.05" max="3.5" step="0.01" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.spread')} onclick={() => toggleLock('spheres.spread')} title="Click to lock/unlock for randomize">Spread: {config.spheres.spread.toFixed(2)}</button>
    <input type="range" bind:value={config.spheres.spread} min="0.5" max="20" step="0.05" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.depth')} onclick={() => toggleLock('spheres.depth')} title="Click to lock/unlock for randomize">Depth: {config.spheres.depth.toFixed(2)}</button>
    <input type="range" bind:value={config.spheres.depth} min="0" max="20" step="0.05" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.layers')} onclick={() => toggleLock('spheres.layers')} title="Click to lock/unlock for randomize">Layers: {config.spheres.layers}</button>
    <input type="range" bind:value={config.spheres.layers} min="1" max="16" step="1" disabled={config.spheres.distribution !== 'layeredDepth'} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('spheres.opacity')} onclick={() => toggleLock('spheres.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.spheres.opacity.toFixed(2)}</button>
    <input type="range" bind:value={config.spheres.opacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('spheres.paletteMode')} onclick={() => toggleLock('spheres.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.spheres.paletteMode}
        ariaLabel="Spheres palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>

    {#if config.spheres.paletteMode === 'weighted'}
      <div class="row-actions">
        <button type="button" onclick={() => setEqualWeights('spheres')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('spheres')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('spheres.colorWeights')} onclick={() => toggleLock('spheres.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.spheres.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={config.spheres.colorWeights[i] ?? 1}
            oninput={(e) => {
              updateWeight('spheres', i, Number((e.currentTarget as HTMLInputElement).value));
            }}
          />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
