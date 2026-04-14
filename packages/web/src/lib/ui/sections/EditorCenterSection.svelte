<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';

  import PreviewCanvas from '$lib/ui/layout/PreviewCanvas.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    schedulePreviewRender: () => void;
    clearPreviewSettleTimer: () => void;
    canvasContainer: HTMLDivElement | null;
    canvasHost: HTMLDivElement | null;
    cameraDragActive: boolean;
    settingsMaximized: boolean;
    settingsOverlayVisible: boolean;
    onCameraDragActiveChange?: (next: boolean) => void;
    onSettingsMaximizedChange?: (next: boolean) => void;
    onSettingsOverlayVisibleChange?: (next: boolean) => void;
  };

  let {
    config,
    is3DType,
    schedulePreviewRender,
    clearPreviewSettleTimer,
    canvasContainer = $bindable(null),
    canvasHost = $bindable(null),
    cameraDragActive,
    settingsMaximized,
    settingsOverlayVisible,
    onCameraDragActiveChange,
    onSettingsMaximizedChange,
    onSettingsOverlayVisibleChange
  }: Props = $props();
</script>

<PreviewCanvas
  {config}
  {is3DType}
  {schedulePreviewRender}
  {clearPreviewSettleTimer}
  bind:canvasContainer
  bind:canvasHost
  {cameraDragActive}
  {settingsMaximized}
  {settingsOverlayVisible}
  {onCameraDragActiveChange}
  {onSettingsMaximizedChange}
  {onSettingsOverlayVisibleChange}
/>
