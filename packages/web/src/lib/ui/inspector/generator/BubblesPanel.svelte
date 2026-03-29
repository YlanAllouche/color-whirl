<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: any;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, isLocked, toggleLock }: Props = $props();
</script>

<CollapsiblePanel id="bubbles" title="Bubbles" icon="circle-dashed" defaultOpen={false}>
  <label class="control-row checkbox">
    <input type="checkbox" bind:checked={config.bubbles.enabled} />
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('bubbles.enabled')}
      onclick={(e) => {
        e.preventDefault();
        toggleLock('bubbles.enabled');
      }}
      title="Click to lock/unlock for randomize"
    >
      Enable
    </button>
  </label>

  <label class="control-row checkbox">
    <input type="checkbox" bind:checked={config.bubbles.interior.enabled} disabled={!config.bubbles.enabled || config.bubbles.mode !== 'through'} />
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('bubbles.interior.enabled')}
      onclick={(e) => {
        e.preventDefault();
        toggleLock('bubbles.interior.enabled');
      }}
      title="Click to lock/unlock for randomize"
    >
      Interior surfaces
    </button>
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.mode')} onclick={() => toggleLock('bubbles.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <select bind:value={config.bubbles.mode} disabled={!config.bubbles.enabled}>
      <option value="through">Through</option>
      <option value="cap">Cap</option>
    </select>
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.count')} onclick={() => toggleLock('bubbles.count')} title="Click to lock/unlock for randomize">Samples: {Math.round(config.bubbles.count)}</button>
    <input type="range" bind:value={config.bubbles.count} min="1" max="8" step="1" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.frequency')} onclick={() => toggleLock('bubbles.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.bubbles.frequency.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.frequency} min="0.2" max="8" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.frequencyVariance')} onclick={() => toggleLock('bubbles.frequencyVariance')} title="Click to lock/unlock for randomize">Variance: {config.bubbles.frequencyVariance.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.frequencyVariance} min="0" max="1" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.radiusMin')} onclick={() => toggleLock('bubbles.radiusMin')} title="Click to lock/unlock for randomize">Radius min: {config.bubbles.radiusMin.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.radiusMin} min="0" max="1.5" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.radiusMax')} onclick={() => toggleLock('bubbles.radiusMax')} title="Click to lock/unlock for randomize">Radius max: {config.bubbles.radiusMax.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.radiusMax} min="0" max="2.5" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.softness')} onclick={() => toggleLock('bubbles.softness')} title="Click to lock/unlock for randomize">Softness: {config.bubbles.softness.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.softness} min="0" max="0.5" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.wallThickness')} onclick={() => toggleLock('bubbles.wallThickness')} title="Click to lock/unlock for randomize">Wall thickness: {config.bubbles.wallThickness.toFixed(2)}</button>
    <input type="range" bind:value={config.bubbles.wallThickness} min="0" max="1" step="0.01" disabled={!config.bubbles.enabled} />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bubbles.seedOffset')} onclick={() => toggleLock('bubbles.seedOffset')} title="Click to lock/unlock for randomize">Seed offset: {Math.round(config.bubbles.seedOffset)}</button>
    <input type="range" bind:value={config.bubbles.seedOffset} min="-200" max="200" step="1" disabled={!config.bubbles.enabled} />
  </label>
</CollapsiblePanel>
