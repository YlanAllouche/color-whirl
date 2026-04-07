<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';
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
  <summary class="control-details-summary">Texture</summary>
  <label class="control-row checkbox">
    <input type="checkbox" checked={!!ov?.texture} oninput={() => togglePaletteBlock(index, 'texture')} />
    <span class="setting-title">Override texture</span>
  </label>

  {#if ov?.texture}
    <label class="control-row">
      <span class="setting-title">Type</span>
      <Dropdown
        value={ov.texture.type ?? config.texture}
        ariaLabel="Texture type"
        options={[
          { value: 'glossy', label: 'Glossy' },
          { value: 'matte', label: 'Matte' },
          { value: 'metallic', label: 'Metallic' },
          { value: 'drywall', label: 'Drywall' },
          { value: 'glass', label: 'Glass' },
          { value: 'mirror', label: 'Mirror' },
          { value: 'cel', label: 'Cel' }
        ]}
        onChange={(value) => {
          const next = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            texture: { ...(cur?.texture ?? {}), type: next }
          }));
        }}
      />
    </label>

    {#if (ov.texture.type ?? config.texture) === 'drywall'}
      <label class="control-row slider">
        <span class="setting-title">Grain: {Number(ov.texture.params?.drywall?.grainAmount ?? config.textureParams.drywall.grainAmount).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.texture.params?.drywall?.grainAmount ?? config.textureParams.drywall.grainAmount)}
          min="0"
          max="1"
          step="0.01"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              texture: {
                ...(cur?.texture ?? {}),
                params: {
                  ...((cur?.texture as any)?.params ?? {}),
                  drywall: { ...(((cur?.texture as any)?.params?.drywall ?? {}) as any), grainAmount: v }
                }
              }
            }));
          }}
        />
      </label>
      <label class="control-row slider">
        <span class="setting-title">Grain Scale: {Number(ov.texture.params?.drywall?.grainScale ?? config.textureParams.drywall.grainScale).toFixed(2)}</span>
        <input
          type="range"
          value={Number(ov.texture.params?.drywall?.grainScale ?? config.textureParams.drywall.grainScale)}
          min="0.5"
          max="8"
          step="0.05"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              texture: {
                ...(cur?.texture ?? {}),
                params: {
                  ...((cur?.texture as any)?.params ?? {}),
                  drywall: { ...(((cur?.texture as any)?.params?.drywall ?? {}) as any), grainScale: v }
                }
              }
            }));
          }}
        />
      </label>
    {/if}

    {#if (ov.texture.type ?? config.texture) === 'glass'}
      <label class="control-row">
        <span class="setting-title">Glass Style</span>
        <Dropdown
          value={ov.texture.params?.glass?.style ?? config.textureParams.glass.style}
          ariaLabel="Glass style"
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'frosted', label: 'Frosted' },
            { value: 'thick', label: 'Thick' },
            { value: 'stylized', label: 'Stylized' }
          ]}
          onChange={(value) => {
            const v = String(value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              texture: { ...(cur?.texture ?? {}), params: { ...((cur?.texture as any)?.params ?? {}), glass: { style: v } } }
            }));
          }}
        />
      </label>
    {/if}

    {#if (ov.texture.type ?? config.texture) === 'cel'}
      <label class="control-row slider">
        <span class="setting-title">Bands: {Math.round(Number(ov.texture.params?.cel?.bands ?? config.textureParams.cel.bands))}</span>
        <input
          type="range"
          value={Number(ov.texture.params?.cel?.bands ?? config.textureParams.cel.bands)}
          min="2"
          max="8"
          step="1"
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              texture: {
                ...(cur?.texture ?? {}),
                params: { ...((cur?.texture as any)?.params ?? {}), cel: { ...(((cur?.texture as any)?.params?.cel ?? {}) as any), bands: v } }
              }
            }));
          }}
        />
      </label>
      <label class="control-row checkbox">
        <input
          type="checkbox"
          checked={!!(ov.texture.params?.cel?.halftone ?? config.textureParams.cel.halftone)}
          oninput={(e) => {
            const checked = (e.currentTarget as HTMLInputElement).checked;
            updatePaletteOverride(index, (cur) => ({
              ...(cur ?? { enabled: true }),
              enabled: true,
              texture: {
                ...(cur?.texture ?? {}),
                params: { ...((cur?.texture as any)?.params ?? {}), cel: { ...(((cur?.texture as any)?.params?.cel ?? {}) as any), halftone: checked } }
              }
            }));
          }}
        />
        <span class="setting-title">Halftone</span>
      </label>
    {/if}
  {/if}
</details>
