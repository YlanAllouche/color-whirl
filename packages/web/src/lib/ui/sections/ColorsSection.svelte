<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { ColorPreset } from '$lib/color-presets';

  import PaletteOverrides from '$lib/ui/inspector/colors/PaletteOverrides.svelte';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }>;
    selectedColorPreset: ColorPreset | null;
    cycleColorPreset: (delta: number) => void;
    applySelectedColorPreset: () => void;
    updateColor: (index: number, next: string) => void;
    removeColor: (index: number) => void;
    addColor: () => void;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (
      paletteIndex: number,
      block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi'
    ) => void;
    selectedColorPresetId: string;
  };

  let {
    config,
    is3DType,
    supportsEmission,
    isLocked,
    toggleLock,
    colorPresetGroups,
    selectedColorPreset,
    cycleColorPreset,
    applySelectedColorPreset,
    updateColor,
    removeColor,
    addColor,
    togglePaletteOverride,
    updatePaletteOverride,
    togglePaletteBlock,
    selectedColorPresetId = $bindable()
  }: Props = $props();
</script>

<CollapsiblePanel id="colors" title="Colors" icon="palette" defaultOpen={true}>
  <label class="control-row">
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('colors')}
      onclick={() => toggleLock('colors')}
      title="Click to lock/unlock for randomize"
    >
      Lock colors
    </button>
    <span class="setting-hint">Presets + palette overrides</span>
  </label>

  <label class="control-row">
    <button
      type="button"
      class="setting-title"
      class:locked={isLocked('backgroundColor')}
      onclick={() => toggleLock('backgroundColor')}
      title="Click to lock/unlock for randomize"
    >
      Background (scheme)
    </button>
    <input type="color" bind:value={config.backgroundColor} />
  </label>
  <div class="palette-controls">
    <div class="palette-row">
      <button type="button" class="palette-nav" onclick={() => cycleColorPreset(-1)} title="Previous preset">Prev</button>
      <Dropdown
        bind:value={selectedColorPresetId}
        size="sm"
        title="Apply a preset to colors + background"
        ariaLabel="Color preset"
        options={colorPresetGroups.map((g) => ({
          group: g.group,
          options: g.presets.map((preset) => ({ value: preset.id, label: preset.label }))
        }))}
        onChange={applySelectedColorPreset}
      />
      <button type="button" class="palette-nav" onclick={() => cycleColorPreset(1)} title="Next preset">Next</button>
    </div>
    {#if selectedColorPreset}
      <div class="palette-preview" title={selectedColorPreset.source ?? ''}>
        <span class="swatch swatch-bg" style={`background: ${selectedColorPreset.backgroundColor}`}></span>
        {#each selectedColorPreset.colors.slice(0, 10) as c}
          <span class="swatch" style={`background: ${c}`}></span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="colors-list">
    {#each config.colors as color, i}
      <div class="color-item">
        <input type="color" value={color} oninput={(e) => updateColor(i, e.currentTarget.value)} />
        <button class="remove-btn" onclick={() => removeColor(i)} disabled={config.colors.length <= 1}>×</button>
      </div>
    {/each}
    <button class="add-btn" onclick={addColor}>+ Add Color</button>
  </div>

  <PaletteOverrides
    {config}
    {is3DType}
    {supportsEmission}
    {togglePaletteOverride}
    {updatePaletteOverride}
    {togglePaletteBlock}
  />
</CollapsiblePanel>
