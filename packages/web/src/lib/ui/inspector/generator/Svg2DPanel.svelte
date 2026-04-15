<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: any;
    renderError: string | null;
    schedulePreviewRender: () => void;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    setEqualWeights: (target: any) => void;
    setRandomWeights: (target: any) => void;
    updateWeight: (target: any, index: number, value: number) => void;
  };

  let { config, renderError, schedulePreviewRender, isLocked, toggleLock, setEqualWeights, setRandomWeights, updateWeight }: Props = $props();
</script>

<CollapsiblePanel id="svg2d" title="SVG (2D)" icon="file-code" defaultOpen={true} searchKeys="vector">
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.renderMode')} onclick={() => toggleLock('svg.renderMode')} title="Click to lock/unlock for randomize">Render</button>
    <Dropdown
      bind:value={config.svg.renderMode}
      ariaLabel="SVG render mode"
      options={[
        { value: 'auto', label: 'Auto' },
        { value: 'fill', label: 'Fill' },
        { value: 'stroke', label: 'Stroke' },
        { value: 'fill+stroke', label: 'Fill + Stroke' }
      ]}
    />
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.mode')} onclick={() => toggleLock('svg.mode')} title="Click to lock/unlock for randomize">Layout</button>
    <Dropdown
      bind:value={config.svg.mode}
      ariaLabel="SVG layout mode"
      options={[
        { value: 'scatter', label: 'Scatter' },
        { value: 'grid', label: 'Grid' }
      ]}
    />
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.colorMode')} onclick={() => toggleLock('svg.colorMode')} title="Click to lock/unlock for randomize">Colors</button>
    <Dropdown
      bind:value={config.svg.colorMode}
      ariaLabel="SVG color mode"
      options={[
        { value: 'palette', label: 'Palette' },
        { value: 'svg-to-palette', label: 'SVG to palette' }
      ]}
    />
  </label>
  {#if config.svg.colorMode === 'svg-to-palette'}
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.maxTones')} onclick={() => toggleLock('svg.maxTones')} title="Click to lock/unlock for randomize">Max tones: {Math.round(Number(config.svg.maxTones) || 0)}</button>
      <input type="range" bind:value={config.svg.maxTones} min="1" max="24" step="1" />
    </label>
  {/if}

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.source')} onclick={() => toggleLock('svg.source')} title="Click to lock/unlock for randomize">Source</button>
  </label>
  <textarea
    bind:value={config.svg.source}
    rows="6"
    spellcheck="false"
    style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px;"
  ></textarea>
  {#if renderError}
    <div class="error-box" style="margin-top:0.5rem;">{renderError}</div>
  {/if}

  <div class="svg-long">
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.count')} onclick={() => toggleLock('svg.count')} title="Click to lock/unlock for randomize">Count: {config.svg.count}</button>
      <input type="range" bind:value={config.svg.count} min="1" max="4000" step="1" />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.rMinPx')} onclick={() => toggleLock('svg.rMinPx')} title="Click to lock/unlock for randomize">Size min: {Math.round(config.svg.rMinPx)}px</button>
      <input type="range" bind:value={config.svg.rMinPx} min="1" max="240" step="1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.rMaxPx')} onclick={() => toggleLock('svg.rMaxPx')} title="Click to lock/unlock for randomize">Size max: {Math.round(config.svg.rMaxPx)}px</button>
      <input type="range" bind:value={config.svg.rMaxPx} min="1" max="420" step="1" />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.jitter')} onclick={() => toggleLock('svg.jitter')} title="Click to lock/unlock for randomize">Jitter: {Number(config.svg.jitter).toFixed(2)}</button>
      <input type="range" bind:value={config.svg.jitter} min="0" max="1" step="0.01" />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.rotateJitterDeg')} onclick={() => toggleLock('svg.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round(config.svg.rotateJitterDeg)}deg</button>
      <input type="range" bind:value={config.svg.rotateJitterDeg} min="0" max="360" step="1" />
    </label>

    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.fillOpacity')} onclick={() => toggleLock('svg.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {Number(config.svg.fillOpacity).toFixed(2)}</button>
      <input type="range" bind:value={config.svg.fillOpacity} min="0" max="1" step="0.01" />
    </label>

    <details class="control-details">
      <summary class="control-details-summary">Stroke</summary>
      <label class="control-row checkbox">
        <input type="checkbox" bind:checked={config.svg.stroke.enabled} />
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('svg.stroke.enabled')}
          onclick={(e) => {
            e.preventDefault();
            toggleLock('svg.stroke.enabled');
          }}
          title="Click to lock/unlock for randomize"
        >
          Enable
        </button>
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.widthPx')} onclick={() => toggleLock('svg.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.svg.stroke.widthPx)}px</button>
        <input type="range" bind:value={config.svg.stroke.widthPx} min="0" max="24" step="1" disabled={!config.svg.stroke.enabled} />
      </label>
      <label class="control-row">
        <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.color')} onclick={() => toggleLock('svg.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
        <input type="color" bind:value={config.svg.stroke.color} disabled={!config.svg.stroke.enabled} />
      </label>
      <label class="control-row slider">
        <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.opacity')} onclick={() => toggleLock('svg.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number(config.svg.stroke.opacity).toFixed(2)}</button>
        <input type="range" bind:value={config.svg.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.svg.stroke.enabled} />
      </label>
    </details>

    <details class="control-details">
      <summary class="control-details-summary">Palette</summary>
      <label class="control-row">
        <button type="button" class="setting-title" class:locked={isLocked('svg.paletteMode')} onclick={() => toggleLock('svg.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
        <Dropdown
          bind:value={config.svg.paletteMode}
          ariaLabel="SVG palette mode"
          options={[
            { value: 'cycle', label: 'Cycle' },
            { value: 'weighted', label: 'Weighted' }
          ]}
        />
      </label>

      {#if config.svg.paletteMode === 'weighted'}
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
          <button type="button" onclick={() => setEqualWeights('svg')}>Equal weights</button>
          <button type="button" onclick={() => setRandomWeights('svg')}>Random weights</button>
        </div>
        {#each config.colors as c, i}
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('svg.colorWeights')} onclick={() => toggleLock('svg.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.svg.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={config.svg.colorWeights[i] ?? 1}
              oninput={(e) => {
                updateWeight('svg', i, Number((e.currentTarget as HTMLInputElement).value));
              }}
            />
          </label>
        {/each}
      {/if}
    </details>
  </div>
</CollapsiblePanel>

<style>
  .svg-long {
    margin-top: 0.5rem;
    max-height: 420px;
    overflow: auto;
    padding-right: 0.25rem;
  }
</style>
