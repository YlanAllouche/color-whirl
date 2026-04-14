<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { ColorPreset } from '$lib/color-presets';

  import LookInspector from '$lib/ui/inspector/LookInspector.svelte';

  type WeightTarget =
    | 'spheres'
    | 'circles'
    | 'polygons'
    | 'triangles2d'
    | 'prisms'
    | 'hexgrid'
    | 'ridges'
    | 'svg'
    | 'bands'
    | 'flowlines'
    | 'diamondgrid';

  type PaletteBlock = 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    showEmissionSection: boolean;
    supportsCollisions: boolean;

    columns: 1 | 2;
    searchQuery: string;
    schedulePreviewRender: () => void;
    clearPreviewSettleTimer: () => void;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }>;
    selectedColorPreset: ColorPreset | null;
    cycleColorPreset: (delta: number) => void;
    applySelectedColorPreset: () => void;
    updateColor: (index: number, next: string) => void;
    replaceColors: (colors: string[]) => void;
    moveColor: (fromIndex: number, toIndex: number) => void;
    removeColor: (index: number) => void;
    addColor: () => void;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (paletteIndex: number, block: PaletteBlock) => void;
    renderError: string | null;
    setEqualWeights: (target: WeightTarget) => void;
    setRandomWeights: (target: WeightTarget) => void;
    updateWeight: (target: WeightTarget, index: number, value: number) => void;
    selectedColorPresetId: string;
    collisionDragActive: boolean;
  };

  let {
    config,
    is3DType,
    supportsEmission,
    showEmissionSection,
    supportsCollisions,
    columns = $bindable(2),
    searchQuery = $bindable(''),
    schedulePreviewRender,
    clearPreviewSettleTimer,
    isLocked,
    toggleLock,
    colorPresetGroups,
    selectedColorPreset,
    cycleColorPreset,
    applySelectedColorPreset,
    updateColor,
    replaceColors,
    moveColor,
    removeColor,
    addColor,
    togglePaletteOverride,
    updatePaletteOverride,
    togglePaletteBlock,
    renderError,
    setEqualWeights,
    setRandomWeights,
    updateWeight,
    selectedColorPresetId = $bindable(),
    collisionDragActive = $bindable()
  }: Props = $props();
</script>

<LookInspector
  {config}
  {is3DType}
  {supportsEmission}
  {showEmissionSection}
  {supportsCollisions}
  bind:columns
  bind:searchQuery
  {schedulePreviewRender}
  {clearPreviewSettleTimer}
  {isLocked}
  {toggleLock}
  {colorPresetGroups}
  {selectedColorPreset}
  {cycleColorPreset}
  {applySelectedColorPreset}
  {updateColor}
  {replaceColors}
  {moveColor}
  {removeColor}
  {addColor}
  {togglePaletteOverride}
  {updatePaletteOverride}
  {togglePaletteBlock}
  {renderError}
  {setEqualWeights}
  {setRandomWeights}
  {updateWeight}
  bind:selectedColorPresetId
  bind:collisionDragActive
/>
