<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    onFitCamera?: () => void;
  };

  let { config, is3DType, isLocked, toggleLock, onFitCamera }: Props = $props();

  const cameraModeOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'manual', label: 'Manual' }
  ];

  $effect(() => {
    if (!is3DType) return;
    if (config.camera.far <= config.camera.near) {
      config.camera.far = config.camera.near + 0.001;
    }
  });
</script>

{#if is3DType}
  <CollapsiblePanel id="camera" title="Camera" icon="camera" defaultOpen={false} searchKeys="camera fit zoom pan tilt rotate near far">
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.mode')}
        onclick={() => toggleLock('camera.mode')}
        title="Click to lock/unlock for randomize"
      >
        Mode
      </button>
      <Dropdown bind:value={config.camera.mode} ariaLabel="Camera mode" options={cameraModeOptions} />
    </label>

    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.padding')}
        onclick={() => toggleLock('camera.padding')}
        title="Click to lock/unlock for randomize"
      >
        Fit Padding: {config.camera.padding.toFixed(3)}
      </button>
      <input type="range" bind:value={config.camera.padding} min="0.5" max="0.999" step="0.001" />
    </label>

    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.azimuth')}
        onclick={() => toggleLock('camera.azimuth')}
        title="Click to lock/unlock for randomize"
      >
        Rotate: {config.camera.azimuth.toFixed(1)}°
      </button>
      <input type="range" bind:value={config.camera.azimuth} min="0" max="360" step="5" />
    </label>

    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.elevation')}
        onclick={() => toggleLock('camera.elevation')}
        title="Click to lock/unlock for randomize"
      >
        Tilt: {config.camera.elevation.toFixed(1)}°
      </button>
      <input type="range" bind:value={config.camera.elevation} min="-80" max="80" step="5" />
    </label>

    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('camera.distance')}
        onclick={() => toggleLock('camera.distance')}
        title="Click to lock/unlock for randomize"
      >
        Distance: {config.camera.distance.toFixed(1)}
      </button>
      <input type="range" bind:value={config.camera.distance} min="5" max="50" step="0.1" />
    </label>

    {#if config.camera.mode === 'manual'}
      <details class="control-details" open>
        <summary class="control-details-summary">Manual framing</summary>

        <label class="control-row">
          <span class="setting-title">Fit to frame</span>
          <button type="button" onclick={() => onFitCamera?.()}>Fit</button>
        </label>

        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('camera.zoom')}
            onclick={() => toggleLock('camera.zoom')}
            title="Click to lock/unlock for randomize"
          >
            Zoom: {config.camera.zoom.toFixed(3)}
          </button>
          <input type="range" bind:value={config.camera.zoom} min="0.05" max="80" step="0.01" />
        </label>

        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('camera.panX')}
            onclick={() => toggleLock('camera.panX')}
            title="Click to lock/unlock for randomize"
          >
            Pan X: {config.camera.panX.toFixed(3)}
          </button>
          <input type="range" bind:value={config.camera.panX} min="-10" max="10" step="0.01" />
        </label>

        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('camera.panY')}
            onclick={() => toggleLock('camera.panY')}
            title="Click to lock/unlock for randomize"
          >
            Pan Y: {config.camera.panY.toFixed(3)}
          </button>
          <input type="range" bind:value={config.camera.panY} min="-10" max="10" step="0.01" />
        </label>

        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('camera.near')}
            onclick={() => toggleLock('camera.near')}
            title="Click to lock/unlock for randomize"
          >
            Near: {config.camera.near.toFixed(3)}
          </button>
          <input type="range" bind:value={config.camera.near} min="0.001" max="20" step="0.001" />
        </label>

        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('camera.far')}
            onclick={() => toggleLock('camera.far')}
            title="Click to lock/unlock for randomize"
          >
            Far: {config.camera.far.toFixed(1)}
          </button>
          <input type="range" bind:value={config.camera.far} min="1" max="5000" step="1" />
        </label>
      </details>
    {/if}
  </CollapsiblePanel>
{/if}
