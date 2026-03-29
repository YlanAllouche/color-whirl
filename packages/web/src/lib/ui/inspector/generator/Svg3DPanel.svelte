<script lang="ts">
  import IconPicker from '$lib/icons/IconPicker.svelte';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

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

<CollapsiblePanel id="svg3d" title="SVG (3D)" icon="file-code" defaultOpen={true}>
  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.renderMode')} onclick={() => toggleLock('svg.renderMode')} title="Click to lock/unlock for randomize">Render</button>
    <select bind:value={config.svg.renderMode}>
      <option value="auto">Auto</option>
      <option value="fill">Fill</option>
      <option value="stroke">Stroke</option>
      <option value="fill+stroke">Fill + Stroke</option>
    </select>
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('svg.colorMode')} onclick={() => toggleLock('svg.colorMode')} title="Click to lock/unlock for randomize">Colors</button>
    <select bind:value={config.svg.colorMode}>
      <option value="palette">Palette</option>
      <option value="svg-to-palette">SVG to palette</option>
    </select>
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

  <details class="control-details">
    <summary class="control-details-summary">Icon picker</summary>
    <IconPicker
      onPick={(svg) => {
        config.svg = { ...config.svg, source: svg, renderMode: 'auto' };
        schedulePreviewRender();
      }}
    />
  </details>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.count')} onclick={() => toggleLock('svg.count')} title="Click to lock/unlock for randomize">Count: {config.svg.count}</button>
    <input type="range" bind:value={config.svg.count} min="1" max="2000" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.spread')} onclick={() => toggleLock('svg.spread')} title="Click to lock/unlock for randomize">Spread: {Number(config.svg.spread).toFixed(2)}</button>
    <input type="range" bind:value={config.svg.spread} min="0" max="8" step="0.05" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.depth')} onclick={() => toggleLock('svg.depth')} title="Click to lock/unlock for randomize">Depth: {Number(config.svg.depth).toFixed(2)}</button>
    <input type="range" bind:value={config.svg.depth} min="0" max="8" step="0.05" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.tiltDeg')} onclick={() => toggleLock('svg.tiltDeg')} title="Click to lock/unlock for randomize">Tilt: {Math.round(Number(config.svg.tiltDeg) || 0)}deg</button>
    <input type="range" bind:value={config.svg.tiltDeg} min="0" max="80" step="1" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.sizeMin')} onclick={() => toggleLock('svg.sizeMin')} title="Click to lock/unlock for randomize">Size min: {Number(config.svg.sizeMin).toFixed(3)}</button>
    <input type="range" bind:value={config.svg.sizeMin} min="0.02" max="1.0" step="0.005" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.sizeMax')} onclick={() => toggleLock('svg.sizeMax')} title="Click to lock/unlock for randomize">Size max: {Number(config.svg.sizeMax).toFixed(3)}</button>
    <input type="range" bind:value={config.svg.sizeMax} min="0.02" max="1.4" step="0.005" />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.extrudeDepth')} onclick={() => toggleLock('svg.extrudeDepth')} title="Click to lock/unlock for randomize">Extrude depth: {Number(config.svg.extrudeDepth).toFixed(3)}</button>
    <input type="range" bind:value={config.svg.extrudeDepth} min="0.005" max="1.0" step="0.005" />
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
      <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.radius')} onclick={() => toggleLock('svg.stroke.radius')} title="Click to lock/unlock for randomize">Radius: {Number(config.svg.stroke.radius).toFixed(3)}</button>
      <input type="range" bind:value={config.svg.stroke.radius} min="0.001" max="0.15" step="0.001" disabled={!config.svg.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.segments')} onclick={() => toggleLock('svg.stroke.segments')} title="Click to lock/unlock for randomize">Segments: {Math.round(config.svg.stroke.segments)}</button>
      <input type="range" bind:value={config.svg.stroke.segments} min="1" max="12" step="1" disabled={!config.svg.stroke.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.opacity')} onclick={() => toggleLock('svg.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number(config.svg.stroke.opacity).toFixed(2)}</button>
      <input type="range" bind:value={config.svg.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.svg.stroke.enabled} />
    </label>
  </details>

  <details class="control-details">
    <summary class="control-details-summary">Bevel</summary>
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.svg.bevel.enabled} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('svg.bevel.enabled')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('svg.bevel.enabled');
        }}
        title="Click to lock/unlock for randomize"
      >
        Enable
      </button>
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.bevel.size')} onclick={() => toggleLock('svg.bevel.size')} title="Click to lock/unlock for randomize">Size: {Number(config.svg.bevel.size).toFixed(3)}</button>
      <input type="range" bind:value={config.svg.bevel.size} min="0" max="0.2" step="0.005" disabled={!config.svg.bevel.enabled} />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('svg.bevel.segments')} onclick={() => toggleLock('svg.bevel.segments')} title="Click to lock/unlock for randomize">Segments: {Math.round(config.svg.bevel.segments)}</button>
      <input type="range" bind:value={config.svg.bevel.segments} min="0" max="6" step="1" disabled={!config.svg.bevel.enabled} />
    </label>
  </details>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('svg.opacity')} onclick={() => toggleLock('svg.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number(config.svg.opacity).toFixed(2)}</button>
    <input type="range" bind:value={config.svg.opacity} min="0" max="1" step="0.01" />
  </label>

  <details class="control-details">
    <summary class="control-details-summary">Palette</summary>
    <label class="control-row">
      <button type="button" class="setting-title" class:locked={isLocked('svg.paletteMode')} onclick={() => toggleLock('svg.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
      <select bind:value={config.svg.paletteMode}>
        <option value="cycle">Cycle</option>
        <option value="weighted">Weighted</option>
      </select>
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
</CollapsiblePanel>
