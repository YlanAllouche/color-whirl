<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: any;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, isLocked, toggleLock }: Props = $props();
</script>

<CollapsiblePanel id="outline" title="Outline" icon="pen-tool" defaultOpen={false}>
  <label class="control-row checkbox">
    <input type="checkbox" bind:checked={config.facades.outline.enabled} />
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('facades.outline.enabled')}
      onclick={(e) => {
        e.preventDefault();
        toggleLock('facades.outline.enabled');
      }}
      title="Click to lock/unlock for randomize"
    >
      Enable
    </button>
  </label>
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('facades.outline.color')} onclick={() => toggleLock('facades.outline.color')} title="Click to lock/unlock for randomize">Color</button>
    <input type="color" bind:value={config.facades.outline.color} disabled={!config.facades.outline.enabled} />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('facades.outline.thickness')} onclick={() => toggleLock('facades.outline.thickness')} title="Click to lock/unlock for randomize">Thickness: {config.facades.outline.thickness.toFixed(3)}</button>
    <input type="range" bind:value={config.facades.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.facades.outline.enabled} />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('facades.outline.opacity')} onclick={() => toggleLock('facades.outline.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.facades.outline.opacity.toFixed(2)}</button>
    <input type="range" bind:value={config.facades.outline.opacity} min="0" max="1" step="0.01" disabled={!config.facades.outline.enabled} />
  </label>
</CollapsiblePanel>
