<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';
  import PaletteOverrideBubblesSection from './PaletteOverrideBubblesSection.svelte';
  import PaletteOverrideEmissionSection from './PaletteOverrideEmissionSection.svelte';
  import PaletteOverrideGeometrySection from './PaletteOverrideGeometrySection.svelte';
  import PaletteOverrideTextureSection from './PaletteOverrideTextureSection.svelte';
  import PaletteOverrideVoronoiSection from './PaletteOverrideVoronoiSection.svelte';
  import type { PaletteOverrideBlock } from './paletteOverrideTypes';

  type Props = {
    config: WallpaperConfig;
    color: string;
    index: number;
    is3DType: boolean;
    supportsEmission: boolean;
    open?: boolean;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (paletteIndex: number, block: PaletteOverrideBlock) => void;
  };

  let {
    config,
    color,
    index,
    is3DType,
    supportsEmission,
    open = $bindable(false),
    togglePaletteOverride,
    updatePaletteOverride,
    togglePaletteBlock
  }: Props = $props();

  let ov = $derived((config as any).palette?.overrides?.[index]);
  let ovEnabled = $derived(!!ov?.enabled);
</script>
<details class="palette-override-item" bind:open>
  <summary class="palette-override-summary">
    <span class="mono">#{index}</span>
    <span class="swatch" style={`background: ${color}`}></span>
    <span class="mono">{color}</span>
  </summary>

  <label class="control-row checkbox">
    <input type="checkbox" checked={ovEnabled} oninput={() => togglePaletteOverride(index)} />
    <span class="setting-title">Enable overrides</span>
  </label>

  {#if ovEnabled}
    <label class="control-row slider">
      <span class="setting-title">
        Frequency:
        {Math.max(0, Math.min(1, Number(ov?.frequency ?? 1))) <= 0
          ? 'Once (closest)'
          : `${Math.round(Math.max(0, Math.min(1, Number(ov?.frequency ?? 1))) * 100)}%`}
      </span>
      <input
        type="range"
        value={Math.max(0, Math.min(1, Number(ov?.frequency ?? 1)))}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({ ...(cur ?? { enabled: true }), enabled: true, frequency: v }));
        }}
      />
    </label>

    {#if config.type === 'popsicle' || config.type === 'spheres3d'}
      <PaletteOverrideBubblesSection {config} {index} {ov} {togglePaletteBlock} {updatePaletteOverride} />
    {/if}

    {#if supportsEmission}
      <PaletteOverrideEmissionSection {config} {index} {ov} {togglePaletteBlock} {updatePaletteOverride} />
    {/if}

    {#if config.type === 'popsicle' || config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg2d' || config.type === 'svg3d'}
      <PaletteOverrideGeometrySection {config} {index} {ov} {togglePaletteBlock} {updatePaletteOverride} />
    {/if}

    {#if is3DType}
      <PaletteOverrideTextureSection {config} {index} {ov} {togglePaletteBlock} {updatePaletteOverride} />
    {/if}

    {#if is3DType}
      <PaletteOverrideVoronoiSection {config} {index} {ov} {togglePaletteBlock} {updatePaletteOverride} />
    {/if}

    {#if is3DType}
      <details class="control-details">
        <summary class="control-details-summary">Facades</summary>

        <label class="control-row checkbox">
          <input type="checkbox" checked={!!ov?.facades?.grazing} oninput={() => togglePaletteBlock(index, 'grazing')} />
          <span class="setting-title">Override grazing</span>
        </label>
        {#if ov?.facades?.grazing}
          <label class="control-row checkbox">
            <input
              type="checkbox"
              checked={!!ov.facades.grazing.enabled}
              oninput={(e) => {
                const checked = (e.currentTarget as HTMLInputElement).checked;
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), enabled: checked } }
                }));
              }}
            />
            <span class="setting-title">Grazing enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Mode</span>
            <Dropdown
              value={ov.facades.grazing.mode ?? config.facades.grazing.mode}
              ariaLabel="Grazing mode"
              options={[
                { value: 'add', label: 'Add' },
                { value: 'mix', label: 'Mix' }
              ]}
              onChange={(value) => {
                const v = String(value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), mode: v } }
                }));
              }}
            />
          </label>
          <label class="control-row">
            <span class="setting-title">Color</span>
            <input
              type="color"
              value={ov.facades.grazing.color ?? config.facades.grazing.color}
              oninput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), color: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Strength: {Number(ov.facades.grazing.strength ?? config.facades.grazing.strength).toFixed(2)}</span>
            <input
              type="range"
              value={Number(ov.facades.grazing.strength ?? config.facades.grazing.strength)}
              min="0"
              max={(ov.facades.grazing.mode ?? config.facades.grazing.mode) === 'add' ? 5 : 1}
              step="0.01"
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), strength: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Power: {Number(ov.facades.grazing.power ?? config.facades.grazing.power).toFixed(2)}</span>
            <input
              type="range"
              value={Number(ov.facades.grazing.power ?? config.facades.grazing.power)}
              min="0.5"
              max="8"
              step="0.05"
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), power: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Width: {Number(ov.facades.grazing.width ?? config.facades.grazing.width).toFixed(2)}</span>
            <input
              type="range"
              value={Number(ov.facades.grazing.width ?? config.facades.grazing.width)}
              min="0"
              max="1"
              step="0.01"
              disabled={(ov.facades.grazing.mode ?? config.facades.grazing.mode) === 'add'}
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), width: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Noise: {Number(ov.facades.grazing.noise ?? config.facades.grazing.noise).toFixed(2)}</span>
            <input
              type="range"
              value={Number(ov.facades.grazing.noise ?? config.facades.grazing.noise)}
              min="0"
              max="1"
              step="0.01"
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), noise: v } }
                }));
              }}
            />
          </label>
        {/if}

        <label class="control-row checkbox">
          <input type="checkbox" checked={!!ov?.facades?.outline} oninput={() => togglePaletteBlock(index, 'outline')} />
          <span class="setting-title">Override outline</span>
        </label>
        {#if ov?.facades?.outline}
          <label class="control-row checkbox">
            <input
              type="checkbox"
              checked={!!ov.facades.outline.enabled}
              oninput={(e) => {
                const checked = (e.currentTarget as HTMLInputElement).checked;
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), outline: { ...(cur?.facades?.outline ?? {}), enabled: checked } }
                }));
              }}
            />
            <span class="setting-title">Outline enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Color</span>
            <input
              type="color"
              value={ov.facades.outline.color ?? config.facades.outline.color}
              oninput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), outline: { ...(cur?.facades?.outline ?? {}), color: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Thickness: {Number(ov.facades.outline.thickness ?? config.facades.outline.thickness).toFixed(3)}</span>
            <input
              type="range"
              value={Number(ov.facades.outline.thickness ?? config.facades.outline.thickness)}
              min="0"
              max="0.12"
              step="0.001"
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), outline: { ...(cur?.facades?.outline ?? {}), thickness: v } }
                }));
              }}
            />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Opacity: {Number(ov.facades.outline.opacity ?? config.facades.outline.opacity).toFixed(2)}</span>
            <input
              type="range"
              value={Number(ov.facades.outline.opacity ?? config.facades.outline.opacity)}
              min="0"
              max="1"
              step="0.01"
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  facades: { ...(cur?.facades ?? {}), outline: { ...(cur?.facades?.outline ?? {}), opacity: v } }
                }));
              }}
            />
          </label>
        {/if}

        {#if config.type === 'popsicle'}
          <label class="control-row checkbox">
            <input type="checkbox" checked={!!ov?.facades?.side} oninput={() => togglePaletteBlock(index, 'side')} />
            <span class="setting-title">Override side</span>
          </label>
          {#if ov?.facades?.side}
            <label class="control-row checkbox">
              <input
                type="checkbox"
                checked={!!ov.facades.side.enabled}
                oninput={(e) => {
                  const checked = (e.currentTarget as HTMLInputElement).checked;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), enabled: checked } }
                  }));
                }}
              />
              <span class="setting-title">Side enable</span>
            </label>
            <label class="control-row">
              <span class="setting-title">Tint</span>
              <input
                type="color"
                value={ov.facades.side.tintColor ?? config.facades.side.tintColor}
                oninput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), tintColor: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Tint amount: {Number(ov.facades.side.tintAmount ?? config.facades.side.tintAmount).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.tintAmount ?? config.facades.side.tintAmount)}
                min="0"
                max="1"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), tintAmount: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Material amount: {Number(ov.facades.side.materialAmount ?? config.facades.side.materialAmount).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.materialAmount ?? config.facades.side.materialAmount)}
                min="0"
                max="1"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), materialAmount: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Roughness: {Number(ov.facades.side.roughness ?? config.facades.side.roughness).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.roughness ?? config.facades.side.roughness)}
                min="0"
                max="1"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), roughness: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Metalness: {Number(ov.facades.side.metalness ?? config.facades.side.metalness).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.metalness ?? config.facades.side.metalness)}
                min="0"
                max="1"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), metalness: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Clearcoat: {Number(ov.facades.side.clearcoat ?? config.facades.side.clearcoat).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.clearcoat ?? config.facades.side.clearcoat)}
                min="0"
                max="1"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), clearcoat: v } }
                  }));
                }}
              />
            </label>

            <label class="control-row slider">
              <span class="setting-title">Env mult: {Number(ov.facades.side.envIntensityMult ?? config.facades.side.envIntensityMult).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.facades.side.envIntensityMult ?? config.facades.side.envIntensityMult)}
                min="0"
                max="3"
                step="0.01"
                disabled={!ov.facades.side.enabled}
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    facades: { ...(cur?.facades ?? {}), side: { ...(cur?.facades?.side ?? {}), envIntensityMult: v } }
                  }));
                }}
              />
            </label>
          {/if}
        {/if}
      </details>
    {/if}

    {#if config.type === 'popsicle'}
      <details class="control-details">
        <summary class="control-details-summary">Edge</summary>
        <label class="control-row checkbox">
          <input type="checkbox" checked={!!ov?.edge} oninput={() => togglePaletteBlock(index, 'edge')} />
          <span class="setting-title">Override edge</span>
        </label>
        {#if ov?.edge}
          <label class="control-row checkbox">
            <input
              type="checkbox"
              checked={!!ov.edge.hollow}
              oninput={(e) => {
                const checked = (e.currentTarget as HTMLInputElement).checked;
                updatePaletteOverride(index, (cur) => ({
                  ...(cur ?? { enabled: true }),
                  enabled: true,
                  edge: { ...(cur?.edge ?? {}), hollow: checked }
                }));
              }}
            />
            <span class="setting-title">Hollow</span>
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Seam</summary>
            <label class="control-row checkbox">
              <input
                type="checkbox"
                checked={!!ov.edge.seam?.enabled}
                oninput={(e) => {
                  const checked = (e.currentTarget as HTMLInputElement).checked;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), enabled: checked } }
                  }));
                }}
              />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input
                type="color"
                value={ov.edge.seam?.color ?? config.edge.seam.color}
                oninput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), color: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {Number(ov.edge.seam?.opacity ?? config.edge.seam.opacity).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.seam?.opacity ?? config.edge.seam.opacity)}
                min="0"
                max="1"
                step="0.01"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), opacity: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Number(ov.edge.seam?.width ?? config.edge.seam.width).toFixed(3)}</span>
              <input
                type="range"
                value={Number(ov.edge.seam?.width ?? config.edge.seam.width)}
                min="0"
                max="0.25"
                step="0.001"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), width: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Noise: {Number(ov.edge.seam?.noise ?? config.edge.seam.noise).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.seam?.noise ?? config.edge.seam.noise)}
                min="0"
                max="1"
                step="0.01"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), noise: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Emissive: {Number(ov.edge.seam?.emissiveIntensity ?? config.edge.seam.emissiveIntensity).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.seam?.emissiveIntensity ?? config.edge.seam.emissiveIntensity)}
                min="0"
                max="20"
                step="0.1"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), seam: { ...(cur?.edge?.seam ?? {}), emissiveIntensity: v } }
                  }));
                }}
              />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Band</summary>
            <label class="control-row checkbox">
              <input
                type="checkbox"
                checked={!!ov.edge.band?.enabled}
                oninput={(e) => {
                  const checked = (e.currentTarget as HTMLInputElement).checked;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), enabled: checked } }
                  }));
                }}
              />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input
                type="color"
                value={ov.edge.band?.color ?? config.edge.band.color}
                oninput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), color: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {Number(ov.edge.band?.opacity ?? config.edge.band.opacity).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.band?.opacity ?? config.edge.band.opacity)}
                min="0"
                max="1"
                step="0.01"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), opacity: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Number(ov.edge.band?.width ?? config.edge.band.width).toFixed(3)}</span>
              <input
                type="range"
                value={Number(ov.edge.band?.width ?? config.edge.band.width)}
                min="0"
                max="0.6"
                step="0.001"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), width: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Noise: {Number(ov.edge.band?.noise ?? config.edge.band.noise).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.band?.noise ?? config.edge.band.noise)}
                min="0"
                max="1"
                step="0.01"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), noise: v } }
                  }));
                }}
              />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Emissive: {Number(ov.edge.band?.emissiveIntensity ?? config.edge.band.emissiveIntensity).toFixed(2)}</span>
              <input
                type="range"
                value={Number(ov.edge.band?.emissiveIntensity ?? config.edge.band.emissiveIntensity)}
                min="0"
                max="20"
                step="0.1"
                oninput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  updatePaletteOverride(index, (cur) => ({
                    ...(cur ?? { enabled: true }),
                    enabled: true,
                    edge: { ...(cur?.edge ?? {}), band: { ...(cur?.edge?.band ?? {}), emissiveIntensity: v } }
                  }));
                }}
              />
            </label>
          </details>
        {/if}
      </details>
    {/if}
  {/if}
</details>
