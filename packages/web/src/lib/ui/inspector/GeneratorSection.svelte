<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';

  import FacadesPanel from '$lib/ui/inspector/generator/FacadesPanel.svelte';
  import EdgePanel from '$lib/ui/inspector/generator/EdgePanel.svelte';
  import OutlinePanel from '$lib/ui/inspector/generator/OutlinePanel.svelte';
  import BubblesPanel from '$lib/ui/inspector/generator/BubblesPanel.svelte';
  import PopsiclePanel from '$lib/ui/inspector/generator/PopsiclePanel.svelte';
  import Spheres3DPanel from '$lib/ui/inspector/generator/Spheres3DPanel.svelte';
  import Bands2DPanel from '$lib/ui/inspector/generator/Bands2DPanel.svelte';
  import Flowlines2DPanel from '$lib/ui/inspector/generator/Flowlines2DPanel.svelte';
  import DiamondGrid2DPanel from '$lib/ui/inspector/generator/DiamondGrid2DPanel.svelte';
  import Circles2DPanel from '$lib/ui/inspector/generator/Circles2DPanel.svelte';
  import Polygon2DPanel from '$lib/ui/inspector/generator/Polygon2DPanel.svelte';
  import Svg2DPanel from '$lib/ui/inspector/generator/Svg2DPanel.svelte';
  import Triangles2DPanel from '$lib/ui/inspector/generator/Triangles2DPanel.svelte';
  import Ridges2DPanel from '$lib/ui/inspector/generator/Ridges2DPanel.svelte';
  import Triangles3DPanel from '$lib/ui/inspector/generator/Triangles3DPanel.svelte';
  import Svg3DPanel from '$lib/ui/inspector/generator/Svg3DPanel.svelte';
  import HexGrid2DPanel from '$lib/ui/inspector/generator/HexGrid2DPanel.svelte';

  type Props = {
    config: WallpaperConfig;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    renderError: string | null;
    schedulePreviewRender: () => void;
    setEqualWeights: (target: any) => void;
    setRandomWeights: (target: any) => void;
    updateWeight: (target: any, index: number, value: number) => void;
  };

  let { config, isLocked, toggleLock, renderError, schedulePreviewRender, setEqualWeights, setRandomWeights, updateWeight }: Props = $props();

  let supportsOutlineOnly = $derived(config.type === 'spheres3d' || config.type === 'triangles3d');
</script>

{#if config.type === 'popsicle'}
  <FacadesPanel config={config as any} {isLocked} {toggleLock} />
  <EdgePanel config={config as any} {isLocked} {toggleLock} />
{/if}

{#if supportsOutlineOnly && config.type !== 'popsicle'}
  <OutlinePanel config={config as any} {isLocked} {toggleLock} />
{/if}

{#if config.type === 'popsicle' || config.type === 'spheres3d'}
  <BubblesPanel config={config as any} {isLocked} {toggleLock} />
{/if}

{#if config.type === 'popsicle'}
  <PopsiclePanel config={config as any} {isLocked} {toggleLock} />
{:else if config.type === 'spheres3d'}
  <Spheres3DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'bands2d'}
  <Bands2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'flowlines2d'}
  <Flowlines2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'diamondgrid2d'}
  <DiamondGrid2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'circles2d'}
  <Circles2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'polygon2d'}
  <Polygon2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'svg2d'}
  <Svg2DPanel
    config={config as any}
    {renderError}
    {schedulePreviewRender}
    {isLocked}
    {toggleLock}
    {setEqualWeights}
    {setRandomWeights}
    {updateWeight}
  />
{:else if config.type === 'triangles2d'}
  <Triangles2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'ridges2d'}
  <Ridges2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'triangles3d'}
  <Triangles3DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{:else if config.type === 'svg3d'}
  <Svg3DPanel
    config={config as any}
    {renderError}
    {schedulePreviewRender}
    {isLocked}
    {toggleLock}
    {setEqualWeights}
    {setRandomWeights}
    {updateWeight}
  />
{:else if config.type === 'hexgrid2d'}
  <HexGrid2DPanel config={config as any} {isLocked} {toggleLock} {setEqualWeights} {setRandomWeights} {updateWeight} />
{/if}
