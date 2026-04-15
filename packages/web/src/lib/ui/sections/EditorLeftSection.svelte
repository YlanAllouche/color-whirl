<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { PreviewRenderMode } from '$lib/popsicle/preview';
  import type { PerfState } from '$lib/app/perf/metrics';

  import GlobalInspector from '$lib/ui/inspector/GlobalInspector.svelte';

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
    performance: PerfState;
    togglePerformanceHud: () => void;
    runBenchmarkIterations: (iterations?: number) => void | Promise<void>;
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
    renderMode = $bindable(),
    performance,
    togglePerformanceHud,
    runBenchmarkIterations
  }: Props = $props();
</script>

<GlobalInspector
  {config}
  {is3DType}
  {supportsBloom}
  bind:searchQuery
  {schedulePreviewRender}
  {generateRandomColorsOnly}
  {generateRandomGeneratedColors}
  {generateRandomIncludingType}
  bind:randomizationProfile
  bind:paletteRandomizeScheme
  bind:paletteRandomizeHueBetweenSteps
  {switchType}
  {isLocked}
  {toggleLock}
  {RESOLUTION_PRESETS}
  {applyResolutionPreset}
  {isExporting}
  {handleExport}
  {cliCommand}
  {copyCliCommand}
  bind:cliViewMode
  bind:exportFormat
  bind:renderMode
  {performance}
  {togglePerformanceHud}
  {runBenchmarkIterations}
/>
