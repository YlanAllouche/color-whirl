<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: any;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, isLocked, toggleLock }: Props = $props();
</script>

<CollapsiblePanel id="edge" title="Edge" icon="square" defaultOpen={false}>
  <details class="control-details">
    <summary class="control-details-summary">Seam line</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.edge.seam.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('edge.seam.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('edge.seam.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('edge.seam.color')} onclick={() => toggleLock('edge.seam.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.edge.seam.color} disabled={!config.edge.seam.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.seam.opacity')} onclick={() => toggleLock('edge.seam.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.edge.seam.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.seam.opacity} min="0" max="1" step="0.01" disabled={!config.edge.seam.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.seam.width')} onclick={() => toggleLock('edge.seam.width')} title="Click to lock/unlock for randomize">Width: {config.edge.seam.width.toFixed(3)}</button>
      <input type="range" bind:value={config.edge.seam.width} min="0" max="0.12" step="0.001" disabled={!config.edge.seam.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.seam.noise')} onclick={() => toggleLock('edge.seam.noise')} title="Click to lock/unlock for randomize">Noise: {config.edge.seam.noise.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.seam.noise} min="0" max="1" step="0.01" disabled={!config.edge.seam.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.seam.emissiveIntensity')} onclick={() => toggleLock('edge.seam.emissiveIntensity')} title="Click to lock/unlock for randomize">Emissive: {config.edge.seam.emissiveIntensity.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.seam.emissiveIntensity} min="0" max="20" step="0.05" disabled={!config.edge.seam.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Band</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.edge.band.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('edge.band.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('edge.band.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('edge.band.color')} onclick={() => toggleLock('edge.band.color')} title="Click to lock/unlock for randomize">Color</button>
      <input type="color" bind:value={config.edge.band.color} disabled={!config.edge.band.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.band.opacity')} onclick={() => toggleLock('edge.band.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.edge.band.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.band.opacity} min="0" max="1" step="0.01" disabled={!config.edge.band.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.band.width')} onclick={() => toggleLock('edge.band.width')} title="Click to lock/unlock for randomize">Width: {config.edge.band.width.toFixed(3)}</button>
      <input type="range" bind:value={config.edge.band.width} min="0" max="0.25" step="0.001" disabled={!config.edge.band.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.band.noise')} onclick={() => toggleLock('edge.band.noise')} title="Click to lock/unlock for randomize">Noise: {config.edge.band.noise.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.band.noise} min="0" max="1" step="0.01" disabled={!config.edge.band.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('edge.band.emissiveIntensity')} onclick={() => toggleLock('edge.band.emissiveIntensity')} title="Click to lock/unlock for randomize">Emissive: {config.edge.band.emissiveIntensity.toFixed(2)}</button>
      <input type="range" bind:value={config.edge.band.emissiveIntensity} min="0" max="20" step="0.05" disabled={!config.edge.band.enabled} />
    </label>
  </details>
</CollapsiblePanel>
