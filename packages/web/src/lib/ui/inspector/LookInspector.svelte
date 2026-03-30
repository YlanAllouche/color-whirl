<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { ColorPreset } from '$lib/color-presets';

  import InspectorColumn from '$lib/ui/inspector/InspectorColumn.svelte';
  import ColorsSection from '$lib/ui/sections/ColorsSection.svelte';
  import AppearanceSection from '$lib/ui/sections/AppearanceSection.svelte';
  import VoronoiSection from '$lib/ui/sections/VoronoiSection.svelte';
  import EmissionSection from '$lib/ui/sections/EmissionSection.svelte';
  import GeneratorSection from '$lib/ui/inspector/GeneratorSection.svelte';
  import CameraSection from '$lib/ui/sections/CameraSection.svelte';
  import LightingSection from '$lib/ui/sections/LightingSection.svelte';
  import CollisionsSection from '$lib/ui/sections/CollisionsSection.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    showEmissionSection: boolean;
    supportsCollisions: boolean;

    searchQuery: string;

    columns?: 1 | 2;

    schedulePreviewRender: () => void;
    clearPreviewSettleTimer: () => void;

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

    renderError: string | null;
    setEqualWeights: (target: any) => void;
    setRandomWeights: (target: any) => void;
    updateWeight: (target: any, index: number, value: number) => void;
    collisionDragActive: boolean;
  };

  let {
    config,
    is3DType,
    supportsEmission,
    showEmissionSection,
    supportsCollisions,
    searchQuery = $bindable(),
    columns = $bindable(2),
    schedulePreviewRender,
    clearPreviewSettleTimer,
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
    selectedColorPresetId = $bindable(),
    renderError,
    setEqualWeights,
    setRandomWeights,
    updateWeight,
    collisionDragActive = $bindable()
  }: Props = $props();
</script>

<div oninput={schedulePreviewRender} onchange={schedulePreviewRender}>
  <InspectorColumn
    id="look"
    title="Type + Look"
    icon="palette"
    defaultColumns={2}
    searchPlaceholder="Search look…"
    bind:searchQuery
    showSearch={false}
    bind:columns
    showColumnsToggle={false}
  >
    <ColorsSection
      {config}
      {is3DType}
      {supportsEmission}
      {isLocked}
      {toggleLock}
      {colorPresetGroups}
      {selectedColorPreset}
      {cycleColorPreset}
      {applySelectedColorPreset}
      {updateColor}
      {removeColor}
      {addColor}
      {togglePaletteOverride}
      {updatePaletteOverride}
      {togglePaletteBlock}
      bind:selectedColorPresetId
    />

    <AppearanceSection {config} {is3DType} {isLocked} {toggleLock} />
    <VoronoiSection {config} {is3DType} {isLocked} {toggleLock} />
    <EmissionSection {config} {showEmissionSection} {isLocked} {toggleLock} />
    <GeneratorSection {config} {isLocked} {toggleLock} {renderError} {schedulePreviewRender} {setEqualWeights} {setRandomWeights} {updateWeight} />
    <CameraSection {config} {is3DType} {isLocked} {toggleLock} />
    <LightingSection {config} {is3DType} {isLocked} {toggleLock} />
    <CollisionsSection
      {config}
      {is3DType}
      {supportsCollisions}
      {isLocked}
      {toggleLock}
      {clearPreviewSettleTimer}
      {schedulePreviewRender}
      bind:collisionDragActive
    />
  </InspectorColumn>
</div>
