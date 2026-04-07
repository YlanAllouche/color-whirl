<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: any;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
  };

  let { config, isLocked, toggleLock }: Props = $props();
</script>

<CollapsiblePanel id="facades" title="Facades" icon="layers" defaultOpen={false} searchKeys="surface">
  <details class="control-details">
    <summary class="control-details-summary">Grazing</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.facades.grazing.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('facades.grazing.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.mode')}
        onclick={() => toggleLock('facades.grazing.mode')}
        title="Click to lock/unlock for randomize"
      >
        Mode
      </button>
      <Dropdown
        bind:value={config.facades.grazing.mode}
        ariaLabel="Grazing mode"
        disabled={!config.facades.grazing.enabled}
        options={[
          { value: 'add', label: 'Add' },
          { value: 'mix', label: 'Mix' }
        ]}
      />
    </label>
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.color')}
        onclick={() => toggleLock('facades.grazing.color')}
        title="Click to lock/unlock for randomize"
      >
        Color
      </button>
      <input type="color" bind:value={config.facades.grazing.color} disabled={!config.facades.grazing.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.strength')}
        onclick={() => toggleLock('facades.grazing.strength')}
        title="Click to lock/unlock for randomize"
      >
        Strength: {config.facades.grazing.strength.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.grazing.strength}
        min="0"
        max={config.facades.grazing.mode === 'add' ? 5 : 1}
        step="0.01"
        disabled={!config.facades.grazing.enabled}
      />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.power')}
        onclick={() => toggleLock('facades.grazing.power')}
        title="Click to lock/unlock for randomize"
      >
        Power: {config.facades.grazing.power.toFixed(2)}
      </button>
      <input type="range" bind:value={config.facades.grazing.power} min="0.5" max="8" step="0.05" disabled={!config.facades.grazing.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.width')}
        onclick={() => toggleLock('facades.grazing.width')}
        title="Click to lock/unlock for randomize"
      >
        Width: {config.facades.grazing.width.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.grazing.width}
        min="0"
        max="1"
        step="0.01"
        disabled={!config.facades.grazing.enabled || config.facades.grazing.mode === 'add'}
      />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.grazing.noise')}
        onclick={() => toggleLock('facades.grazing.noise')}
        title="Click to lock/unlock for randomize"
      >
        Noise: {config.facades.grazing.noise.toFixed(2)}
      </button>
      <input type="range" bind:value={config.facades.grazing.noise} min="0" max="1" step="0.01" disabled={!config.facades.grazing.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Side</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.facades.side.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('facades.side.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.tintColor')}
        onclick={() => toggleLock('facades.side.tintColor')}
        title="Click to lock/unlock for randomize"
      >
        Tint
      </button>
      <input type="color" bind:value={config.facades.side.tintColor} disabled={!config.facades.side.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.tintAmount')}
        onclick={() => toggleLock('facades.side.tintAmount')}
        title="Click to lock/unlock for randomize"
      >
        Tint amount: {config.facades.side.tintAmount.toFixed(2)}
      </button>
      <input type="range" bind:value={config.facades.side.tintAmount} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.materialAmount')}
        onclick={() => toggleLock('facades.side.materialAmount')}
        title="Click to lock/unlock for randomize"
      >
        Material amount: {config.facades.side.materialAmount.toFixed(2)}
      </button>
      <input type="range" bind:value={config.facades.side.materialAmount} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.roughness')}
        onclick={() => toggleLock('facades.side.roughness')}
        title="Click to lock/unlock for randomize"
      >
        Roughness: {config.facades.side.roughness.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.side.roughness}
        min="0"
        max="1"
        step="0.01"
        disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0}
      />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.metalness')}
        onclick={() => toggleLock('facades.side.metalness')}
        title="Click to lock/unlock for randomize"
      >
        Metalness: {config.facades.side.metalness.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.side.metalness}
        min="0"
        max="1"
        step="0.01"
        disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0}
      />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.clearcoat')}
        onclick={() => toggleLock('facades.side.clearcoat')}
        title="Click to lock/unlock for randomize"
      >
        Clearcoat: {config.facades.side.clearcoat.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.side.clearcoat}
        min="0"
        max="1"
        step="0.01"
        disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0}
      />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.side.envIntensityMult')}
        onclick={() => toggleLock('facades.side.envIntensityMult')}
        title="Click to lock/unlock for randomize"
      >
        Env mult: {config.facades.side.envIntensityMult.toFixed(2)}
      </button>
      <input
        type="range"
        bind:value={config.facades.side.envIntensityMult}
        min="0"
        max="3"
        step="0.01"
        disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0}
      />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Outline</summary>
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
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.outline.color')}
        onclick={() => toggleLock('facades.outline.color')}
        title="Click to lock/unlock for randomize"
      >
        Color
      </button>
      <input type="color" bind:value={config.facades.outline.color} disabled={!config.facades.outline.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.outline.thickness')}
        onclick={() => toggleLock('facades.outline.thickness')}
        title="Click to lock/unlock for randomize"
      >
        Thickness: {config.facades.outline.thickness.toFixed(3)}
      </button>
      <input type="range" bind:value={config.facades.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.facades.outline.enabled} />
    </label>
    <label class="control-row slider">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('facades.outline.opacity')}
        onclick={() => toggleLock('facades.outline.opacity')}
        title="Click to lock/unlock for randomize"
      >
        Opacity: {config.facades.outline.opacity.toFixed(2)}
      </button>
      <input type="range" bind:value={config.facades.outline.opacity} min="0" max="1" step="0.01" disabled={!config.facades.outline.enabled} />
    </label>
  </details>
</CollapsiblePanel>
