<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderWallpaperToCanvas, type WallpaperConfig } from '@wallpaper-maker/core';
  
  let { config }: { config: WallpaperConfig } = $props();
  
  let canvasContainer: HTMLDivElement;
  let canvas: HTMLCanvasElement | null = null;
  
  function render() {
    if (!canvasContainer) return;

    const next = renderWallpaperToCanvas(config, canvas ?? undefined);
    canvas = next;

    if (!next.parentElement) {
      canvasContainer.innerHTML = '';
      canvasContainer.appendChild(next);
    }
  }
  
  $effect(() => {
    render();
  });
  
  onMount(() => {
    render();
  });
  
  onDestroy(() => {
    // Canvas renderers don't need explicit disposal here.
    canvas = null;
  });
</script>

<div bind:this={canvasContainer} class="canvas-container"></div>

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #1a1a2e;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .canvas-container :global(canvas) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
</style>
