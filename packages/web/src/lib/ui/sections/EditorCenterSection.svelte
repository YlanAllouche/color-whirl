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
  };

  let {
    config,
    is3DType,
    schedulePreviewRender,
    clearPreviewSettleTimer,
    canvasContainer = $bindable(null),
    canvasHost = $bindable(null),
    cameraDragActive = $bindable(false),
    settingsMaximized = $bindable(false),
    settingsOverlayVisible = $bindable(false)
  }: Props = $props();
</script>

<PreviewCanvas
  {config}
  {is3DType}
  {schedulePreviewRender}
  {clearPreviewSettleTimer}
  bind:canvasContainer
  bind:canvasHost
  bind:cameraDragActive
  bind:settingsMaximized
  bind:settingsOverlayVisible
/>
