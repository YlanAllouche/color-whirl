<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { PreviewRenderMode } from '$lib/popsicle/preview';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsBloom: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    renderMode: PreviewRenderMode;
  };

  let { config, is3DType, supportsBloom, isLocked, toggleLock, renderMode = $bindable() }: Props = $props();

  const envStyleOptions = [
    { value: 'studio', label: 'Studio' },
    { value: 'overcast', label: 'Overcast' },
    { value: 'sunset', label: 'Sunset' }
  ];

  const shadowTypeOptions = [
    { value: 'pcfsoft', label: 'PCF Soft' },
    { value: 'vsm', label: 'VSM' }
  ];

  const pathTraceDisabled = $derived(
    config.type !== 'popsicle' &&
      config.type !== 'spheres3d' &&
      config.type !== 'triangles3d' &&
      config.type !== 'svg3d'
  );
</script>

<CollapsiblePanel id="render" title="Render" icon="sparkles" defaultOpen={true}>

  {#if is3DType}
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('rendering.exposure')}
        onclick={() => toggleLock('rendering.exposure')}
        title="Click to lock/unlock for randomize"
      >
        Exposure: {config.rendering.exposure.toFixed(2)}
      </button>
      <input type="range" bind:value={config.rendering.exposure} min="0.3" max="2.5" step="0.01" />
    </label>

    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('rendering.toneMapping')}
        onclick={() => toggleLock('rendering.toneMapping')}
        title="Click to lock/unlock for randomize"
      >
        Tone Mapping
      </button>
      <Dropdown
        bind:value={config.rendering.toneMapping}
        ariaLabel="Tone mapping"
        options={[
          { value: 'aces', label: 'ACES' },
          { value: 'none', label: 'None' }
        ]}
      />
    </label>

    <label class="control-row">
      <span class="setting-title">Mode</span>
      <Dropdown
        bind:value={renderMode}
        title="Raster is instant; Path traced refines progressively"
        ariaLabel="Render mode"
        options={[
          { value: 'raster', label: 'Raster' },
          { value: 'path', label: 'Path traced', disabled: pathTraceDisabled }
        ]}
      />
    </label>
  {/if}

  {#if supportsBloom}
    <details class="control-details">
      <summary class="control-details-summary">Bloom</summary>
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.bloom.enabled} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('bloom.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('bloom.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Enable bloom
        </button>
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('bloom.strength')}
          onclick={() => toggleLock('bloom.strength')}
          title="Click to lock/unlock for randomize"
        >
          Strength: {config.bloom.strength.toFixed(2)}
        </button>
        <input type="range" bind:value={config.bloom.strength} min="0" max="3" step="0.01" disabled={!config.bloom.enabled} />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('bloom.radius')}
          onclick={() => toggleLock('bloom.radius')}
          title="Click to lock/unlock for randomize"
        >
          Radius: {config.bloom.radius.toFixed(2)}
        </button>
        <input type="range" bind:value={config.bloom.radius} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('bloom.threshold')}
          onclick={() => toggleLock('bloom.threshold')}
          title="Click to lock/unlock for randomize"
        >
          Threshold: {config.bloom.threshold.toFixed(2)}
        </button>
        <input type="range" bind:value={config.bloom.threshold} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
      </label>
    </details>
  {/if}

  {#if is3DType}
    <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.environment.enabled} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('environment.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('environment.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Environment (Reflections)
        </button>
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('environment.intensity')}
          onclick={() => toggleLock('environment.intensity')}
          title="Click to lock/unlock for randomize"
        >
          Env Intensity: {config.environment.intensity.toFixed(2)}
        </button>
        <input type="range" bind:value={config.environment.intensity} min="0" max="5" step="0.01" disabled={!config.environment.enabled} />
      </label>

      {#if config.texture !== 'matte'}
        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('environment.rotation')}
            onclick={() => toggleLock('environment.rotation')}
            title="Click to lock/unlock for randomize"
          >
            Env Rotation: {config.environment.rotation.toFixed(0)}°
          </button>
          <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
        </label>
        <label class="control-row">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('environment.style')}
            onclick={() => toggleLock('environment.style')}
            title="Click to lock/unlock for randomize"
          >
            Env Style
          </button>
          <Dropdown
            bind:value={config.environment.style}
            ariaLabel="Environment style"
            disabled={!config.environment.enabled}
            options={envStyleOptions}
          />
        </label>
      {:else}
        <details class="control-details">
          <summary class="control-details-summary">More env options</summary>
          <label class="control-row slider">
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('environment.rotation')}
              onclick={() => toggleLock('environment.rotation')}
              title="Click to lock/unlock for randomize"
            >
              Env Rotation: {config.environment.rotation.toFixed(0)}°
            </button>
            <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
          </label>
          <label class="control-row">
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('environment.style')}
              onclick={() => toggleLock('environment.style')}
              title="Click to lock/unlock for randomize"
            >
              Env Style
            </button>
            <Dropdown
              bind:value={config.environment.style}
              ariaLabel="Environment style"
              disabled={!config.environment.enabled}
              options={envStyleOptions}
            />
          </label>
        </details>
      {/if}
    </div>

    <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.shadows.enabled} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('shadows.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('shadows.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Shadows
        </button>
      </label>
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('shadows.type')}
          onclick={() => toggleLock('shadows.type')}
          title="Click to lock/unlock for randomize"
        >
          Shadow Type
        </button>
        <Dropdown
          bind:value={config.shadows.type}
          ariaLabel="Shadow type"
          disabled={!config.shadows.enabled}
          options={shadowTypeOptions}
        />
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('shadows.mapSize')}
          onclick={() => toggleLock('shadows.mapSize')}
          title="Click to lock/unlock for randomize"
        >
          Shadow Map: {config.shadows.mapSize}
        </button>
        <input type="range" bind:value={config.shadows.mapSize} min="256" max="4096" step="256" disabled={!config.shadows.enabled} />
      </label>

      <details class="control-details">
        <summary class="control-details-summary">Shadow tuning</summary>
        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('shadows.normalBias')}
            onclick={() => toggleLock('shadows.normalBias')}
            title="Click to lock/unlock for randomize"
          >
            Normal Bias: {config.shadows.normalBias.toFixed(3)}
          </button>
          <input type="range" bind:value={config.shadows.normalBias} min="0" max="0.2" step="0.001" disabled={!config.shadows.enabled} />
        </label>
        <label class="control-row slider">
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('shadows.bias')}
            onclick={() => toggleLock('shadows.bias')}
            title="Click to lock/unlock for randomize"
          >
            Shadow Bias: {config.shadows.bias.toFixed(5)}
          </button>
          <input type="range" bind:value={config.shadows.bias} min="-0.01" max="0.01" step="0.00001" disabled={!config.shadows.enabled} />
        </label>
      </details>
    </div>

    <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
      <details class="control-details">
        <summary class="control-details-summary">Quality</summary>
        <label class="control-row slider">
          <span class="setting-title">Geometry Quality: {config.geometry.quality.toFixed(2)}</span>
          <input type="range" bind:value={config.geometry.quality} min="0" max="1" step="0.01" />
        </label>
      </details>
    </div>
  {/if}
</CollapsiblePanel>
