<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { PreviewRenderMode } from '$lib/popsicle/preview';

  import InspectorColumn from '$lib/ui/inspector/InspectorColumn.svelte';
  import RandomizeSection from '$lib/ui/sections/RandomizeSection.svelte';
  import TypeSection from '$lib/ui/sections/TypeSection.svelte';
  import RenderSection from '$lib/ui/sections/RenderSection.svelte';
  import ResolutionSection from '$lib/ui/sections/ResolutionSection.svelte';
  import ExportSection from '$lib/ui/sections/ExportSection.svelte';
  import CliSection from '$lib/ui/sections/CliSection.svelte';

  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
  type RandomizationProfile = 'safe' | 'exploratory';
  type PaletteRandomizeScheme = 'auto' | 'analogous' | 'triadic' | 'complementary' | 'split-complementary' | 'hue-between';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsBloom: boolean;
    searchQuery: string;

    schedulePreviewRender: () => void;

    generateRandomColorsOnly: () => void;
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
    randomizationProfile: RandomizationProfile;
    paletteRandomizeScheme: PaletteRandomizeScheme;
    paletteRandomizeHueBetweenSteps: number | null;
    switchType: (nextType: any) => void;

    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;

    RESOLUTION_PRESETS: Record<string, { width: number; height: number }>;
    applyResolutionPreset: (preset: any) => void;

    isExporting: boolean;
    handleExport: () => void | Promise<void>;

    cliCommand: string;
    copyCliCommand: () => void;

    cliViewMode: 'bash' | 'json';
    exportFormat: ExportFormat;
    renderMode: PreviewRenderMode;
  };

  let {
    config,
    is3DType,
    supportsBloom,
    searchQuery = $bindable(),
    schedulePreviewRender,
    generateRandomColorsOnly,
    generateRandomGeneratedColors,
    generateRandomIncludingType,
    randomizationProfile = $bindable('safe'),
    paletteRandomizeScheme = $bindable('auto'),
    paletteRandomizeHueBetweenSteps = $bindable(null),
    switchType,
    isLocked,
    toggleLock,
    RESOLUTION_PRESETS,
    applyResolutionPreset,
    isExporting,
    handleExport,
    cliCommand,
    copyCliCommand,
    cliViewMode = $bindable(),
    exportFormat = $bindable(),
    renderMode = $bindable()
  }: Props = $props();
</script>

<div class="inspector-host" oninput={schedulePreviewRender} onchange={schedulePreviewRender}>
  <InspectorColumn
    id="global"
    title="Global"
    icon="wand"
    defaultColumns={1}
    searchPlaceholder="Search global…"
    bind:searchQuery
    showSearch={false}
    showColumnsToggle={false}
  >
    <RandomizeSection
      {generateRandomColorsOnly}
      {generateRandomGeneratedColors}
      {generateRandomIncludingType}
      bind:randomizationProfile
      bind:paletteRandomizeScheme
      bind:paletteRandomizeHueBetweenSteps
    />
    <TypeSection {config} {switchType} />
    {#if is3DType || supportsBloom}
      <RenderSection {config} {is3DType} {supportsBloom} {isLocked} {toggleLock} bind:renderMode />
    {/if}
    <ResolutionSection {config} {RESOLUTION_PRESETS} applyResolutionPreset={applyResolutionPreset} />
    <ExportSection bind:exportFormat {isExporting} {handleExport} />
    <CliSection {cliCommand} {copyCliCommand} bind:cliViewMode />
  </InspectorColumn>
</div>
