<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import type { PaletteOverrideBlock } from './paletteOverrideTypes';

  type Props = {
    config: WallpaperConfig;
    index: number;
    ov: any;
    togglePaletteBlock: (paletteIndex: number, block: PaletteOverrideBlock) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
  };

  let { config, index, ov, togglePaletteBlock, updatePaletteOverride }: Props = $props();
</script>

<details class="control-details">
  <summary class="control-details-summary">Geometry</summary>
  <label class="control-row checkbox">
    <input type="checkbox" checked={!!ov?.geometry} oninput={() => togglePaletteBlock(index, 'geometry')} />
    <span class="setting-title">Override geometry</span>
  </label>

  {#if ov?.geometry}
    {#if config.type === 'popsicle'}
      <label class="control-row slider">
        <span class="setting-title">Size: {Number(ov.geometry?.popsicle?.sizeMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.popsicle?.sizeMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), sizeMult: v } }
            }));
          }}
        />
      </label>
      <label class="control-row slider">
        <span class="setting-title">Ratio: {Number(ov.geometry?.popsicle?.ratioMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.popsicle?.ratioMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), ratioMult: v } }
            }));
          }}
        />
      </label>
      <label class="control-row slider">
        <span class="setting-title">Thickness: {Number(ov.geometry?.popsicle?.thicknessMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.popsicle?.thicknessMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), thicknessMult: v } }
            }));
          }}
        />
      </label>
    {:else if config.type === 'spheres3d'}
      <label class="control-row slider">
        <span class="setting-title">Radius: {Number(ov.geometry?.spheres3d?.radiusMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.spheres3d?.radiusMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), spheres3d: { ...(((cur as any)?.geometry?.spheres3d ?? {}) as any), radiusMult: v } }
            }));
          }}
        />
      </label>
    {:else if config.type === 'triangles3d'}
      <label class="control-row slider">
        <span class="setting-title">Radius: {Number(ov.geometry?.triangles3d?.radiusMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.triangles3d?.radiusMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), triangles3d: { ...(((cur as any)?.geometry?.triangles3d ?? {}) as any), radiusMult: v } }
            }));
          }}
        />
      </label>
      <label class="control-row slider">
        <span class="setting-title">Height: {Number(ov.geometry?.triangles3d?.heightMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.triangles3d?.heightMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), triangles3d: { ...(((cur as any)?.geometry?.triangles3d ?? {}) as any), heightMult: v } }
            }));
          }}
        />
      </label>
    {:else if config.type === 'svg2d'}
      <label class="control-row slider">
        <span class="setting-title">Size: {Number(ov.geometry?.svg?.sizeMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.svg?.sizeMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), svg: { ...(((cur as any)?.geometry?.svg ?? {}) as any), sizeMult: v } }
            }));
          }}
        />
      </label>
    {:else if config.type === 'svg3d'}
      <label class="control-row slider">
        <span class="setting-title">Size: {Number(ov.geometry?.svg?.sizeMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.svg?.sizeMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), svg: { ...(((cur as any)?.geometry?.svg ?? {}) as any), sizeMult: v } }
            }));
          }}
        />
      </label>
      <label class="control-row slider">
        <span class="setting-title">Extrude: {Number(ov.geometry?.svg?.extrudeMult ?? 1).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.geometry?.svg?.extrudeMult ?? 1)}
          min="0.5"
          max="2"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              geometry: { ...((cur as any)?.geometry ?? {}), svg: { ...(((cur as any)?.geometry?.svg ?? {}) as any), extrudeMult: v } }
            }));
          }}
        />
      </label>
    {/if}
  {/if}
</details>
