<script lang="ts">
  import type { WallpaperConfig, WallpaperType } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type Props = {
    config: WallpaperConfig;
    switchType: (nextType: WallpaperType) => void;
  };

  let { config, switchType }: Props = $props();

  // Keep a local value so it updates when config.type changes (e.g. randomize).
  let selectedType: WallpaperType = $state('popsicle');

  $effect(() => {
    selectedType = config.type;
  });

</script>

<CollapsiblePanel id="type" title="Type" icon="shapes" defaultOpen={true} searchKeys="generator">
  <label class="control-row">
    <span class="setting-title">Generator</span>
    <Dropdown
      value={selectedType}
      options={[
        { value: 'popsicle', label: 'Popsicle' },
        { value: 'spheres3d', label: 'Spheres (3D)' },
        { value: 'bands2d', label: 'Bands (2D)' },
        { value: 'flowlines2d', label: 'Flowlines (2D)' },
        { value: 'diamondgrid2d', label: 'Diamond Grid (2D)' },
        { value: 'circles2d', label: 'Circles (2D)' },
        { value: 'polygon2d', label: 'Polygon (2D)' },
        { value: 'svg2d', label: 'SVG (2D)' },
        { value: 'triangles2d', label: 'Triangles (2D)' },
        { value: 'ridges2d', label: 'Ridges (2D)' },
        { value: 'triangles3d', label: 'Triangles (3D)' },
        { value: 'svg3d', label: 'SVG (3D)' },
        { value: 'hexgrid2d', label: 'Hex Grid (2D)' }
      ]}
      ariaLabel="Wallpaper type"
      onChange={(value) => {
        selectedType = value as WallpaperType;
        switchType(value as WallpaperType);
      }}
    />
  </label>
</CollapsiblePanel>
