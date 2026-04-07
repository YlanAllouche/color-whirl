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
  <summary class="control-details-summary">Voronoi</summary>
  <label class="control-row checkbox">
    <input type="checkbox" checked={!!ov?.voronoi} oninput={() => togglePaletteBlock(index, 'voronoi')} />
    <span class="setting-title">Override voronoi</span>
  </label>

  {#if ov?.voronoi}
    <label class="control-row checkbox">
      <input
        type="checkbox"
        checked={!!(ov.voronoi.enabled ?? (config as any).voronoi.enabled)}
        oninput={(e) => {
          const checked = (e.currentTarget as HTMLInputElement).checked;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), enabled: checked }
          }));
        }}
      />
      <span class="setting-title">Enable</span>
    </label>
    <label class="control-row">
      <span class="setting-title">Kind</span>
      <Dropdown
        value={ov.voronoi.kind ?? (config as any).voronoi.kind}
        ariaLabel="Voronoi kind"
        options={[
          { value: 'edges', label: 'Edges' },
          { value: 'cells', label: 'Cells' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), kind: v }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Space</span>
      <Dropdown
        value={ov.voronoi.space ?? (config as any).voronoi.space}
        ariaLabel="Voronoi space"
        options={[
          { value: 'world', label: 'World' },
          { value: 'object', label: 'Object' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), space: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Scale: {Number(ov.voronoi.scale ?? (config as any).voronoi.scale).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.scale ?? (config as any).voronoi.scale)}
        min="0.1"
        max="30"
        step="0.1"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), scale: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Amount: {Number(ov.voronoi.amount ?? (config as any).voronoi.amount).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.amount ?? (config as any).voronoi.amount)}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), amount: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Edge width: {Number(ov.voronoi.edgeWidth ?? (config as any).voronoi.edgeWidth).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.edgeWidth ?? (config as any).voronoi.edgeWidth)}
        min="0"
        max="1"
        step="0.01"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || ((ov.voronoi.kind ?? (config as any).voronoi.kind) !== 'edges' && (ov.voronoi.materialKind ?? (config as any).voronoi.materialKind) !== 'edges')}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), edgeWidth: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Softness: {Number(ov.voronoi.softness ?? (config as any).voronoi.softness).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.softness ?? (config as any).voronoi.softness)}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), softness: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Crackle: {Number(ov.voronoi.crackleAmount ?? (config as any).voronoi.crackleAmount).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.crackleAmount ?? (config as any).voronoi.crackleAmount)}
        min="0"
        max="1"
        step="0.01"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || ((ov.voronoi.kind ?? (config as any).voronoi.kind) !== 'edges' && (ov.voronoi.materialKind ?? (config as any).voronoi.materialKind) !== 'edges')}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), crackleAmount: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Crackle scale: {Number(ov.voronoi.crackleScale ?? (config as any).voronoi.crackleScale).toFixed(1)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.crackleScale ?? (config as any).voronoi.crackleScale)}
        min="0"
        max="80"
        step="0.5"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || !(Number(ov.voronoi.crackleAmount ?? (config as any).voronoi.crackleAmount) > 0) || ((ov.voronoi.kind ?? (config as any).voronoi.kind) !== 'edges' && (ov.voronoi.materialKind ?? (config as any).voronoi.materialKind) !== 'edges')}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), crackleScale: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Color strength: {Number(ov.voronoi.colorStrength ?? (config as any).voronoi.colorStrength).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.colorStrength ?? (config as any).voronoi.colorStrength)}
        min="0"
        max="1"
        step="0.01"
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), colorStrength: v }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Material mode</span>
      <Dropdown
        value={ov.voronoi.materialMode ?? (config as any).voronoi.materialMode}
        ariaLabel="Voronoi material mode"
        options={[
          { value: 'none', label: 'None' },
          { value: 'roughness', label: 'Roughness' },
          { value: 'normal', label: 'Normal' },
          { value: 'both', label: 'Both' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), materialMode: v }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Material mask</span>
      <Dropdown
        value={ov.voronoi.materialKind ?? (config as any).voronoi.materialKind}
        ariaLabel="Voronoi material kind"
        options={[
          { value: 'match', label: 'Match kind' },
          { value: 'edges', label: 'Edges' },
          { value: 'cells', label: 'Cells' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), materialKind: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Roughness feel: {Number(ov.voronoi.roughnessStrength ?? (config as any).voronoi.roughnessStrength).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.roughnessStrength ?? (config as any).voronoi.roughnessStrength)}
        min="0"
        max="1"
        step="0.01"
        disabled={['none', 'normal'].includes(ov.voronoi.materialMode ?? (config as any).voronoi.materialMode)}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), roughnessStrength: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Normal feel: {Number(ov.voronoi.normalStrength ?? (config as any).voronoi.normalStrength).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.normalStrength ?? (config as any).voronoi.normalStrength)}
        min="0"
        max="1"
        step="0.01"
        disabled={['none', 'roughness'].includes(ov.voronoi.materialMode ?? (config as any).voronoi.materialMode)}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), normalStrength: v }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Normal scale: {Number(ov.voronoi.normalScale ?? (config as any).voronoi.normalScale).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.normalScale ?? (config as any).voronoi.normalScale)}
        min="0"
        max="1"
        step="0.01"
        disabled={['none', 'roughness'].includes(ov.voronoi.materialMode ?? (config as any).voronoi.materialMode)}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), normalScale: v }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Color mode</span>
      <Dropdown
        value={ov.voronoi.colorMode ?? (config as any).voronoi.colorMode}
        ariaLabel="Voronoi color mode"
        options={[
          { value: 'darken', label: 'Darken' },
          { value: 'lighten', label: 'Lighten' },
          { value: 'tint', label: 'Tint' }
        ]}
        onChange={(value) => {
          const v = String(value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), colorMode: v }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Tint</span>
      <input
        type="color"
        value={ov.voronoi.tintColor ?? (config as any).voronoi.tintColor}
        oninput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), tintColor: v }
          }));
        }}
      />
    </label>

    <label class="control-row checkbox">
      <input
        type="checkbox"
        checked={!!(ov.voronoi.nucleus?.enabled ?? (config as any).voronoi.nucleus.enabled)}
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled))}
        oninput={(e) => {
          const checked = (e.currentTarget as HTMLInputElement).checked;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), enabled: checked } }
          }));
        }}
      />
      <span class="setting-title">Nucleus</span>
    </label>
    <label class="control-row slider">
      <span class="setting-title">Nucleus size: {Number(ov.voronoi.nucleus?.size ?? (config as any).voronoi.nucleus.size).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.nucleus?.size ?? (config as any).voronoi.nucleus.size)}
        min="0"
        max="0.5"
        step="0.01"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || !((ov.voronoi.nucleus?.enabled ?? (config as any).voronoi.nucleus.enabled))}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), size: v } }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Nucleus softness: {Number(ov.voronoi.nucleus?.softness ?? (config as any).voronoi.nucleus.softness).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.nucleus?.softness ?? (config as any).voronoi.nucleus.softness)}
        min="0"
        max="1"
        step="0.01"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || !((ov.voronoi.nucleus?.enabled ?? (config as any).voronoi.nucleus.enabled))}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), softness: v } }
          }));
        }}
      />
    </label>
    <label class="control-row slider">
      <span class="setting-title">Nucleus strength: {Number(ov.voronoi.nucleus?.strength ?? (config as any).voronoi.nucleus.strength).toFixed(2)}</span>
      <input
        type="range"
        value={Number(ov.voronoi.nucleus?.strength ?? (config as any).voronoi.nucleus.strength)}
        min="0"
        max="1"
        step="0.01"
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || !((ov.voronoi.nucleus?.enabled ?? (config as any).voronoi.nucleus.enabled))}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), strength: v } }
          }));
        }}
      />
    </label>
    <label class="control-row">
      <span class="setting-title">Nucleus color</span>
      <input
        type="color"
        value={ov.voronoi.nucleus?.color ?? (config as any).voronoi.nucleus.color}
        disabled={!((ov.voronoi.enabled ?? (config as any).voronoi.enabled)) || !((ov.voronoi.nucleus?.enabled ?? (config as any).voronoi.nucleus.enabled))}
        oninput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          updatePaletteOverride(index, (cur) => ({
            ...(cur ?? { enabled: true }),
            enabled: true,
            voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), color: v } }
          }));
        }}
      />
    </label>
  {/if}
</details>
