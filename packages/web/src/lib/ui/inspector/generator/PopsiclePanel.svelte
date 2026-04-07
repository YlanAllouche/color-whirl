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

<CollapsiblePanel id="popsicle" title="Popsicle" icon="ice-cream-cone" defaultOpen={true} searchKeys="ice cream sticks">
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickCount')} onclick={() => toggleLock('stickCount')} title="Click to lock/unlock for randomize">Count: {config.stickCount}</button>
    <input type="range" bind:value={config.stickCount} min="1" max="200" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickGap')} onclick={() => toggleLock('stickGap')} title="Click to lock/unlock for randomize">Gap: {config.stickGap.toFixed(2)}</button>
    <input type="range" bind:value={config.stickGap} min="0" max="5.0" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickSize')} onclick={() => toggleLock('stickSize')} title="Click to lock/unlock for randomize">Size: {config.stickSize.toFixed(2)}</button>
    <input type="range" bind:value={config.stickSize} min="0.25" max="2.5" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickRatio')} onclick={() => toggleLock('stickRatio')} title="Click to lock/unlock for randomize">Ratio: {config.stickRatio.toFixed(2)}</button>
    <input type="range" bind:value={config.stickRatio} min="0.5" max="12" step="0.05" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickThickness')} onclick={() => toggleLock('stickThickness')} title="Click to lock/unlock for randomize">Thickness: {config.stickThickness.toFixed(1)}</button>
    <input type="range" bind:value={config.stickThickness} min="0.1" max="3.0" step="0.1" />
  </label>

  <label class="control-row">
    <button type="button" class="setting-title" class:locked={isLocked('stickEndProfile')} onclick={() => toggleLock('stickEndProfile')} title="Click to lock/unlock for randomize">End profile</button>
    <Dropdown
      bind:value={config.stickEndProfile}
      ariaLabel="Stick end profile"
      options={[
        { value: 'rounded', label: 'Rounded' },
        { value: 'chamfer', label: 'Chamfer' },
        { value: 'chipped', label: 'Chipped' }
      ]}
    />
  </label>

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickRoundness')} onclick={() => toggleLock('stickRoundness')} title="Click to lock/unlock for randomize">Roundness: {config.stickRoundness.toFixed(2)}</button>
    <input type="range" bind:value={config.stickRoundness} min="0" max="1" step="0.01" />
  </label>

  {#if config.stickEndProfile === 'chipped'}
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('stickChipAmount')} onclick={() => toggleLock('stickChipAmount')} title="Click to lock/unlock for randomize">Chip amount: {config.stickChipAmount.toFixed(2)}</button>
      <input type="range" bind:value={config.stickChipAmount} min="0" max="1" step="0.01" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('stickChipJaggedness')} onclick={() => toggleLock('stickChipJaggedness')} title="Click to lock/unlock for randomize">Chip jaggedness: {config.stickChipJaggedness.toFixed(2)}</button>
      <input type="range" bind:value={config.stickChipJaggedness} min="0" max="1" step="0.01" />
    </label>
  {/if}

  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickBevel')} onclick={() => toggleLock('stickBevel')} title="Click to lock/unlock for randomize">Bevel: {config.stickBevel.toFixed(2)}</button>
    <input type="range" bind:value={config.stickBevel} min="0" max="1" step="0.01" />
  </label>
  <label class="control-row slider">
    <button type="button" class="setting-title" class:locked={isLocked('stickOpacity')} onclick={() => toggleLock('stickOpacity')} title="Click to lock/unlock for randomize">Opacity: {config.stickOpacity.toFixed(2)}</button>
    <input type="range" bind:value={config.stickOpacity} min="0" max="1" step="0.01" />
  </label>

  <div class="divider">
    <label class="control-row checkbox">
      <input type="checkbox" bind:checked={config.edge.hollow} />
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('edge.hollow')}
        onclick={(e) => {
          e.preventDefault();
          toggleLock('edge.hollow');
        }}
        title="Click to lock/unlock for randomize"
      >
        Hollow caps
      </button>
    </label>
  </div>

  <div class="divider">
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('stickOverhang')} onclick={() => toggleLock('stickOverhang')} title="Click to lock/unlock for randomize">Overhang: {config.stickOverhang.toFixed(0)}°</button>
      <input type="range" bind:value={config.stickOverhang} min="0" max="180" step="1" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('rotationCenterOffsetX')} onclick={() => toggleLock('rotationCenterOffsetX')} title="Click to lock/unlock for randomize">Rotation Center X: {config.rotationCenterOffsetX.toFixed(0)}%</button>
      <input type="range" bind:value={config.rotationCenterOffsetX} min="-100" max="100" step="5" />
    </label>
    <label class="control-row slider">
      <button type="button" class="setting-title" class:locked={isLocked('rotationCenterOffsetY')} onclick={() => toggleLock('rotationCenterOffsetY')} title="Click to lock/unlock for randomize">Rotation Center Y: {config.rotationCenterOffsetY.toFixed(0)}%</button>
      <input type="range" bind:value={config.rotationCenterOffsetY} min="-100" max="100" step="5" />
    </label>
  </div>
</CollapsiblePanel>
