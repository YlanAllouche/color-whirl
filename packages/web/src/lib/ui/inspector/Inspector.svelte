<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { ColorPreset } from '$lib/color-presets';
  import type { PreviewRenderMode } from '$lib/popsicle/preview';

  import RandomizeSection from '$lib/ui/sections/RandomizeSection.svelte';
  import TypeSection from '$lib/ui/sections/TypeSection.svelte';
  import ColorsSection from '$lib/ui/sections/ColorsSection.svelte';
  import AppearanceSection from '$lib/ui/sections/AppearanceSection.svelte';
  import EmissionSection from '$lib/ui/sections/EmissionSection.svelte';
  import GeneratorSection from '$lib/ui/inspector/GeneratorSection.svelte';
  import CameraSection from '$lib/ui/sections/CameraSection.svelte';
  import LightingSection from '$lib/ui/sections/LightingSection.svelte';
  import RenderSection from '$lib/ui/sections/RenderSection.svelte';
  import CollisionsSection from '$lib/ui/sections/CollisionsSection.svelte';
  import CliSection from '$lib/ui/sections/CliSection.svelte';
  import ResolutionSection from '$lib/ui/sections/ResolutionSection.svelte';
  import ExportSection from '$lib/ui/sections/ExportSection.svelte';

  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    showEmissionSection: boolean;
    supportsBloom: boolean;
    supportsCollisions: boolean;

    schedulePreviewRender: () => void;
    clearPreviewSettleTimer: () => void;

    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;

    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
    switchType: (nextType: any) => void;

    colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }>;
    selectedColorPreset: ColorPreset | null;
    cycleColorPreset: (delta: number) => void;
    applySelectedColorPreset: () => void;
    updateColor: (index: number, next: string) => void;
    replaceColors: (colors: string[]) => void;
    moveColor: (fromIndex: number, toIndex: number) => void;
    removeColor: (index: number) => void;
    addColor: () => void;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (
      paletteIndex: number,
      block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi'
    ) => void;

    renderError: string | null;
    setEqualWeights: (target: any) => void;
    setRandomWeights: (target: any) => void;
    updateWeight: (target: any, index: number, value: number) => void;

    cliCommand: string;
    copyCliCommand: () => void;
    cliViewMode: 'bash' | 'json';

    RESOLUTION_PRESETS: Record<string, { width: number; height: number }>;
    applyResolutionPreset: (preset: any) => void;

    isExporting: boolean;
    handleExport: () => void | Promise<void>;

    selectedColorPresetId: string;
    renderMode: PreviewRenderMode;
    collisionDragActive: boolean;
    exportFormat: ExportFormat;
  };

  let {
    config,
    is3DType,
    supportsEmission,
    showEmissionSection,
    supportsBloom,
    supportsCollisions,
    schedulePreviewRender,
    clearPreviewSettleTimer,
    isLocked,
    toggleLock,
    generateRandomGeneratedColors,
    generateRandomIncludingType,
    switchType,
    colorPresetGroups,
    selectedColorPreset,
    cycleColorPreset,
    applySelectedColorPreset,
    updateColor,
    replaceColors,
    moveColor,
    removeColor,
    addColor,
    togglePaletteOverride,
    updatePaletteOverride,
    togglePaletteBlock,
    renderError,
    setEqualWeights,
    setRandomWeights,
    updateWeight,
    cliCommand,
    copyCliCommand,
    cliViewMode = $bindable(),
    RESOLUTION_PRESETS,
    applyResolutionPreset,
    isExporting,
    handleExport,
    selectedColorPresetId = $bindable(),
    renderMode = $bindable(),
    collisionDragActive = $bindable(),
    exportFormat = $bindable()
  }: Props = $props();
</script>

<aside class="sidebar" oninput={schedulePreviewRender} onchange={schedulePreviewRender}>
  <div class="sidebar-header">
    <h1>ColorWhirl</h1>
  </div>

  <div class="sidebar-content">
    <RandomizeSection {generateRandomGeneratedColors} {generateRandomIncludingType} />

    <TypeSection {config} {switchType} />

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
      {replaceColors}
      {moveColor}
      {removeColor}
      {addColor}
      {togglePaletteOverride}
      {updatePaletteOverride}
      {togglePaletteBlock}
      bind:selectedColorPresetId
    />

    <AppearanceSection {config} {is3DType} {isLocked} {toggleLock} />

    <EmissionSection {config} {showEmissionSection} {isLocked} {toggleLock} />

    <GeneratorSection
      {config}
      {isLocked}
      {toggleLock}
      {renderError}
      {schedulePreviewRender}
      {setEqualWeights}
      {setRandomWeights}
      {updateWeight}
    />

    <CameraSection {config} {is3DType} {isLocked} {toggleLock} />

    <LightingSection {config} {is3DType} {isLocked} {toggleLock} />

    <RenderSection {config} {is3DType} {supportsBloom} {isLocked} {toggleLock} bind:renderMode />

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

    <CliSection {cliCommand} {copyCliCommand} bind:cliViewMode />

    <ResolutionSection {config} {RESOLUTION_PRESETS} applyResolutionPreset={applyResolutionPreset} />

    <ExportSection bind:exportFormat {isExporting} {handleExport} />
  </div>
</aside>
