<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import IconPicker from '$lib/icons/IconPicker.svelte';

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
</script>

      <!-- Facades / Edge -->
      {#if config.type === 'popsicle'}
        <section class="control-section">
          <h3>Facades</h3>

          <details class="control-details">
            <summary class="control-details-summary">Grazing</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.facades.grazing.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('facades.grazing.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('facades.grazing.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.mode')} onclick={() => toggleLock('facades.grazing.mode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.facades.grazing.mode} disabled={!config.facades.grazing.enabled}>
                <option value="add">Add</option>
                <option value="mix">Mix</option>
              </select>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.color')} onclick={() => toggleLock('facades.grazing.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.facades.grazing.color} disabled={!config.facades.grazing.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.strength')} onclick={() => toggleLock('facades.grazing.strength')} title="Click to lock/unlock for randomize">Strength: {config.facades.grazing.strength.toFixed(2)}</button>
              <input
                type="range"
                bind:value={config.facades.grazing.strength}
                min="0"
                max={config.facades.grazing.mode === 'add' ? 5 : 1}
                step="0.01"
                disabled={!config.facades.grazing.enabled}
              />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.power')} onclick={() => toggleLock('facades.grazing.power')} title="Click to lock/unlock for randomize">Power: {config.facades.grazing.power.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.grazing.power} min="0.5" max="8" step="0.05" disabled={!config.facades.grazing.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.width')} onclick={() => toggleLock('facades.grazing.width')} title="Click to lock/unlock for randomize">Width: {config.facades.grazing.width.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.grazing.width} min="0" max="1" step="0.01" disabled={!config.facades.grazing.enabled || config.facades.grazing.mode === 'add'} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.grazing.noise')} onclick={() => toggleLock('facades.grazing.noise')} title="Click to lock/unlock for randomize">Noise: {config.facades.grazing.noise.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.grazing.noise} min="0" max="1" step="0.01" disabled={!config.facades.grazing.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Side</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.facades.side.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('facades.side.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('facades.side.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.tintColor')} onclick={() => toggleLock('facades.side.tintColor')} title="Click to lock/unlock for randomize">Tint</button>
              <input type="color" bind:value={config.facades.side.tintColor} disabled={!config.facades.side.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.tintAmount')} onclick={() => toggleLock('facades.side.tintAmount')} title="Click to lock/unlock for randomize">Tint amount: {config.facades.side.tintAmount.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.tintAmount} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.materialAmount')} onclick={() => toggleLock('facades.side.materialAmount')} title="Click to lock/unlock for randomize">Material amount: {config.facades.side.materialAmount.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.materialAmount} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.roughness')} onclick={() => toggleLock('facades.side.roughness')} title="Click to lock/unlock for randomize">Roughness: {config.facades.side.roughness.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.roughness} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.metalness')} onclick={() => toggleLock('facades.side.metalness')} title="Click to lock/unlock for randomize">Metalness: {config.facades.side.metalness.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.metalness} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.clearcoat')} onclick={() => toggleLock('facades.side.clearcoat')} title="Click to lock/unlock for randomize">Clearcoat: {config.facades.side.clearcoat.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.clearcoat} min="0" max="1" step="0.01" disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.side.envIntensityMult')} onclick={() => toggleLock('facades.side.envIntensityMult')} title="Click to lock/unlock for randomize">Env mult: {config.facades.side.envIntensityMult.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.side.envIntensityMult} min="0" max="3" step="0.01" disabled={!config.facades.side.enabled || config.facades.side.materialAmount <= 0} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Outline</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.facades.outline.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('facades.outline.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('facades.outline.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('facades.outline.color')} onclick={() => toggleLock('facades.outline.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.facades.outline.color} disabled={!config.facades.outline.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.outline.thickness')} onclick={() => toggleLock('facades.outline.thickness')} title="Click to lock/unlock for randomize">Thickness: {config.facades.outline.thickness.toFixed(3)}</button>
              <input type="range" bind:value={config.facades.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.facades.outline.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('facades.outline.opacity')} onclick={() => toggleLock('facades.outline.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.facades.outline.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.facades.outline.opacity} min="0" max="1" step="0.01" disabled={!config.facades.outline.enabled} />
            </label>
          </details>
        </section>

        <section class="control-section">
          <h3>Edge</h3>

          <details class="control-details">
            <summary class="control-details-summary">Seam line</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.edge.seam.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('edge.seam.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('edge.seam.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('edge.seam.color')} onclick={() => toggleLock('edge.seam.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.edge.seam.color} disabled={!config.edge.seam.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.seam.opacity')} onclick={() => toggleLock('edge.seam.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.edge.seam.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.seam.opacity} min="0" max="1" step="0.01" disabled={!config.edge.seam.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.seam.width')} onclick={() => toggleLock('edge.seam.width')} title="Click to lock/unlock for randomize">Width: {config.edge.seam.width.toFixed(3)}</button>
              <input type="range" bind:value={config.edge.seam.width} min="0" max="0.12" step="0.001" disabled={!config.edge.seam.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.seam.noise')} onclick={() => toggleLock('edge.seam.noise')} title="Click to lock/unlock for randomize">Noise: {config.edge.seam.noise.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.seam.noise} min="0" max="1" step="0.01" disabled={!config.edge.seam.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.seam.emissiveIntensity')} onclick={() => toggleLock('edge.seam.emissiveIntensity')} title="Click to lock/unlock for randomize">Emissive: {config.edge.seam.emissiveIntensity.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.seam.emissiveIntensity} min="0" max="20" step="0.05" disabled={!config.edge.seam.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Band</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.edge.band.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('edge.band.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('edge.band.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('edge.band.color')} onclick={() => toggleLock('edge.band.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.edge.band.color} disabled={!config.edge.band.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.band.opacity')} onclick={() => toggleLock('edge.band.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.edge.band.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.band.opacity} min="0" max="1" step="0.01" disabled={!config.edge.band.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.band.width')} onclick={() => toggleLock('edge.band.width')} title="Click to lock/unlock for randomize">Width: {config.edge.band.width.toFixed(3)}</button>
              <input type="range" bind:value={config.edge.band.width} min="0" max="0.25" step="0.001" disabled={!config.edge.band.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.band.noise')} onclick={() => toggleLock('edge.band.noise')} title="Click to lock/unlock for randomize">Noise: {config.edge.band.noise.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.band.noise} min="0" max="1" step="0.01" disabled={!config.edge.band.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('edge.band.emissiveIntensity')} onclick={() => toggleLock('edge.band.emissiveIntensity')} title="Click to lock/unlock for randomize">Emissive: {config.edge.band.emissiveIntensity.toFixed(2)}</button>
              <input type="range" bind:value={config.edge.band.emissiveIntensity} min="0" max="20" step="0.05" disabled={!config.edge.band.enabled} />
            </label>
          </details>
        </section>

      {:else if supportsOutlineOnly}
        <section class="control-section">
          <h3>Outline</h3>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.facades.outline.enabled} />
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('facades.outline.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('facades.outline.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Enable
            </button>
          </label>
          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('facades.outline.color')} onclick={() => toggleLock('facades.outline.color')} title="Click to lock/unlock for randomize">Color</button>
            <input type="color" bind:value={config.facades.outline.color} disabled={!config.facades.outline.enabled} />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('facades.outline.thickness')} onclick={() => toggleLock('facades.outline.thickness')} title="Click to lock/unlock for randomize">Thickness: {config.facades.outline.thickness.toFixed(3)}</button>
            <input type="range" bind:value={config.facades.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.facades.outline.enabled} />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('facades.outline.opacity')} onclick={() => toggleLock('facades.outline.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.facades.outline.opacity.toFixed(2)}</button>
            <input type="range" bind:value={config.facades.outline.opacity} min="0" max="1" step="0.01" disabled={!config.facades.outline.enabled} />
          </label>
        </section>
      {/if}

      {#if config.type === 'popsicle' || config.type === 'spheres3d'}
        <section class="control-section">
          <h3>Bubbles</h3>

          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={(config as any).bubbles.enabled} />
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('bubbles.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('bubbles.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Enable
            </button>
          </label>

          <label class="control-row checkbox">
            <input
              type="checkbox"
              bind:checked={(config as any).bubbles.interior.enabled}
              disabled={!(config as any).bubbles.enabled || (config as any).bubbles.mode !== 'through'}
            />
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('bubbles.interior.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('bubbles.interior.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Interior surfaces
            </button>
          </label>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.mode')} onclick={() => toggleLock('bubbles.mode')} title="Click to lock/unlock for randomize">
              Mode
            </button>
            <select bind:value={(config as any).bubbles.mode} disabled={!(config as any).bubbles.enabled}>
              <option value="through">Through</option>
              <option value="cap">Cap</option>
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.count')} onclick={() => toggleLock('bubbles.count')} title="Click to lock/unlock for randomize">Samples: {Math.round((config as any).bubbles.count)}</button>
            <input type="range" bind:value={(config as any).bubbles.count} min="1" max="8" step="1" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.frequency')} onclick={() => toggleLock('bubbles.frequency')} title="Click to lock/unlock for randomize">Frequency: {(config as any).bubbles.frequency.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.frequency} min="0.2" max="8" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.frequencyVariance')} onclick={() => toggleLock('bubbles.frequencyVariance')} title="Click to lock/unlock for randomize">Variance: {(config as any).bubbles.frequencyVariance.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.frequencyVariance} min="0" max="1" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.radiusMin')} onclick={() => toggleLock('bubbles.radiusMin')} title="Click to lock/unlock for randomize">Radius min: {(config as any).bubbles.radiusMin.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.radiusMin} min="0" max="1.5" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.radiusMax')} onclick={() => toggleLock('bubbles.radiusMax')} title="Click to lock/unlock for randomize">Radius max: {(config as any).bubbles.radiusMax.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.radiusMax} min="0" max="2.5" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.softness')} onclick={() => toggleLock('bubbles.softness')} title="Click to lock/unlock for randomize">Softness: {(config as any).bubbles.softness.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.softness} min="0" max="0.5" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.wallThickness')} onclick={() => toggleLock('bubbles.wallThickness')} title="Click to lock/unlock for randomize">Wall thickness: {(config as any).bubbles.wallThickness.toFixed(2)}</button>
            <input type="range" bind:value={(config as any).bubbles.wallThickness} min="0" max="1" step="0.01" disabled={!(config as any).bubbles.enabled} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bubbles.seedOffset')} onclick={() => toggleLock('bubbles.seedOffset')} title="Click to lock/unlock for randomize">Seed offset: {Math.round((config as any).bubbles.seedOffset)}</button>
            <input type="range" bind:value={(config as any).bubbles.seedOffset} min="-200" max="200" step="1" disabled={!(config as any).bubbles.enabled} />
          </label>
        </section>
      {/if}
        
       {#if config.type === 'popsicle'}
         <!-- Stick Settings -->
          <section class="control-section">
            <h3>Stick Settings</h3>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={isLocked('stickCount')} onclick={() => toggleLock('stickCount')} title="Click to lock/unlock for randomize">Count: {config.stickCount}</button>
            <input type="range" bind:value={config.stickCount} min="1" max="200" />
          </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('stickGap')} onclick={() => toggleLock('stickGap')} title="Click to lock/unlock for randomize">Gap: {config.stickGap.toFixed(2)}</button>
             <input type="range" bind:value={config.stickGap} min="0" max="5.0" step="0.01" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('stickSize')} onclick={() => toggleLock('stickSize')} title="Click to lock/unlock for randomize">Size: {config.stickSize.toFixed(2)}</button>
             <input type="range" bind:value={config.stickSize} min="0.25" max="2.5" step="0.01" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('stickRatio')} onclick={() => toggleLock('stickRatio')} title="Click to lock/unlock for randomize">Ratio: {config.stickRatio.toFixed(2)}</button>
             <input type="range" bind:value={config.stickRatio} min="0.5" max="12" step="0.05" />
            </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('stickThickness')} onclick={() => toggleLock('stickThickness')} title="Click to lock/unlock for randomize">Thickness: {config.stickThickness.toFixed(1)}</button>
               <input type="range" bind:value={config.stickThickness} min="0.1" max="3.0" step="0.1" />
             </label>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('stickEndProfile')} onclick={() => toggleLock('stickEndProfile')} title="Click to lock/unlock for randomize">End profile</button>
              <select bind:value={config.stickEndProfile}>
                <option value="rounded">Rounded</option>
                <option value="chamfer">Chamfer</option>
                <option value="chipped">Chipped</option>
              </select>
            </label>

            <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('stickRoundness')} onclick={() => toggleLock('stickRoundness')} title="Click to lock/unlock for randomize">Roundness: {config.stickRoundness.toFixed(2)}</button>
              <input type="range" bind:value={config.stickRoundness} min="0" max="1" step="0.01" />
            </label>

            {#if config.stickEndProfile === 'chipped'}
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('stickChipAmount')} onclick={() => toggleLock('stickChipAmount')} title="Click to lock/unlock for randomize">Chip amount: {config.stickChipAmount.toFixed(2)}</button>
                <input type="range" bind:value={config.stickChipAmount} min="0" max="1" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('stickChipJaggedness')} onclick={() => toggleLock('stickChipJaggedness')} title="Click to lock/unlock for randomize">Chip jaggedness: {config.stickChipJaggedness.toFixed(2)}</button>
                <input type="range" bind:value={config.stickChipJaggedness} min="0" max="1" step="0.01" />
              </label>
            {/if}
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('stickBevel')} onclick={() => toggleLock('stickBevel')} title="Click to lock/unlock for randomize">Bevel: {config.stickBevel.toFixed(2)}</button>
             <input type="range" bind:value={config.stickBevel} min="0" max="1" step="0.01" />
            </label>
            <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('stickOpacity')} onclick={() => toggleLock('stickOpacity')} title="Click to lock/unlock for randomize">Opacity: {config.stickOpacity.toFixed(2)}</button>
              <input type="range" bind:value={config.stickOpacity} min="0" max="1" step="0.01" />
            </label>

            <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
              <label class="control-row checkbox">
                <input type="checkbox" bind:checked={config.edge.hollow} />
                <button
                  type="button"
                  class="setting-title"
                  class:locked={isLocked('edge.hollow')}
                  onclick={(e) => {
                    e.preventDefault();
                    toggleLock('edge.hollow');
                  }}
                  title="Click to lock/unlock for randomize"
                >
                  Hollow caps
                </button>
              </label>
            </div>
           
           <!-- Helix Settings -->
           <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('stickOverhang')} onclick={() => toggleLock('stickOverhang')} title="Click to lock/unlock for randomize">Overhang: {config.stickOverhang.toFixed(0)}°</button>
               <input type="range" bind:value={config.stickOverhang} min="0" max="180" step="1" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('rotationCenterOffsetX')} onclick={() => toggleLock('rotationCenterOffsetX')} title="Click to lock/unlock for randomize">Rotation Center X: {config.rotationCenterOffsetX.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetX} min="-100" max="100" step="5" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('rotationCenterOffsetY')} onclick={() => toggleLock('rotationCenterOffsetY')} title="Click to lock/unlock for randomize">Rotation Center Y: {config.rotationCenterOffsetY.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetY} min="-100" max="100" step="5" />
             </label>
            </div>
         </section>
       {:else if config.type === 'spheres3d'}
        <section class="control-section">
          <h3>Spheres (3D)</h3>

          <details class="control-details">
            <summary class="control-details-summary">Shape</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.kind')} onclick={() => toggleLock('spheres.shape.kind')} title="Click to lock/unlock for randomize">Kind</button>
              <select bind:value={config.spheres.shape.kind}>
                <option value="uvSphere">UV sphere</option>
                <option value="spherifiedBox">Spherified box</option>
                <option value="geodesicPoly">Geodesic poly</option>
              </select>
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.roundness')} onclick={() => toggleLock('spheres.shape.roundness')} title="Click to lock/unlock for randomize">Roundness: {config.spheres.shape.roundness.toFixed(2)}</button>
              <input type="range" bind:value={config.spheres.shape.roundness} min="0" max="1" step="0.01" disabled={config.spheres.shape.kind === 'uvSphere'} />
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('spheres.shape.faceting')} onclick={() => toggleLock('spheres.shape.faceting')} title="Click to lock/unlock for randomize">Faceting: {config.spheres.shape.faceting.toFixed(2)}</button>
              <input type="range" bind:value={config.spheres.shape.faceting} min="0" max="1" step="0.01" disabled={config.spheres.shape.kind === 'uvSphere'} />
            </label>
          </details>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.count')} onclick={() => toggleLock('spheres.count')} title="Click to lock/unlock for randomize">Count: {config.spheres.count}</button>
            <input type="range" bind:value={config.spheres.count} min="1" max="800" step="1" />
          </label>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.distribution')} onclick={() => toggleLock('spheres.distribution')} title="Click to lock/unlock for randomize">Distribution</button>
            <select bind:value={config.spheres.distribution}>
              <option value="jitteredGrid">Jittered grid</option>
              <option value="scatter">Scatter</option>
              <option value="layeredDepth">Layered depth</option>
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.radiusMin')} onclick={() => toggleLock('spheres.radiusMin')} title="Click to lock/unlock for randomize">Radius min: {config.spheres.radiusMin.toFixed(2)}</button>
            <input type="range" bind:value={config.spheres.radiusMin} min="0.05" max="2.0" step="0.01" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.radiusMax')} onclick={() => toggleLock('spheres.radiusMax')} title="Click to lock/unlock for randomize">Radius max: {config.spheres.radiusMax.toFixed(2)}</button>
            <input type="range" bind:value={config.spheres.radiusMax} min="0.05" max="3.5" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.spread')} onclick={() => toggleLock('spheres.spread')} title="Click to lock/unlock for randomize">Spread: {config.spheres.spread.toFixed(2)}</button>
            <input type="range" bind:value={config.spheres.spread} min="0.5" max="20" step="0.05" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.depth')} onclick={() => toggleLock('spheres.depth')} title="Click to lock/unlock for randomize">Depth: {config.spheres.depth.toFixed(2)}</button>
            <input type="range" bind:value={config.spheres.depth} min="0" max="20" step="0.05" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.layers')} onclick={() => toggleLock('spheres.layers')} title="Click to lock/unlock for randomize">Layers: {config.spheres.layers}</button>
            <input type="range" bind:value={config.spheres.layers} min="1" max="16" step="1" disabled={config.spheres.distribution !== 'layeredDepth'} />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('spheres.opacity')} onclick={() => toggleLock('spheres.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.spheres.opacity.toFixed(2)}</button>
            <input type="range" bind:value={config.spheres.opacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('spheres.paletteMode')} onclick={() => toggleLock('spheres.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.spheres.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.spheres.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('spheres')}>Equal weights</button>
                <button
                  type="button"
                  onclick={() => setRandomWeights('spheres')}
                >
                  Random weights
                </button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('spheres.colorWeights')} onclick={() => toggleLock('spheres.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.spheres.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.spheres.colorWeights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('spheres', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'bands2d'}
        <section class="control-section">
          <h3>Bands (2D)</h3>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('bands.mode')} onclick={() => toggleLock('bands.mode')} title="Click to lock/unlock for randomize">Mode</button>
            <select bind:value={config.bands.mode}>
              <option value="waves">Waves</option>
              <option value="chevron">Chevron</option>
              <option value="straight">Straight</option>
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bands.angleDeg')} onclick={() => toggleLock('bands.angleDeg')} title="Click to lock/unlock for randomize">Angle: {Math.round(config.bands.angleDeg)}°</button>
            <input type="range" bind:value={config.bands.angleDeg} min="0" max="360" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bands.bandWidthPx')} onclick={() => toggleLock('bands.bandWidthPx')} title="Click to lock/unlock for randomize">Band width: {Math.round(config.bands.bandWidthPx)}px</button>
            <input type="range" bind:value={config.bands.bandWidthPx} min="2" max="600" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('bands.gapPx')} onclick={() => toggleLock('bands.gapPx')} title="Click to lock/unlock for randomize">Gap: {Math.round(config.bands.gapPx)}px</button>
            <input type="range" bind:value={config.bands.gapPx} min="0" max="300" step="1" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Panel / Clip</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.bands.panel.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('bands.panel.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('bands.panel.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.x')} onclick={() => toggleLock('bands.panel.rectFrac.x')} title="Click to lock/unlock for randomize">X: {Math.round(config.bands.panel.rectFrac.x * 100)}%</button>
              <input type="range" bind:value={config.bands.panel.rectFrac.x} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.y')} onclick={() => toggleLock('bands.panel.rectFrac.y')} title="Click to lock/unlock for randomize">Y: {Math.round(config.bands.panel.rectFrac.y * 100)}%</button>
              <input type="range" bind:value={config.bands.panel.rectFrac.y} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.w')} onclick={() => toggleLock('bands.panel.rectFrac.w')} title="Click to lock/unlock for randomize">Width: {Math.round(config.bands.panel.rectFrac.w * 100)}%</button>
              <input type="range" bind:value={config.bands.panel.rectFrac.w} min="0.02" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.panel.rectFrac.h')} onclick={() => toggleLock('bands.panel.rectFrac.h')} title="Click to lock/unlock for randomize">Height: {Math.round(config.bands.panel.rectFrac.h * 100)}%</button>
              <input type="range" bind:value={config.bands.panel.rectFrac.h} min="0.02" max="1" step="0.01" disabled={!config.bands.panel.enabled} />
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.panel.radiusPx')} onclick={() => toggleLock('bands.panel.radiusPx')} title="Click to lock/unlock for randomize">Radius: {Math.round(config.bands.panel.radiusPx)}px</button>
              <input type="range" bind:value={config.bands.panel.radiusPx} min="0" max="400" step="1" disabled={!config.bands.panel.enabled} />
            </label>

            <details class="control-details" style="margin-top:0.5rem;">
              <summary class="control-details-summary">Panel Fill</summary>
              <label class="control-row checkbox">
                <input type="checkbox" bind:checked={config.bands.panel.fill.enabled} disabled={!config.bands.panel.enabled} />
                <button
                  type="button"
                  class="setting-title"
                  class:locked={isLocked('bands.panel.fill.enabled')}
                  onclick={(e) => {
                    e.preventDefault();
                    toggleLock('bands.panel.fill.enabled');
                  }}
                  title="Click to lock/unlock for randomize"
                >
                  Enabled
                </button>
              </label>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('bands.panel.fill.color')} onclick={() => toggleLock('bands.panel.fill.color')} title="Click to lock/unlock for randomize">Color</button>
                <input type="color" bind:value={config.bands.panel.fill.color} disabled={!config.bands.panel.enabled || !config.bands.panel.fill.enabled} />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.panel.fill.opacity')} onclick={() => toggleLock('bands.panel.fill.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.bands.panel.fill.opacity.toFixed(2)}</button>
                <input type="range" bind:value={config.bands.panel.fill.opacity} min="0" max="1" step="0.01" disabled={!config.bands.panel.enabled || !config.bands.panel.fill.enabled} />
              </label>
            </details>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Fill / Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.bands.fill.enabled} />
              <button type="button" class="setting-title" class:locked={isLocked('bands.fill.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('bands.fill.enabled'); }} title="Click to lock/unlock for randomize">Fill</button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.fill.opacity')} onclick={() => toggleLock('bands.fill.opacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.bands.fill.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.bands.fill.opacity} min="0" max="1" step="0.01" disabled={!config.bands.fill.enabled} />
            </label>

            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.bands.stroke.enabled} />
              <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('bands.stroke.enabled'); }} title="Click to lock/unlock for randomize">Stroke</button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.widthPx')} onclick={() => toggleLock('bands.stroke.widthPx')} title="Click to lock/unlock for randomize">Stroke width: {Math.round(config.bands.stroke.widthPx)}px</button>
              <input type="range" bind:value={config.bands.stroke.widthPx} min="0" max="24" step="1" disabled={!config.bands.stroke.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.color')} onclick={() => toggleLock('bands.stroke.color')} title="Click to lock/unlock for randomize">Stroke color</button>
              <input type="color" bind:value={config.bands.stroke.color} disabled={!config.bands.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bands.stroke.opacity')} onclick={() => toggleLock('bands.stroke.opacity')} title="Click to lock/unlock for randomize">Stroke opacity: {config.bands.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.bands.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.bands.stroke.enabled} />
            </label>
          </details>

          {#if config.bands.mode === 'waves'}
            <details class="control-details">
              <summary class="control-details-summary">Waves</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.waves.amplitudePx')} onclick={() => toggleLock('bands.waves.amplitudePx')} title="Click to lock/unlock for randomize">Amplitude: {Math.round(config.bands.waves.amplitudePx)}px</button>
                <input type="range" bind:value={config.bands.waves.amplitudePx} min="0" max="240" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.waves.wavelengthPx')} onclick={() => toggleLock('bands.waves.wavelengthPx')} title="Click to lock/unlock for randomize">Wavelength: {Math.round(config.bands.waves.wavelengthPx)}px</button>
                <input type="range" bind:value={config.bands.waves.wavelengthPx} min="30" max="2400" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.waves.noiseAmount')} onclick={() => toggleLock('bands.waves.noiseAmount')} title="Click to lock/unlock for randomize">Noise: {config.bands.waves.noiseAmount.toFixed(2)}</button>
                <input type="range" bind:value={config.bands.waves.noiseAmount} min="0" max="1" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.waves.noiseScale')} onclick={() => toggleLock('bands.waves.noiseScale')} title="Click to lock/unlock for randomize">Noise scale: {config.bands.waves.noiseScale.toFixed(2)}</button>
                <input type="range" bind:value={config.bands.waves.noiseScale} min="0.1" max="6" step="0.01" />
              </label>
            </details>
          {:else if config.bands.mode === 'chevron'}
            <details class="control-details">
              <summary class="control-details-summary">Chevron</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.amplitudePx')} onclick={() => toggleLock('bands.chevron.amplitudePx')} title="Click to lock/unlock for randomize">Amplitude: {Math.round(config.bands.chevron.amplitudePx)}px</button>
                <input type="range" bind:value={config.bands.chevron.amplitudePx} min="0" max="320" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.wavelengthPx')} onclick={() => toggleLock('bands.chevron.wavelengthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.bands.chevron.wavelengthPx)}px</button>
                <input type="range" bind:value={config.bands.chevron.wavelengthPx} min="20" max="1200" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.sharpness')} onclick={() => toggleLock('bands.chevron.sharpness')} title="Click to lock/unlock for randomize">Sharpness: {config.bands.chevron.sharpness.toFixed(2)}</button>
                <input type="range" bind:value={config.bands.chevron.sharpness} min="0.1" max="8" step="0.05" />
              </label>

              <label class="control-row checkbox">
                <input type="checkbox" bind:checked={config.bands.chevron.sharedPhase} />
                <button type="button" class="setting-title" class:locked={isLocked('bands.chevron.sharedPhase')} onclick={(e) => { e.preventDefault(); toggleLock('bands.chevron.sharedPhase'); }} title="Click to lock/unlock for randomize">Shared phase (align)</button>
              </label>
            </details>
          {/if}

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('bands.paletteMode')} onclick={() => toggleLock('bands.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.bands.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.bands.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('bands')}>Equal weights</button>
                <button type="button" onclick={() => setRandomWeights('bands')}>Random weights</button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('bands.colorWeights')} onclick={() => toggleLock('bands.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.bands.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input type="range" min="0" max="5" step="0.05" value={config.bands.colorWeights[i] ?? 1} oninput={(e) => updateWeight('bands', i, Number((e.currentTarget as HTMLInputElement).value))} />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'flowlines2d'}
        <section class="control-section">
          <h3>Flowlines (2D)</h3>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('flowlines.frequency')} onclick={() => toggleLock('flowlines.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.flowlines.frequency.toFixed(2)}</button>
            <input type="range" bind:value={config.flowlines.frequency} min="0.05" max="12" step="0.05" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('flowlines.density')} onclick={() => toggleLock('flowlines.density')} title="Click to lock/unlock for randomize">Density: {config.flowlines.density.toFixed(2)}</button>
            <input type="range" bind:value={config.flowlines.density} min="0" max="1" step="0.01" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('flowlines.spacingPx')} onclick={() => toggleLock('flowlines.spacingPx')} title="Click to lock/unlock for randomize">Spacing: {Math.round(config.flowlines.spacingPx)}px</button>
            <input type="range" bind:value={config.flowlines.spacingPx} min="2" max="40" step="1" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Integration</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.spawn')} onclick={() => toggleLock('flowlines.spawn')} title="Click to lock/unlock for randomize">Spawn</button>
              <select bind:value={config.flowlines.spawn}>
                <option value="grid">Grid</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.stepPx')} onclick={() => toggleLock('flowlines.stepPx')} title="Click to lock/unlock for randomize">Step: {config.flowlines.stepPx.toFixed(2)}px</button>
              <input type="range" bind:value={config.flowlines.stepPx} min="0.1" max="6" step="0.05" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.maxSteps')} onclick={() => toggleLock('flowlines.maxSteps')} title="Click to lock/unlock for randomize">Max steps: {config.flowlines.maxSteps}</button>
              <input type="range" bind:value={config.flowlines.maxSteps} min="20" max="1200" step="10" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.maxLines')} onclick={() => toggleLock('flowlines.maxLines')} title="Click to lock/unlock for randomize">Max lines: {config.flowlines.maxLines}</button>
              <input type="range" bind:value={config.flowlines.maxLines} min="0" max="20000" step="50" />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.widthPx')} onclick={() => toggleLock('flowlines.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {config.flowlines.stroke.widthPx.toFixed(2)}px</button>
              <input type="range" bind:value={config.flowlines.stroke.widthPx} min="0.05" max="8" step="0.05" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.opacity')} onclick={() => toggleLock('flowlines.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.flowlines.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.flowlines.stroke.opacity} min="0" max="1" step="0.01" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.stroke.taper')} onclick={() => toggleLock('flowlines.stroke.taper')} title="Click to lock/unlock for randomize">Taper: {config.flowlines.stroke.taper.toFixed(2)}</button>
              <input type="range" bind:value={config.flowlines.stroke.taper} min="0" max="1" step="0.01" />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('flowlines.paletteMode')} onclick={() => toggleLock('flowlines.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.flowlines.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>
            {#if config.flowlines.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('flowlines')}>Equal weights</button>
                <button type="button" onclick={() => setRandomWeights('flowlines')}>Random weights</button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('flowlines.colorWeights')} onclick={() => toggleLock('flowlines.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.flowlines.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input type="range" min="0" max="5" step="0.05" value={config.flowlines.colorWeights[i] ?? 1} oninput={(e) => updateWeight('flowlines', i, Number((e.currentTarget as HTMLInputElement).value))} />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'diamondgrid2d'}
        <section class="control-section">
          <h3>Diamond Grid (2D)</h3>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.tileWidthPx')} onclick={() => toggleLock('diamondgrid.tileWidthPx')} title="Click to lock/unlock for randomize">Tile width: {Math.round(config.diamondgrid.tileWidthPx)}px</button>
            <input type="range" bind:value={config.diamondgrid.tileWidthPx} min="8" max="520" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.tileHeightPx')} onclick={() => toggleLock('diamondgrid.tileHeightPx')} title="Click to lock/unlock for randomize">Tile height: {Math.round(config.diamondgrid.tileHeightPx)}px</button>
            <input type="range" bind:value={config.diamondgrid.tileHeightPx} min="8" max="360" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.marginPx')} onclick={() => toggleLock('diamondgrid.marginPx')} title="Click to lock/unlock for randomize">Margin: {Math.round(config.diamondgrid.marginPx)}px</button>
            <input type="range" bind:value={config.diamondgrid.marginPx} min="0" max="40" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.fillOpacity')} onclick={() => toggleLock('diamondgrid.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.diamondgrid.fillOpacity.toFixed(2)}</button>
            <input type="range" bind:value={config.diamondgrid.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Bevel</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.diamondgrid.bevel.enabled} />
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('diamondgrid.bevel.enabled'); }} title="Click to lock/unlock for randomize">Enable</button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.amount')} onclick={() => toggleLock('diamondgrid.bevel.amount')} title="Click to lock/unlock for randomize">Amount: {config.diamondgrid.bevel.amount.toFixed(2)}</button>
              <input type="range" bind:value={config.diamondgrid.bevel.amount} min="0" max="1" step="0.01" disabled={!config.diamondgrid.bevel.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.lightDeg')} onclick={() => toggleLock('diamondgrid.bevel.lightDeg')} title="Click to lock/unlock for randomize">Light angle: {Math.round(config.diamondgrid.bevel.lightDeg)}°</button>
              <input type="range" bind:value={config.diamondgrid.bevel.lightDeg} min="0" max="360" step="1" disabled={!config.diamondgrid.bevel.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.bevel.variation')} onclick={() => toggleLock('diamondgrid.bevel.variation')} title="Click to lock/unlock for randomize">Variation: {config.diamondgrid.bevel.variation.toFixed(2)}</button>
              <input type="range" bind:value={config.diamondgrid.bevel.variation} min="0" max="1" step="0.01" disabled={!config.diamondgrid.bevel.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Sparkles</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.diamondgrid.sparkles.enabled} />
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.enabled')} onclick={(e) => { e.preventDefault(); toggleLock('diamondgrid.sparkles.enabled'); }} title="Click to lock/unlock for randomize">Enable</button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.density')} onclick={() => toggleLock('diamondgrid.sparkles.density')} title="Click to lock/unlock for randomize">Density: {config.diamondgrid.sparkles.density.toFixed(3)}</button>
              <input type="range" bind:value={config.diamondgrid.sparkles.density} min="0" max="0.5" step="0.001" disabled={!config.diamondgrid.sparkles.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.countMax')} onclick={() => toggleLock('diamondgrid.sparkles.countMax')} title="Click to lock/unlock for randomize">Count max: {config.diamondgrid.sparkles.countMax}</button>
              <input type="range" bind:value={config.diamondgrid.sparkles.countMax} min="1" max="12" step="1" disabled={!config.diamondgrid.sparkles.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.sizeMaxPx')} onclick={() => toggleLock('diamondgrid.sparkles.sizeMaxPx')} title="Click to lock/unlock for randomize">Size max: {config.diamondgrid.sparkles.sizeMaxPx.toFixed(1)}px</button>
              <input type="range" bind:value={config.diamondgrid.sparkles.sizeMaxPx} min="1" max="60" step="0.5" disabled={!config.diamondgrid.sparkles.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.sparkles.opacity')} onclick={() => toggleLock('diamondgrid.sparkles.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.diamondgrid.sparkles.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.diamondgrid.sparkles.opacity} min="0" max="1" step="0.01" disabled={!config.diamondgrid.sparkles.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.coloring.paletteMode')} onclick={() => toggleLock('diamondgrid.coloring.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.diamondgrid.coloring.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>
            {#if config.diamondgrid.coloring.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('diamondgrid')}>Equal weights</button>
                <button type="button" onclick={() => setRandomWeights('diamondgrid')}>Random weights</button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('diamondgrid.coloring.colorWeights')} onclick={() => toggleLock('diamondgrid.coloring.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.diamondgrid.coloring.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input type="range" min="0" max="5" step="0.05" value={config.diamondgrid.coloring.colorWeights[i] ?? 1} oninput={(e) => updateWeight('diamondgrid', i, Number((e.currentTarget as HTMLInputElement).value))} />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'circles2d'}
        <section class="control-section">
          <h3>Circles (2D)</h3>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('circles.mode')} onclick={() => toggleLock('circles.mode')} title="Click to lock/unlock for randomize">Mode</button>
            <select bind:value={config.circles.mode}>
              <option value="scatter">Scatter</option>
              <option value="grid">Grid</option>
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('circles.count')} onclick={() => toggleLock('circles.count')} title="Click to lock/unlock for randomize">Count: {config.circles.count}</button>
            <input type="range" bind:value={config.circles.count} min="0" max="4000" step="10" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('circles.rMinPx')} onclick={() => toggleLock('circles.rMinPx')} title="Click to lock/unlock for randomize">Radius min: {Math.round(config.circles.rMinPx)}px</button>
            <input type="range" bind:value={config.circles.rMinPx} min="1" max="240" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('circles.rMaxPx')} onclick={() => toggleLock('circles.rMaxPx')} title="Click to lock/unlock for randomize">Radius max: {Math.round(config.circles.rMaxPx)}px</button>
            <input type="range" bind:value={config.circles.rMaxPx} min="1" max="420" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('circles.jitter')} onclick={() => toggleLock('circles.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.circles.jitter.toFixed(2)}</button>
            <input type="range" bind:value={config.circles.jitter} min="0" max="1" step="0.01" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('circles.fillOpacity')} onclick={() => toggleLock('circles.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.circles.fillOpacity.toFixed(2)}</button>
            <input type="range" bind:value={config.circles.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.circles.stroke.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('circles.stroke.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('circles.stroke.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.widthPx')} onclick={() => toggleLock('circles.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.circles.stroke.widthPx)}px</button>
              <input type="range" bind:value={config.circles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.circles.stroke.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.color')} onclick={() => toggleLock('circles.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.circles.stroke.color} disabled={!config.circles.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('circles.stroke.opacity')} onclick={() => toggleLock('circles.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.circles.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.circles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.circles.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Croissant</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.circles.croissant.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('circles.croissant.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('circles.croissant.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.innerScale')} onclick={() => toggleLock('circles.croissant.innerScale')} title="Click to lock/unlock for randomize">Inner scale: {config.circles.croissant.innerScale.toFixed(2)}</button>
              <input type="range" bind:value={config.circles.croissant.innerScale} min="0.05" max="0.98" step="0.01" disabled={!config.circles.croissant.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.offset')} onclick={() => toggleLock('circles.croissant.offset')} title="Click to lock/unlock for randomize">Offset: {config.circles.croissant.offset.toFixed(2)}</button>
              <input type="range" bind:value={config.circles.croissant.offset} min="0" max="1" step="0.01" disabled={!config.circles.croissant.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('circles.croissant.angleJitterDeg')} onclick={() => toggleLock('circles.croissant.angleJitterDeg')} title="Click to lock/unlock for randomize">Angle jitter: {Math.round(config.circles.croissant.angleJitterDeg)}deg</button>
              <input type="range" bind:value={config.circles.croissant.angleJitterDeg} min="0" max="180" step="1" disabled={!config.circles.croissant.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('circles.paletteMode')} onclick={() => toggleLock('circles.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.circles.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.circles.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('circles')}>Equal weights</button>
                <button
                  type="button"
                  onclick={() => setRandomWeights('circles')}
                >
                  Random weights
                </button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('circles.colorWeights')} onclick={() => toggleLock('circles.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.circles.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.circles.colorWeights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('circles', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'polygon2d'}
        <section class="control-section">
          <h3>Polygon (2D)</h3>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.mode')} onclick={() => toggleLock('polygons.mode')} title="Click to lock/unlock for randomize">Mode</button>
            <select bind:value={config.polygons.mode}>
              <option value="scatter">Scatter</option>
              <option value="grid">Grid</option>
            </select>
          </label>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.shape')} onclick={() => toggleLock('polygons.shape')} title="Click to lock/unlock for randomize">Shape</button>
            <select bind:value={config.polygons.shape}>
              <option value="polygon">Polygon</option>
              <option value="star">Star</option>
            </select>
          </label>

          {#if config.polygons.mode === 'grid'}
            <details class="control-details">
              <summary class="control-details-summary">Grid</summary>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.kind')} onclick={() => toggleLock('polygons.grid.kind')} title="Click to lock/unlock for randomize">Kind</button>
                <select bind:value={config.polygons.grid.kind}>
                  <option value="square">Square</option>
                  <option value="diamond">Diamond</option>
                </select>
              </label>

              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.cellPx')} onclick={() => toggleLock('polygons.grid.cellPx')} title="Click to lock/unlock for randomize">Cell: {Math.round(config.polygons.grid.cellPx)}px</button>
                <input type="range" bind:value={config.polygons.grid.cellPx} min="6" max="240" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('polygons.grid.jitter')} onclick={() => toggleLock('polygons.grid.jitter')} title="Click to lock/unlock for randomize">Grid jitter: {config.polygons.grid.jitter.toFixed(2)}</button>
                <input type="range" bind:value={config.polygons.grid.jitter} min="0" max="1" step="0.01" />
              </label>
            </details>
          {/if}

          {#if config.polygons.shape === 'star'}
            <details class="control-details">
              <summary class="control-details-summary">Star</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('polygons.star.innerScale')} onclick={() => toggleLock('polygons.star.innerScale')} title="Click to lock/unlock for randomize">Inner scale: {config.polygons.star.innerScale.toFixed(2)}</button>
                <input type="range" bind:value={config.polygons.star.innerScale} min="0.05" max="0.95" step="0.01" />
              </label>
            </details>
          {/if}

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.count')} onclick={() => toggleLock('polygons.count')} title="Click to lock/unlock for randomize">Count: {config.polygons.count}</button>
            <input type="range" bind:value={config.polygons.count} min="0" max="4000" step="10" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.edges')} onclick={() => toggleLock('polygons.edges')} title="Click to lock/unlock for randomize">Edges: {Math.round(config.polygons.edges)}</button>
            <input type="range" bind:value={config.polygons.edges} min="3" max="16" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.rMinPx')} onclick={() => toggleLock('polygons.rMinPx')} title="Click to lock/unlock for randomize">Radius min: {Math.round(config.polygons.rMinPx)}px</button>
            <input type="range" bind:value={config.polygons.rMinPx} min="1" max="240" step="1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.rMaxPx')} onclick={() => toggleLock('polygons.rMaxPx')} title="Click to lock/unlock for randomize">Radius max: {Math.round(config.polygons.rMaxPx)}px</button>
            <input type="range" bind:value={config.polygons.rMaxPx} min="1" max="420" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.jitter')} onclick={() => toggleLock('polygons.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.polygons.jitter.toFixed(2)}</button>
            <input type="range" bind:value={config.polygons.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.rotateJitterDeg')} onclick={() => toggleLock('polygons.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round(config.polygons.rotateJitterDeg)}deg</button>
            <input type="range" bind:value={config.polygons.rotateJitterDeg} min="0" max="360" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('polygons.fillOpacity')} onclick={() => toggleLock('polygons.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.polygons.fillOpacity.toFixed(2)}</button>
            <input type="range" bind:value={config.polygons.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.polygons.stroke.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('polygons.stroke.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('polygons.stroke.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.widthPx')} onclick={() => toggleLock('polygons.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.polygons.stroke.widthPx)}px</button>
              <input type="range" bind:value={config.polygons.stroke.widthPx} min="0" max="24" step="1" disabled={!config.polygons.stroke.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.color')} onclick={() => toggleLock('polygons.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.polygons.stroke.color} disabled={!config.polygons.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('polygons.stroke.opacity')} onclick={() => toggleLock('polygons.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.polygons.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.polygons.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.polygons.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('polygons.paletteMode')} onclick={() => toggleLock('polygons.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.polygons.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.polygons.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('polygons')}>Equal weights</button>
                <button type="button" onclick={() => setRandomWeights('polygons')}>Random weights</button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('polygons.colorWeights')} onclick={() => toggleLock('polygons.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.polygons.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.polygons.colorWeights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('polygons', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>
        </section>
       {:else if config.type === 'svg2d'}
         <section class="control-section">
           <h3>SVG (2D)</h3>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.renderMode')} onclick={() => toggleLock('svg.renderMode')} title="Click to lock/unlock for randomize">Render</button>
              <select bind:value={(config as any).svg.renderMode}>
                <option value="auto">Auto</option>
                <option value="fill">Fill</option>
                <option value="stroke">Stroke</option>
                <option value="fill+stroke">Fill + Stroke</option>
              </select>
            </label>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.colorMode')} onclick={() => toggleLock('svg.colorMode')} title="Click to lock/unlock for randomize">Colors</button>
              <select bind:value={(config as any).svg.colorMode}>
                <option value="palette">Palette</option>
                <option value="svg-to-palette">SVG to palette</option>
              </select>
            </label>
            {#if (config as any).svg.colorMode === 'svg-to-palette'}
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('svg.maxTones')} onclick={() => toggleLock('svg.maxTones')} title="Click to lock/unlock for randomize">Max tones: {Math.round(Number((config as any).svg.maxTones) || 0)}</button>
                <input type="range" bind:value={(config as any).svg.maxTones} min="1" max="24" step="1" />
              </label>
            {/if}

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.source')} onclick={() => toggleLock('svg.source')} title="Click to lock/unlock for randomize">
                Source
              </button>
            </label>
            <textarea
              bind:value={(config as any).svg.source}
              rows="6"
              spellcheck="false"
              style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px;"
            ></textarea>
            {#if renderError}
              <div class="error-box" style="margin-top:0.5rem;">{renderError}</div>
            {/if}

            <details class="control-details">
              <summary class="control-details-summary">Icon picker</summary>
              <IconPicker
                onPick={(svg) => {
                  (config as any).svg = { ...(config as any).svg, source: svg, renderMode: 'auto' };
                  schedulePreviewRender();
                }}
              />
            </details>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.count')} onclick={() => toggleLock('svg.count')} title="Click to lock/unlock for randomize">Count: {(config as any).svg.count}</button>
              <input type="range" bind:value={(config as any).svg.count} min="1" max="4000" step="1" />
            </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.rMinPx')} onclick={() => toggleLock('svg.rMinPx')} title="Click to lock/unlock for randomize">Size min: {Math.round((config as any).svg.rMinPx)}px</button>
             <input type="range" bind:value={(config as any).svg.rMinPx} min="1" max="240" step="1" />
           </label>
           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.rMaxPx')} onclick={() => toggleLock('svg.rMaxPx')} title="Click to lock/unlock for randomize">Size max: {Math.round((config as any).svg.rMaxPx)}px</button>
             <input type="range" bind:value={(config as any).svg.rMaxPx} min="1" max="420" step="1" />
           </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.jitter')} onclick={() => toggleLock('svg.jitter')} title="Click to lock/unlock for randomize">Jitter: {Number((config as any).svg.jitter).toFixed(2)}</button>
             <input type="range" bind:value={(config as any).svg.jitter} min="0" max="1" step="0.01" />
           </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.rotateJitterDeg')} onclick={() => toggleLock('svg.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round((config as any).svg.rotateJitterDeg)}deg</button>
             <input type="range" bind:value={(config as any).svg.rotateJitterDeg} min="0" max="360" step="1" />
           </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.fillOpacity')} onclick={() => toggleLock('svg.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {Number((config as any).svg.fillOpacity).toFixed(2)}</button>
             <input type="range" bind:value={(config as any).svg.fillOpacity} min="0" max="1" step="0.01" />
           </label>

           <details class="control-details">
             <summary class="control-details-summary">Stroke</summary>
             <label class="control-row checkbox">
               <input type="checkbox" bind:checked={(config as any).svg.stroke.enabled} />
               <button
                 type="button"
                 class="setting-title"
                 class:locked={isLocked('svg.stroke.enabled')}
                 onclick={(e) => {
                   e.preventDefault();
                   toggleLock('svg.stroke.enabled');
                 }}
                 title="Click to lock/unlock for randomize"
               >
                 Enable
               </button>
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.widthPx')} onclick={() => toggleLock('svg.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round((config as any).svg.stroke.widthPx)}px</button>
               <input type="range" bind:value={(config as any).svg.stroke.widthPx} min="0" max="24" step="1" disabled={!((config as any).svg.stroke.enabled)} />
             </label>
             <label class="control-row">
               <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.color')} onclick={() => toggleLock('svg.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
               <input type="color" bind:value={(config as any).svg.stroke.color} disabled={!((config as any).svg.stroke.enabled)} />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.opacity')} onclick={() => toggleLock('svg.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number((config as any).svg.stroke.opacity).toFixed(2)}</button>
               <input type="range" bind:value={(config as any).svg.stroke.opacity} min="0" max="1" step="0.01" disabled={!((config as any).svg.stroke.enabled)} />
             </label>
           </details>

           <details class="control-details">
             <summary class="control-details-summary">Palette</summary>
             <label class="control-row">
               <button type="button" class="setting-title" class:locked={isLocked('svg.paletteMode')} onclick={() => toggleLock('svg.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
               <select bind:value={(config as any).svg.paletteMode}>
                 <option value="cycle">Cycle</option>
                 <option value="weighted">Weighted</option>
               </select>
             </label>

             {#if (config as any).svg.paletteMode === 'weighted'}
               <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                 <button type="button" onclick={() => setEqualWeights('svg')}>Equal weights</button>
                 <button type="button" onclick={() => setRandomWeights('svg')}>Random weights</button>
               </div>
               {#each config.colors as c, i}
                 <label class="control-row slider">
                   <button type="button" class="setting-title" class:locked={isLocked('svg.colorWeights')} onclick={() => toggleLock('svg.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(((config as any).svg.colorWeights[i] ?? 1) as number).toFixed(2)} {c}</button>
                   <input
                     type="range"
                     min="0"
                     max="5"
                     step="0.05"
                     value={(config as any).svg.colorWeights[i] ?? 1}
                     oninput={(e) => {
                       updateWeight('svg', i, Number((e.currentTarget as HTMLInputElement).value));
                     }}
                   />
                 </label>
               {/each}
             {/if}
           </details>
         </section>
       {:else if config.type === 'triangles2d'}
         <section class="control-section">
           <h3>Triangles (2D)</h3>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.mode')} onclick={() => toggleLock('triangles.mode')} title="Click to lock/unlock for randomize">Mode</button>
            <select bind:value={config.triangles.mode}>
              <option value="tessellation">Tessellation</option>
              <option value="scatter">Scatter</option>
              <option value="lowpoly">Low poly</option>
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.density')} onclick={() => toggleLock('triangles.density')} title="Click to lock/unlock for randomize">Density: {config.triangles.density.toFixed(2)}</button>
            <input type="range" bind:value={config.triangles.density} min="0.1" max="3.5" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.scalePx')} onclick={() => toggleLock('triangles.scalePx')} title="Click to lock/unlock for randomize">Scale: {Math.round(config.triangles.scalePx)}px</button>
            <input type="range" bind:value={config.triangles.scalePx} min="6" max="320" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.jitter')} onclick={() => toggleLock('triangles.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.triangles.jitter.toFixed(2)}</button>
            <input type="range" bind:value={config.triangles.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.rotateJitterDeg')} onclick={() => toggleLock('triangles.rotateJitterDeg')} title="Click to lock/unlock for randomize">Rotate jitter: {Math.round(config.triangles.rotateJitterDeg)}deg</button>
            <input type="range" bind:value={config.triangles.rotateJitterDeg} min="0" max="180" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.insetPx')} onclick={() => toggleLock('triangles.insetPx')} title="Click to lock/unlock for randomize">Inset: {Math.round(config.triangles.insetPx)}px</button>
            <input type="range" bind:value={config.triangles.insetPx} min="0" max="120" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('triangles.fillOpacity')} onclick={() => toggleLock('triangles.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.triangles.fillOpacity.toFixed(2)}</button>
            <input type="range" bind:value={config.triangles.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.triangles.stroke.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('triangles.stroke.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('triangles.stroke.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.widthPx')} onclick={() => toggleLock('triangles.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.triangles.stroke.widthPx)}px</button>
              <input type="range" bind:value={config.triangles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.triangles.stroke.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.color')} onclick={() => toggleLock('triangles.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.triangles.stroke.color} disabled={!config.triangles.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.stroke.opacity')} onclick={() => toggleLock('triangles.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.triangles.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.triangles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.triangles.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Shading</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.triangles.shading.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('triangles.shading.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('triangles.shading.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.shading.lightDeg')} onclick={() => toggleLock('triangles.shading.lightDeg')} title="Click to lock/unlock for randomize">Light: {Math.round(config.triangles.shading.lightDeg)}deg</button>
              <input type="range" bind:value={config.triangles.shading.lightDeg} min="0" max="360" step="1" disabled={!config.triangles.shading.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.shading.strength')} onclick={() => toggleLock('triangles.shading.strength')} title="Click to lock/unlock for randomize">Strength: {config.triangles.shading.strength.toFixed(2)}</button>
              <input type="range" bind:value={config.triangles.shading.strength} min="0" max="1" step="0.01" disabled={!config.triangles.shading.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('triangles.paletteMode')} onclick={() => toggleLock('triangles.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.triangles.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.triangles.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('triangles2d')}>Equal weights</button>
                <button
                  type="button"
                  onclick={() => setRandomWeights('triangles2d')}
                >
                  Random weights
                </button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('triangles.colorWeights')} onclick={() => toggleLock('triangles.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.triangles.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.triangles.colorWeights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('triangles2d', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>
         </section>
       {:else if config.type === 'ridges2d'}
          <section class="control-section">
            <h3>Ridges (2D)</h3>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('ridges.gridStepPx')} onclick={() => toggleLock('ridges.gridStepPx')} title="Click to lock/unlock for randomize">Grid step: {Math.round(config.ridges.gridStepPx)}px</button>
              <input type="range" bind:value={config.ridges.gridStepPx} min="2" max="24" step="1" />
            </label>

            <details class="control-details" open>
              <summary class="control-details-summary">Field detail</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.frequency')} onclick={() => toggleLock('ridges.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.ridges.frequency.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.frequency} min="0.1" max="8" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.detailFrequency')} onclick={() => toggleLock('ridges.detailFrequency')} title="Click to lock/unlock for randomize">Detail freq: {config.ridges.detailFrequency.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.detailFrequency} min="0.1" max="25" step="0.1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.detailAmplitude')} onclick={() => toggleLock('ridges.detailAmplitude')} title="Click to lock/unlock for randomize">Detail amp: {config.ridges.detailAmplitude.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.detailAmplitude} min="0" max="1" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.octaves')} onclick={() => toggleLock('ridges.octaves')} title="Click to lock/unlock for randomize">Octaves: {Math.round(config.ridges.octaves)}</button>
                <input type="range" bind:value={config.ridges.octaves} min="1" max="8" step="1" />
              </label>
            </details>

            <details class="control-details" open>
              <summary class="control-details-summary">Warp</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.warpAmount')} onclick={() => toggleLock('ridges.warpAmount')} title="Click to lock/unlock for randomize">Warp: {config.ridges.warpAmount.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.warpAmount} min="0" max="3" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.warpFrequency')} onclick={() => toggleLock('ridges.warpFrequency')} title="Click to lock/unlock for randomize">Warp freq: {config.ridges.warpFrequency.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.warpFrequency} min="0.1" max="6" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.warpDepth')} onclick={() => toggleLock('ridges.warpDepth')} title="Click to lock/unlock for randomize">Warp depth: {config.ridges.warpDepth.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.warpDepth} min="0" max="1" step="0.01" />
              </label>
            </details>

            <details class="control-details" open>
              <summary class="control-details-summary">Remap</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.contrast')} onclick={() => toggleLock('ridges.contrast')} title="Click to lock/unlock for randomize">Contrast: {config.ridges.contrast.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.contrast} min="0.3" max="3" step="0.01" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.bias')} onclick={() => toggleLock('ridges.bias')} title="Click to lock/unlock for randomize">Bias: {config.ridges.bias.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.bias} min="-0.5" max="0.5" step="0.01" />
              </label>
            </details>

            <details class="control-details" open>
              <summary class="control-details-summary">Contours</summary>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.levels')} onclick={() => toggleLock('ridges.levels')} title="Click to lock/unlock for randomize">Levels: {Math.round(config.ridges.levels)}</button>
                <input type="range" bind:value={config.ridges.levels} min="3" max="36" step="1" />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('ridges.levelJitter')} onclick={() => toggleLock('ridges.levelJitter')} title="Click to lock/unlock for randomize">Level jitter: {config.ridges.levelJitter.toFixed(2)}</button>
                <input type="range" bind:value={config.ridges.levelJitter} min="0" max="0.3" step="0.01" />
              </label>
            </details>

            <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('ridges.lineWidthPx')} onclick={() => toggleLock('ridges.lineWidthPx')} title="Click to lock/unlock for randomize">Line width: {config.ridges.lineWidthPx.toFixed(2)}px</button>
             <input type="range" bind:value={config.ridges.lineWidthPx} min="0.25" max="5" step="0.05" />
           </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('ridges.lineOpacity')} onclick={() => toggleLock('ridges.lineOpacity')} title="Click to lock/unlock for randomize">Line opacity: {config.ridges.lineOpacity.toFixed(2)}</button>
              <input type="range" bind:value={config.ridges.lineOpacity} min="0" max="1" step="0.01" />
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('ridges.smoothing')} onclick={() => toggleLock('ridges.smoothing')} title="Click to lock/unlock for randomize">Smoothing: {config.ridges.smoothing.toFixed(2)}</button>
              <input type="range" bind:value={config.ridges.smoothing} min="0" max="1" step="0.01" />
            </label>

           <details class="control-details">
             <summary class="control-details-summary">Fill bands</summary>
             <label class="control-row checkbox">
               <input type="checkbox" bind:checked={config.ridges.fillBands.enabled} />
               <button
                 type="button"
                 class="setting-title"
                 class:locked={isLocked('ridges.fillBands.enabled')}
                 onclick={(e) => {
                   e.preventDefault();
                   toggleLock('ridges.fillBands.enabled');
                 }}
                 title="Click to lock/unlock for randomize"
               >
                 Enable
               </button>
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('ridges.fillBands.opacity')} onclick={() => toggleLock('ridges.fillBands.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.ridges.fillBands.opacity.toFixed(2)}</button>
               <input type="range" bind:value={config.ridges.fillBands.opacity} min="0" max="1" step="0.01" disabled={!config.ridges.fillBands.enabled} />
             </label>
           </details>

           <details class="control-details">
             <summary class="control-details-summary">Palette</summary>
             <label class="control-row">
               <button type="button" class="setting-title" class:locked={isLocked('ridges.paletteMode')} onclick={() => toggleLock('ridges.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
               <select bind:value={config.ridges.paletteMode}>
                 <option value="cycle">Cycle</option>
                 <option value="weighted">Weighted</option>
               </select>
             </label>

             {#if config.ridges.paletteMode === 'weighted'}
               <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                 <button type="button" onclick={() => setEqualWeights('ridges')}>Equal weights</button>
                 <button type="button" onclick={() => setRandomWeights('ridges')}>Random weights</button>
               </div>
               {#each config.colors as c, i}
                 <label class="control-row slider">
                   <button type="button" class="setting-title" class:locked={isLocked('ridges.colorWeights')} onclick={() => toggleLock('ridges.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.ridges.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                   <input
                     type="range"
                     min="0"
                     max="5"
                     step="0.05"
                     value={config.ridges.colorWeights[i] ?? 1}
                     oninput={(e) => {
                       updateWeight('ridges', i, Number((e.currentTarget as HTMLInputElement).value));
                     }}
                   />
                 </label>
               {/each}
             {/if}
           </details>
         </section>
       {:else if config.type === 'triangles3d'}
         <section class="control-section">
           <h3>Triangles (3D)</h3>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.mode')} onclick={() => toggleLock('prisms.mode')} title="Click to lock/unlock for randomize">Mode</button>
            <select bind:value={config.prisms.mode}>
              <option value="tessellation">Tessellation</option>
              <option value="scatter">Scatter</option>
              <option value="stackedPrisms">Stacked prisms</option>
            </select>
          </label>

          <label class="control-row">
             <button type="button" class="setting-title" class:locked={isLocked('prisms.base')} onclick={() => toggleLock('prisms.base')} title="Click to lock/unlock for randomize">Shape</button>
             <select bind:value={config.prisms.base}>
               <option value="prism">Prism</option>
               <option value="pyramidTri">Pyramid (tri)</option>
               <option value="pyramidSquare">Pyramid (square)</option>
             </select>
           </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.count')} onclick={() => toggleLock('prisms.count')} title="Click to lock/unlock for randomize">Count: {config.prisms.count}</button>
            <input type="range" bind:value={config.prisms.count} min="0" max="2500" step="10" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.radius')} onclick={() => toggleLock('prisms.radius')} title="Click to lock/unlock for randomize">Radius: {config.prisms.radius.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.radius} min="0.05" max="2.0" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.height')} onclick={() => toggleLock('prisms.height')} title="Click to lock/unlock for randomize">Height: {config.prisms.height.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.height} min="0.02" max="3.0" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.taper')} onclick={() => toggleLock('prisms.taper')} title="Click to lock/unlock for randomize">Taper: {config.prisms.taper.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.taper} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.wallBulgeX')} onclick={() => toggleLock('prisms.wallBulgeX')} title="Click to lock/unlock for randomize">Wall bulge X: {config.prisms.wallBulgeX.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.wallBulgeX} min="-1" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.wallBulgeY')} onclick={() => toggleLock('prisms.wallBulgeY')} title="Click to lock/unlock for randomize">Wall bulge Y: {config.prisms.wallBulgeY.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.wallBulgeY} min="-1" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.spread')} onclick={() => toggleLock('prisms.spread')} title="Click to lock/unlock for randomize">Spread: {config.prisms.spread.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.spread} min="0" max="20" step="0.05" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.jitter')} onclick={() => toggleLock('prisms.jitter')} title="Click to lock/unlock for randomize">Jitter: {config.prisms.jitter.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('prisms.opacity')} onclick={() => toggleLock('prisms.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.prisms.opacity.toFixed(2)}</button>
            <input type="range" bind:value={config.prisms.opacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('prisms.paletteMode')} onclick={() => toggleLock('prisms.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.prisms.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            {#if config.prisms.paletteMode === 'weighted'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('prisms')}>Equal weights</button>
                <button
                  type="button"
                  onclick={() => setRandomWeights('prisms')}
                >
                  Random weights
                </button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('prisms.colorWeights')} onclick={() => toggleLock('prisms.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.prisms.colorWeights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.prisms.colorWeights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('prisms', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>
        </section>
        {:else if config.type === 'svg3d'}
         <section class="control-section">
           <h3>SVG (3D)</h3>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.renderMode')} onclick={() => toggleLock('svg.renderMode')} title="Click to lock/unlock for randomize">Render</button>
              <select bind:value={(config as any).svg.renderMode}>
                <option value="auto">Auto</option>
                <option value="fill">Fill</option>
                <option value="stroke">Stroke</option>
                <option value="fill+stroke">Fill + Stroke</option>
              </select>
            </label>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.colorMode')} onclick={() => toggleLock('svg.colorMode')} title="Click to lock/unlock for randomize">Colors</button>
              <select bind:value={(config as any).svg.colorMode}>
                <option value="palette">Palette</option>
                <option value="svg-to-palette">SVG to palette</option>
              </select>
            </label>
            {#if (config as any).svg.colorMode === 'svg-to-palette'}
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('svg.maxTones')} onclick={() => toggleLock('svg.maxTones')} title="Click to lock/unlock for randomize">Max tones: {Math.round(Number((config as any).svg.maxTones) || 0)}</button>
                <input type="range" bind:value={(config as any).svg.maxTones} min="1" max="24" step="1" />
              </label>
            {/if}

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('svg.source')} onclick={() => toggleLock('svg.source')} title="Click to lock/unlock for randomize">
                Source
              </button>
            </label>
            <textarea
              bind:value={(config as any).svg.source}
              rows="6"
              spellcheck="false"
              style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px;"
            ></textarea>
            {#if renderError}
              <div class="error-box" style="margin-top:0.5rem;">{renderError}</div>
            {/if}

            <details class="control-details">
              <summary class="control-details-summary">Icon picker</summary>
              <IconPicker
                onPick={(svg) => {
                  (config as any).svg = { ...(config as any).svg, source: svg, renderMode: 'auto' };
                  schedulePreviewRender();
                }}
              />
            </details>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.count')} onclick={() => toggleLock('svg.count')} title="Click to lock/unlock for randomize">Count: {(config as any).svg.count}</button>
              <input type="range" bind:value={(config as any).svg.count} min="1" max="2000" step="1" />
            </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.spread')} onclick={() => toggleLock('svg.spread')} title="Click to lock/unlock for randomize">Spread: {Number((config as any).svg.spread).toFixed(2)}</button>
             <input type="range" bind:value={(config as any).svg.spread} min="0" max="8" step="0.05" />
           </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.depth')} onclick={() => toggleLock('svg.depth')} title="Click to lock/unlock for randomize">Depth: {Number((config as any).svg.depth).toFixed(2)}</button>
              <input type="range" bind:value={(config as any).svg.depth} min="0" max="8" step="0.05" />
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.tiltDeg')} onclick={() => toggleLock('svg.tiltDeg')} title="Click to lock/unlock for randomize">Tilt: {Math.round(Number((config as any).svg.tiltDeg) || 0)}deg</button>
              <input type="range" bind:value={(config as any).svg.tiltDeg} min="0" max="80" step="1" />
            </label>

            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.sizeMin')} onclick={() => toggleLock('svg.sizeMin')} title="Click to lock/unlock for randomize">Size min: {Number((config as any).svg.sizeMin).toFixed(3)}</button>
              <input type="range" bind:value={(config as any).svg.sizeMin} min="0.02" max="1.0" step="0.005" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('svg.sizeMax')} onclick={() => toggleLock('svg.sizeMax')} title="Click to lock/unlock for randomize">Size max: {Number((config as any).svg.sizeMax).toFixed(3)}</button>
              <input type="range" bind:value={(config as any).svg.sizeMax} min="0.02" max="1.4" step="0.005" />
            </label>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.extrudeDepth')} onclick={() => toggleLock('svg.extrudeDepth')} title="Click to lock/unlock for randomize">Extrude depth: {Number((config as any).svg.extrudeDepth).toFixed(3)}</button>
             <input type="range" bind:value={(config as any).svg.extrudeDepth} min="0.005" max="1.0" step="0.005" />
           </label>

            <details class="control-details">
              <summary class="control-details-summary">Stroke</summary>
              <label class="control-row checkbox">
                <input type="checkbox" bind:checked={(config as any).svg.stroke.enabled} />
                <button
                  type="button"
                  class="setting-title"
                  class:locked={isLocked('svg.stroke.enabled')}
                  onclick={(e) => {
                    e.preventDefault();
                    toggleLock('svg.stroke.enabled');
                  }}
                  title="Click to lock/unlock for randomize"
                >
                  Enable
                </button>
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.radius')} onclick={() => toggleLock('svg.stroke.radius')} title="Click to lock/unlock for randomize">Radius: {Number((config as any).svg.stroke.radius).toFixed(3)}</button>
                <input type="range" bind:value={(config as any).svg.stroke.radius} min="0.001" max="0.15" step="0.001" disabled={!((config as any).svg.stroke.enabled)} />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.segments')} onclick={() => toggleLock('svg.stroke.segments')} title="Click to lock/unlock for randomize">Segments: {Math.round((config as any).svg.stroke.segments)}</button>
                <input type="range" bind:value={(config as any).svg.stroke.segments} min="1" max="12" step="1" disabled={!((config as any).svg.stroke.enabled)} />
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('svg.stroke.opacity')} onclick={() => toggleLock('svg.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number((config as any).svg.stroke.opacity).toFixed(2)}</button>
                <input type="range" bind:value={(config as any).svg.stroke.opacity} min="0" max="1" step="0.01" disabled={!((config as any).svg.stroke.enabled)} />
              </label>
            </details>

            <details class="control-details">
              <summary class="control-details-summary">Bevel</summary>
              <label class="control-row checkbox">
                <input type="checkbox" bind:checked={(config as any).svg.bevel.enabled} />
               <button
                 type="button"
                 class="setting-title"
                 class:locked={isLocked('svg.bevel.enabled')}
                 onclick={(e) => {
                   e.preventDefault();
                   toggleLock('svg.bevel.enabled');
                 }}
                 title="Click to lock/unlock for randomize"
               >
                 Enable
               </button>
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('svg.bevel.size')} onclick={() => toggleLock('svg.bevel.size')} title="Click to lock/unlock for randomize">Size: {Number((config as any).svg.bevel.size).toFixed(3)}</button>
               <input type="range" bind:value={(config as any).svg.bevel.size} min="0" max="0.2" step="0.005" disabled={!((config as any).svg.bevel.enabled)} />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={isLocked('svg.bevel.segments')} onclick={() => toggleLock('svg.bevel.segments')} title="Click to lock/unlock for randomize">Segments: {Math.round((config as any).svg.bevel.segments)}</button>
               <input type="range" bind:value={(config as any).svg.bevel.segments} min="0" max="6" step="1" disabled={!((config as any).svg.bevel.enabled)} />
             </label>
           </details>

           <label class="control-row slider">
             <button type="button" class="setting-title" class:locked={isLocked('svg.opacity')} onclick={() => toggleLock('svg.opacity')} title="Click to lock/unlock for randomize">Opacity: {Number((config as any).svg.opacity).toFixed(2)}</button>
             <input type="range" bind:value={(config as any).svg.opacity} min="0" max="1" step="0.01" />
           </label>

           <details class="control-details">
             <summary class="control-details-summary">Palette</summary>
             <label class="control-row">
               <button type="button" class="setting-title" class:locked={isLocked('svg.paletteMode')} onclick={() => toggleLock('svg.paletteMode')} title="Click to lock/unlock for randomize">Mode</button>
               <select bind:value={(config as any).svg.paletteMode}>
                 <option value="cycle">Cycle</option>
                 <option value="weighted">Weighted</option>
               </select>
             </label>

             {#if (config as any).svg.paletteMode === 'weighted'}
               <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                 <button type="button" onclick={() => setEqualWeights('svg')}>Equal weights</button>
                 <button type="button" onclick={() => setRandomWeights('svg')}>Random weights</button>
               </div>
               {#each config.colors as c, i}
                 <label class="control-row slider">
                   <button type="button" class="setting-title" class:locked={isLocked('svg.colorWeights')} onclick={() => toggleLock('svg.colorWeights')} title="Click to lock/unlock for randomize">w{i + 1}: {(((config as any).svg.colorWeights[i] ?? 1) as number).toFixed(2)} {c}</button>
                   <input
                     type="range"
                     min="0"
                     max="5"
                     step="0.05"
                     value={(config as any).svg.colorWeights[i] ?? 1}
                     oninput={(e) => {
                       updateWeight('svg', i, Number((e.currentTarget as HTMLInputElement).value));
                     }}
                   />
                 </label>
               {/each}
             {/if}
           </details>
         </section>
       {:else if config.type === 'hexgrid2d'}
         <section class="control-section">
           <h3>Hex Grid (2D)</h3>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('hexgrid.radiusPx')} onclick={() => toggleLock('hexgrid.radiusPx')} title="Click to lock/unlock for randomize">Radius: {Math.round(config.hexgrid.radiusPx)}px</button>
            <input type="range" bind:value={config.hexgrid.radiusPx} min="3" max="140" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('hexgrid.marginPx')} onclick={() => toggleLock('hexgrid.marginPx')} title="Click to lock/unlock for randomize">Margin: {Math.round(config.hexgrid.marginPx)}px</button>
            <input type="range" bind:value={config.hexgrid.marginPx} min="0" max="60" step="1" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('hexgrid.overscanPx')} onclick={() => toggleLock('hexgrid.overscanPx')} title="Click to lock/unlock for randomize">Overscan: {Math.round(config.hexgrid.overscanPx)}px</button>
            <input type="range" bind:value={config.hexgrid.overscanPx} min="0" max="400" step="5" />
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('hexgrid.fillOpacity')} onclick={() => toggleLock('hexgrid.fillOpacity')} title="Click to lock/unlock for randomize">Fill opacity: {config.hexgrid.fillOpacity.toFixed(2)}</button>
            <input type="range" bind:value={config.hexgrid.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Origin</summary>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.originPx.x')} onclick={() => toggleLock('hexgrid.originPx.x')} title="Click to lock/unlock for randomize">X: {Math.round(config.hexgrid.originPx.x)}px</button>
              <input type="range" bind:value={config.hexgrid.originPx.x} min="-500" max="500" step="1" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.originPx.y')} onclick={() => toggleLock('hexgrid.originPx.y')} title="Click to lock/unlock for randomize">Y: {Math.round(config.hexgrid.originPx.y)}px</button>
              <input type="range" bind:value={config.hexgrid.originPx.y} min="-500" max="500" step="1" />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.hexgrid.stroke.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('hexgrid.stroke.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('hexgrid.stroke.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.widthPx')} onclick={() => toggleLock('hexgrid.stroke.widthPx')} title="Click to lock/unlock for randomize">Width: {Math.round(config.hexgrid.stroke.widthPx)}px</button>
              <input type="range" bind:value={config.hexgrid.stroke.widthPx} min="0" max="24" step="1" disabled={!config.hexgrid.stroke.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.join')} onclick={() => toggleLock('hexgrid.stroke.join')} title="Click to lock/unlock for randomize">Join</button>
              <select bind:value={config.hexgrid.stroke.join} disabled={!config.hexgrid.stroke.enabled}>
                <option value="round">Round</option>
                <option value="miter">Miter</option>
                <option value="bevel">Bevel</option>
              </select>
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.color')} onclick={() => toggleLock('hexgrid.stroke.color')} title="Click to lock/unlock for randomize">Color</button>
              <input type="color" bind:value={config.hexgrid.stroke.color} disabled={!config.hexgrid.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.stroke.opacity')} onclick={() => toggleLock('hexgrid.stroke.opacity')} title="Click to lock/unlock for randomize">Opacity: {config.hexgrid.stroke.opacity.toFixed(2)}</button>
              <input type="range" bind:value={config.hexgrid.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.hexgrid.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Coloring</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.paletteMode')} onclick={() => toggleLock('hexgrid.coloring.paletteMode')} title="Click to lock/unlock for randomize">Palette mode</button>
              <select bind:value={config.hexgrid.coloring.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.weightsMode')} onclick={() => toggleLock('hexgrid.coloring.weightsMode')} title="Click to lock/unlock for randomize">Weights</button>
              <select bind:value={config.hexgrid.coloring.weightsMode}>
                <option value="auto">Auto</option>
                <option value="preset">Preset</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.preset')} onclick={() => toggleLock('hexgrid.coloring.preset')} title="Click to lock/unlock for randomize">Preset</button>
              <select bind:value={config.hexgrid.coloring.preset} disabled={config.hexgrid.coloring.weightsMode !== 'preset'}>
                <option value="equal">Equal</option>
                <option value="dominant">Dominant</option>
                <option value="accents">Accents</option>
                <option value="rare-accents">Rare accents</option>
              </select>
            </label>

            {#if config.hexgrid.coloring.weightsMode === 'custom'}
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button type="button" onclick={() => setEqualWeights('hexgrid')}>Equal weights</button>
                <button
                  type="button"
                  onclick={() => setRandomWeights('hexgrid')}
                >
                  Random weights
                </button>
              </div>
              {#each config.colors as c, i}
                <label class="control-row slider">
                  <button type="button" class="setting-title" class:locked={isLocked('hexgrid.coloring.weights')} onclick={() => toggleLock('hexgrid.coloring.weights')} title="Click to lock/unlock for randomize">w{i + 1}: {(config.hexgrid.coloring.weights[i] ?? 1).toFixed(2)} {c}</button>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.05"
                    value={config.hexgrid.coloring.weights[i] ?? 1}
                    oninput={(e) => {
                      updateWeight('hexgrid', i, Number((e.currentTarget as HTMLInputElement).value));
                    }}
                  />
                </label>
              {/each}
            {/if}
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Grouping</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.mode')} onclick={() => toggleLock('hexgrid.grouping.mode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.hexgrid.grouping.mode}>
                <option value="none">None</option>
                <option value="voronoi">Voronoi</option>
                <option value="noise">Noise</option>
                <option value="random-walk">Random walk</option>
              </select>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.strength')} onclick={() => toggleLock('hexgrid.grouping.strength')} title="Click to lock/unlock for randomize">Strength: {config.hexgrid.grouping.strength.toFixed(2)}</button>
              <input type="range" bind:value={config.hexgrid.grouping.strength} min="0" max="1" step="0.01" disabled={config.hexgrid.grouping.mode === 'none'} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.grouping.targetGroupCount')} onclick={() => toggleLock('hexgrid.grouping.targetGroupCount')} title="Click to lock/unlock for randomize">Target groups: {config.hexgrid.grouping.targetGroupCount}</button>
              <input type="range" bind:value={config.hexgrid.grouping.targetGroupCount} min="1" max="250" step="1" disabled={config.hexgrid.grouping.mode === 'none'} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Effect</summary>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.kind')} onclick={() => toggleLock('hexgrid.effect.kind')} title="Click to lock/unlock for randomize">Kind</button>
              <select bind:value={config.hexgrid.effect.kind}>
                <option value="none">None</option>
                <option value="bevel">Bevel</option>
                <option value="grain">Grain</option>
                <option value="gradient">Gradient</option>
              </select>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.amount')} onclick={() => toggleLock('hexgrid.effect.amount')} title="Click to lock/unlock for randomize">Amount: {config.hexgrid.effect.amount.toFixed(2)}</button>
              <input type="range" bind:value={config.hexgrid.effect.amount} min="0" max="1" step="0.01" disabled={config.hexgrid.effect.kind === 'none'} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('hexgrid.effect.frequency')} onclick={() => toggleLock('hexgrid.effect.frequency')} title="Click to lock/unlock for randomize">Frequency: {config.hexgrid.effect.frequency.toFixed(2)}</button>
              <input type="range" bind:value={config.hexgrid.effect.frequency} min="0.1" max="10" step="0.05" disabled={config.hexgrid.effect.kind === 'none'} />
            </label>
          </details>
        </section>
       {/if}
       
