<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createPopsicleScene, type WallpaperConfig } from '@wallpaper-maker/core';
  
  let { config }: { config: WallpaperConfig } = $props();
  
  let canvasContainer: HTMLDivElement;
  let renderer: THREE.WebGLRenderer | null = null;
  let animationId: number;
  
  function render() {
    if (!canvasContainer) return;
    
    // Clean up previous renderer
    if (renderer) {
      renderer.dispose();
      canvasContainer.innerHTML = '';
    }
    
    const { scene, camera, renderer: newRenderer } = createPopsicleScene(config);
    renderer = newRenderer;
    
    canvasContainer.appendChild(renderer.domElement);
    
    renderer.render(scene, camera);
  }
  
  $effect(() => {
    render();
  });
  
  onMount(() => {
    render();
  });
  
  onDestroy(() => {
    if (renderer) {
      renderer.dispose();
    }
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
