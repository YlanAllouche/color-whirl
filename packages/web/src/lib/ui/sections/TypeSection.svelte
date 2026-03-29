<script lang="ts">
  import type { WallpaperConfig, WallpaperType } from '@wallpaper-maker/core';

  type Props = {
    config: WallpaperConfig;
    switchType: (nextType: WallpaperType) => void;
  };

  let { config, switchType }: Props = $props();
</script>

<section class="control-section">
  <h3>Type</h3>
  <label class="control-row">
    <span class="setting-title">Generator</span>
    <select
      value={config.type}
      onchange={(e) => {
        const value = (e.currentTarget as HTMLSelectElement).value as WallpaperType;
        switchType(value);
      }}
    >
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
</section>
