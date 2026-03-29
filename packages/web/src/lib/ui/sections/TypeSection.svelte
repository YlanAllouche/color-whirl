<script lang="ts">
  import type { WallpaperConfig, WallpaperType } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: WallpaperConfig;
    switchType: (nextType: WallpaperType) => void;
  };

  let { config, switchType }: Props = $props();

  // Keep a local value bound to the <select> so it updates when config.type changes
  // (e.g. randomize actions). Setting the `value` attribute alone does not reliably
  // update the selected option after initial render.
  let selectedType: WallpaperType = $state('popsicle');

  $effect(() => {
    selectedType = config.type;
  });

  function onChangeType(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value as WallpaperType;
    selectedType = value;
    switchType(value);
  }
</script>

<CollapsiblePanel id="type" title="Type" icon="shapes" defaultOpen={true}>
  <label class="control-row">
    <span class="setting-title">Generator</span>
    <select bind:value={selectedType} onchange={onChangeType}>
      <option value="popsicle">Popsicle</option>
      <option value="spheres3d">Spheres (3D)</option>
      <option value="bands2d">Bands (2D)</option>
      <option value="flowlines2d">Flowlines (2D)</option>
      <option value="diamondgrid2d">Diamond Grid (2D)</option>
      <option value="circles2d">Circles (2D)</option>
      <option value="polygon2d">Polygon (2D)</option>
      <option value="svg2d">SVG (2D)</option>
      <option value="triangles2d">Triangles (2D)</option>
      <option value="ridges2d">Ridges (2D)</option>
      <option value="triangles3d">Triangles (3D)</option>
      <option value="svg3d">SVG (3D)</option>
      <option value="hexgrid2d">Hex Grid (2D)</option>
    </select>
  </label>
</CollapsiblePanel>
