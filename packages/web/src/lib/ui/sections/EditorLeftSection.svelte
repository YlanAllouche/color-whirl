<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { PreviewRenderMode } from '$lib/popsicle/preview';

  import GlobalInspector from '$lib/ui/inspector/GlobalInspector.svelte';

  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
  type RandomizationProfile = 'safe' | 'exploratory';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsBloom: boolean;

    searchQuery: string;
    schedulePreviewRender: () => void;
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
    randomizationProfile: RandomizationProfile;
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
    generateRandomGeneratedColors,
    generateRandomIncludingType,
    randomizationProfile = $bindable('safe'),
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

<GlobalInspector
  {config}
  {is3DType}
  {supportsBloom}
  bind:searchQuery
  {schedulePreviewRender}
  {generateRandomGeneratedColors}
  {generateRandomIncludingType}
  bind:randomizationProfile
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
/>
