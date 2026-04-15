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

<CollapsiblePanel id="bands2d" title="Bands (2D)" icon="equal" defaultOpen={true} searchKeys="stripes ribbon">
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('bands.mode')} onclick={() => toggleLock('bands.mode')} title="Click to lock/unlock for randomize">Mode</button>
    <Dropdown
      bind:value={config.bands.mode}
      ariaLabel="Bands mode"
      options={[
        { value: 'waves', label: 'Waves' },
        { value: 'chevron', label: 'Chevron' },
        { value: 'straight', label: 'Straight' }
      ]}
    />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bands.angleDeg')} onclick={() => toggleLock('bands.angleDeg')} title="Click to lock/unlock for randomize">Angle: {Math.round(config.bands.angleDeg)}°</button>
    <input type="range" bind:value={config.bands.angleDeg} min="0" max="360" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bands.bandWidthPx')} onclick={() => toggleLock('bands.bandWidthPx')} title="Click to lock/unlock for randomize">Band width: {Math.round(config.bands.bandWidthPx)}px</button>
    <input type="range" bind:value={config.bands.bandWidthPx} min="2" max="1400" step="1" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('bands.gapPx')} onclick={() => toggleLock('bands.gapPx')} title="Click to lock/unlock for randomize">Gap: {Math.round(config.bands.gapPx)}px</button>
    <input type="range" bind:value={config.bands.gapPx} min="0" max="900" step="1" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Panel / Clip</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.bands.panel.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('bands.panel.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('bands.panel.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.x')} onclick={() => toggleLock('bands.panel.rectFrac.x')} title="Click to lock/unlock for randomize">X: {Math.round(config.bands.panel.rectFrac.x * 100)}%</button>
      <input type="range" bind:value={config.bands.panel.rectFrac.x} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.y')} onclick={() => toggleLock('bands.panel.rectFrac.y')} title="Click to lock/unlock for randomize">Y: {Math.round(config.bands.panel.rectFrac.y * 100)}%</button>
      <input type="range" bind:value={config.bands.panel.rectFrac.y} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.w')} onclick={() => toggleLock('bands.panel.rectFrac.w')} title="Click to lock/unlock for randomize">Width: {Math.round(config.bands.panel.rectFrac.w * 100)}%</button>
      <input type="range" bind:value={config.bands.panel.rectFrac.w} min="0.02" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.h')} onclick={() => toggleLock('bands.panel.rectFrac.h')} title="Click to lock/unlock for randomize">Height: {Math.round(config.bands.panel.rectFrac.h * 100)}%</button>
      <input type="range" bind:value={config.bands.panel.rectFrac.h} min="0.02" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.panel.radiusPx')} onclick={() => toggleLock('bands.panel.radiusPx')} title="Click to lock/unlock for randomize">Radius: {Math.round(config.bands.panel.radiusPx)}px</button>
      <input type="range" bind:value={config.bands.panel.radiusPx} min="0" max="900" step="1" disabled={!config.bands.panel.enabled} />
    </label>

    <details class="control-details" style="margin-top:0.5rem;">
      <summary class="control-details-summary">Panel Fill</summary>
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.bands.panel.fill.enabled} disabled={!config.bands.panel.enabled} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('bands.panel.fill.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('bands.panel.fill.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Enabled
        </button>
      </label>
      <label class="control-row">
        <button type="button" class="setting-title" class:locked={isLocked('bands.panel.fill.color')} onclick={() => toggleLock('bands.panel.fill.color')} title="Click to lock/unlock for randomize">Color</button>
        <input type="color" bind:value={config.bands.panel.fill.color} disabled={!config.bands.panel.enabled || !config.bands.panel.fill.enabled} />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.panel.fill.opacity')} onclick={() => toggleLock('bands.panel.fill.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.bands.panel.fill.opacity.toFixed(2)}</button>
        <input type="range" bind:value={config.bands.panel.fill.opacity} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled || !config.bands.panel.fill.enabled} />
      </label>
    </details>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Fill / Stroke</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.bands.fill.enabled} />
      <button type="button" class="setting-title" class:locked={isLocked('bands.fill.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('bands.fill.enabled'); }} title="Click to lock/unlock for randomize">Fill</button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.fill.opacity')} onclick={() => toggleLock('bands.fill.opacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.bands.fill.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.bands.fill.opacity} min="0" max="1" step="0.01" disabled={!config.bands.fill.enabled} />
    </label>

    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.bands.stroke.enabled} />
      <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('bands.stroke.enabled'); }} title="Click to lock/unlock for randomize">Stroke</button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.widthPx')} onclick={() => toggleLock('bands.stroke.widthPx')} title="Click to lock/unlock for randomize">Stroke width: {Math.round(config.bands.stroke.widthPx)}px</button>
      <input type="range" bind:value={config.bands.stroke.widthPx} min="0" max="24" step="1" disabled={!config.bands.stroke.enabled} />
    </label>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.color')} onclick={() => toggleLock('bands.stroke.color')} title="Click to lock/unlock for randomize">Stroke color</button>
      <input type="color" bind:value={config.bands.stroke.color} disabled={!config.bands.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.opacity')} onclick={() => toggleLock('bands.stroke.opacity')} title="Click to lock/unlock for randomize">Stroke opacity: {config.bands.stroke.opacity.toFixed(2)}</button>
      <input type="range" bind:value={config.bands.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.bands.stroke.enabled} />
    </label>
  </details>

  {#if config.bands.mode === 'waves'}
    <details class="control-details">
      <summary class="control-details-summary">Waves</summary>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.waves.amplitudePx')} onclick={() => toggleLock('bands.waves.amplitudePx')} title="Click to lock/unlock for randomize">Amplitude: {Math.round(config.bands.waves.amplitudePx)}px</button>
        <input type="range" bind:value={config.bands.waves.amplitudePx} min="0" max="240" step="1" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.waves.wavelengthPx')} onclick={() => toggleLock('bands.waves.wavelengthPx')} title="Click to lock/unlock for randomize">Wavelength: {Math.round(config.bands.waves.wavelengthPx)}px</button>
        <input type="range" bind:value={config.bands.waves.wavelengthPx} min="30" max="5000" step="1" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.waves.noiseAmount')} onclick={() => toggleLock('bands.waves.noiseAmount')} title="Click to lock/unlock for randomize">Noise: {config.bands.waves.noiseAmount.toFixed(2)}</button>
        <input type="range" bind:value={config.bands.waves.noiseAmount} min="0" max="1" step="0.01" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.waves.noiseScale')} onclick={() => toggleLock('bands.waves.noiseScale')} title="Click to lock/unlock for randomize">Noise scale: {config.bands.waves.noiseScale.toFixed(2)}</button>
        <input type="range" bind:value={config.bands.waves.noiseScale} min="0.1" max="12" step="0.01" />
      </label>
    </details>
  {:else if config.bands.mode === 'chevron'}
    <details class="control-details">
      <summary class="control-details-summary">Chevron</summary>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.amplitudePx')} onclick={() => toggleLock('bands.chevron.amplitudePx')} title="Click to lock/unlock for randomize">Amplitude: {Math.round(config.bands.chevron.amplitudePx)}px</button>
        <input type="range" bind:value={config.bands.chevron.amplitudePx} min="0" max="500" step="1" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.wavelengthPx')} onclick={() => toggleLock('bands.chevron.wavelengthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.bands.chevron.wavelengthPx)}px</button>
        <input type="range" bind:value={config.bands.chevron.wavelengthPx} min="20" max="2400" step="1" />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.sharpness')} onclick={() => toggleLock('bands.chevron.sharpness')} title="Click to lock/unlock for randomize">Sharpness: {config.bands.chevron.sharpness.toFixed(2)}</button>
        <input type="range" bind:value={config.bands.chevron.sharpness} min="0.1" max="8" step="0.05" />
      </label>

      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.bands.chevron.sharedPhase} />
        <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.sharedPhase')} onclick={(e) => { e.preventDefault(); toggleLock('bands.chevron.sharedPhase'); }} title="Click to lock/unlock for randomize">Shared phase (align)</button>
      </label>
    </details>
  {/if}

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('bands.paletteMode')} onclick={() => toggleLock('bands.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <Dropdown
        bind:value={config.bands.paletteMode}
        ariaLabel="Bands palette mode"
        options={[
          { value: 'cycle', label: 'Cycle' },
          { value: 'weighted', label: 'Weighted' }
        ]}
      />
    </label>

    {#if config.bands.paletteMode === 'weighted'}
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
        <button type="button" onclick={() => setEqualWeights('bands')}>Equal weights</button>
        <button type="button" onclick={() => setRandomWeights('bands')}>Random weights</button>
      </div>
      {#each config.colors as c, i}
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={isLocked('bands.colorWeights')} onclick={() => toggleLock('bands.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.bands.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
          <input type="range" min="0" max="5" step="0.05" value={config.bands.colorWeights[i] ?? 1} oninput={(e) => updateWeight('bands', i, Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      {/each}
    {/if}
  </details>
</CollapsiblePanel>
