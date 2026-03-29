<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';

  type PaletteOverrideBlock =
    | 'emission'
    | 'texture'
    | 'grazing'
    | 'side'
    | 'outline'
    | 'edge'
    | 'geometry'
    | 'bubbles'
    | 'voronoi';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsEmission: boolean;
    togglePaletteOverride: (paletteIndex: number) => void;
    updatePaletteOverride: (paletteIndex: number, fn: (cur: any | null) => any | null) => void;
    togglePaletteBlock: (paletteIndex: number, block: PaletteOverrideBlock) => void;
  };

  let { config, is3DType, supportsEmission, togglePaletteOverride, updatePaletteOverride, togglePaletteBlock }: Props =
    $props();
</script>

<details class="control-details">
  <summary class="control-details-summary">Per-color overrides</summary>
  <div class="palette-overrides">
    {#each config.colors as c, i}
      {@const ov = (config as any).palette?.overrides?.[i]}
      {@const ovEnabled = !!ov?.enabled}
      <details class="palette-override-item">
        <summary class="palette-override-summary">
          <span class="mono">#{i}</span>
          <span class="swatch" style={`background: ${c}`}></span>
          <span class="mono">{c}</span>
        </summary>

        <label class="control-row checkbox">
          <input type="checkbox" checked={ovEnabled} oninput={() => togglePaletteOverride(i)} />
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
                updatePaletteOverride(i, (cur) => ({ ...(cur ?? { enabled: true }), enabled: true, frequency: v }));
              }}
            />
          </label>

          {#if config.type === 'popsicle' || config.type === 'spheres3d'}
            <details class="control-details">
              <summary class="control-details-summary">Bubbles</summary>
              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.bubbles} oninput={() => togglePaletteBlock(i, 'bubbles')} />
                <span class="setting-title">Override bubbles</span>
              </label>

              {#if ov?.bubbles}
                <label class="control-row">
                  <span class="setting-title">Mode</span>
                  <select
                    value={(ov.bubbles as any)?.mode ?? (config as any).bubbles.mode}
                    oninput={(e) => {
                      const v = String((e.currentTarget as HTMLSelectElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), mode: v === 'cap' ? 'cap' : 'through' }
                      }));
                    }}
                  >
                    <option value="through">Through</option>
                    <option value="cap">Cap</option>
                  </select>
                </label>

                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!ov.bubbles.enabled}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), enabled: checked }
                      }));
                    }}
                  />
                  <span class="setting-title">Enable</span>
                </label>

                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!(ov.bubbles as any)?.interior?.enabled}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: {
                          ...((cur as any)?.bubbles ?? {}),
                          interior: {
                            ...(((cur as any)?.bubbles?.interior ?? (config as any).bubbles?.interior ?? {}) as any),
                            enabled: checked
                          }
                        }
                      }));
                    }}
                    disabled={String((ov.bubbles as any)?.mode ?? (config as any).bubbles.mode) !== 'through'}
                  />
                  <span class="setting-title">Interior surfaces</span>
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Samples: {Math.round(Number((ov.bubbles as any)?.count ?? (config as any).bubbles.count))}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.count ?? (config as any).bubbles.count)}
                    min="1"
                    max="8"
                    step="1"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), count: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Frequency: {Number((ov.bubbles as any)?.frequency ?? (config as any).bubbles.frequency).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.frequency ?? (config as any).bubbles.frequency)}
                    min="0.2"
                    max="8"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), frequency: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Variance: {Number((ov.bubbles as any)?.frequencyVariance ?? (config as any).bubbles.frequencyVariance).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.frequencyVariance ?? (config as any).bubbles.frequencyVariance)}
                    min="0"
                    max="1"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), frequencyVariance: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Radius min: {Number((ov.bubbles as any)?.radiusMin ?? (config as any).bubbles.radiusMin).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.radiusMin ?? (config as any).bubbles.radiusMin)}
                    min="0"
                    max="1.5"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), radiusMin: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Radius max: {Number((ov.bubbles as any)?.radiusMax ?? (config as any).bubbles.radiusMax).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.radiusMax ?? (config as any).bubbles.radiusMax)}
                    min="0"
                    max="2.5"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), radiusMax: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Softness: {Number((ov.bubbles as any)?.softness ?? (config as any).bubbles.softness).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.softness ?? (config as any).bubbles.softness)}
                    min="0"
                    max="0.5"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), softness: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Wall thickness: {Number((ov.bubbles as any)?.wallThickness ?? (config as any).bubbles.wallThickness).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.wallThickness ?? (config as any).bubbles.wallThickness)}
                    min="0"
                    max="1"
                    step="0.01"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), wallThickness: v }
                      }));
                    }}
                  />
                </label>

                <label class="control-row slider">
                  <span class="setting-title">Seed offset: {Math.round(Number((ov.bubbles as any)?.seedOffset ?? (config as any).bubbles.seedOffset))}</span>
                  <input
                    type="range"
                    value={Number((ov.bubbles as any)?.seedOffset ?? (config as any).bubbles.seedOffset)}
                    min="-200"
                    max="200"
                    step="1"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        bubbles: { ...((cur as any)?.bubbles ?? {}), seedOffset: v }
                      }));
                    }}
                  />
                </label>
              {/if}
            </details>
          {/if}

          {#if supportsEmission}
            <details class="control-details">
              <summary class="control-details-summary">Emission</summary>
              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.emission} oninput={() => togglePaletteBlock(i, 'emission')} />
                <span class="setting-title">Override emission</span>
              </label>

              {#if ov?.emission}
                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!ov.emission.enabled}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        emission: { ...(cur?.emission ?? {}), enabled: checked }
                      }));
                    }}
                  />
                  <span class="setting-title">Emit</span>
                </label>
                <label class="control-row slider">
                  <span class="setting-title">Intensity: {Number(ov.emission.intensity ?? config.emission.intensity).toFixed(2)}</span>
                  <input
                    type="range"
                    value={Number(ov.emission.intensity ?? config.emission.intensity)}
                    min="0"
                    max="20"
                    step="0.05"
                    oninput={(e) => {
                      const v = Number((e.currentTarget as HTMLInputElement).value);
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        emission: { ...(cur?.emission ?? {}), intensity: v }
                      }));
                    }}
                  />
                </label>
              {/if}
            </details>
          {/if}

          {#if config.type === 'popsicle' || config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg2d' || config.type === 'svg3d'}
            <details class="control-details">
              <summary class="control-details-summary">Geometry</summary>
              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.geometry} oninput={() => togglePaletteBlock(i, 'geometry')} />
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
          {/if}

          {#if is3DType}
            <details class="control-details">
              <summary class="control-details-summary">Texture</summary>
              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.texture} oninput={() => togglePaletteBlock(i, 'texture')} />
                <span class="setting-title">Override texture</span>
              </label>

              {#if ov?.texture}
                <label class="control-row">
                  <span class="setting-title">Type</span>
                  <select
                    value={ov.texture.type ?? config.texture}
                    oninput={(e) => {
                      const value = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        texture: { ...(cur?.texture ?? {}), type: value }
                      }));
                    }}
                  >
                    <option value="glossy">Glossy</option>
                    <option value="matte">Matte</option>
                    <option value="metallic">Metallic</option>
                    <option value="drywall">Drywall</option>
                    <option value="glass">Glass</option>
                    <option value="mirror">Mirror</option>
                    <option value="cel">Cel</option>
                  </select>
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                    <select
                      value={ov.texture.params?.glass?.style ?? config.textureParams.glass.style}
                      oninput={(e) => {
                        const v = (e.currentTarget as HTMLSelectElement).value;
                        updatePaletteOverride(i, (cur) => ({
                          ...(cur ?? { enabled: true }),
                          enabled: true,
                          texture: { ...(cur?.texture ?? {}), params: { ...((cur?.texture as any)?.params ?? {}), glass: { style: v } } }
                        }));
                      }}
                    >
                      <option value="simple">Simple</option>
                      <option value="frosted">Frosted</option>
                      <option value="thick">Thick</option>
                      <option value="stylized">Stylized</option>
                    </select>
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
          {/if}

          {#if is3DType}
            <details class="control-details">
              <summary class="control-details-summary">Voronoi</summary>
              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.voronoi} oninput={() => togglePaletteBlock(i, 'voronoi')} />
                <span class="setting-title">Override voronoi</span>
              </label>

              {#if ov?.voronoi}
                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!(ov.voronoi.enabled ?? (config as any).voronoi.enabled)}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
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
                  <select
                    value={ov.voronoi.kind ?? (config as any).voronoi.kind}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), kind: v }
                      }));
                    }}
                  >
                    <option value="edges">Edges</option>
                    <option value="cells">Cells</option>
                  </select>
                </label>
                <label class="control-row">
                  <span class="setting-title">Space</span>
                  <select
                    value={ov.voronoi.space ?? (config as any).voronoi.space}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), space: v }
                      }));
                    }}
                  >
                    <option value="world">World</option>
                    <option value="object">Object</option>
                  </select>
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), colorStrength: v }
                      }));
                    }}
                  />
                </label>
                <label class="control-row">
                  <span class="setting-title">Material mode</span>
                  <select
                    value={ov.voronoi.materialMode ?? (config as any).voronoi.materialMode}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), materialMode: v }
                      }));
                    }}
                  >
                    <option value="none">None</option>
                    <option value="roughness">Roughness</option>
                    <option value="normal">Normal</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label class="control-row">
                  <span class="setting-title">Material mask</span>
                  <select
                    value={ov.voronoi.materialKind ?? (config as any).voronoi.materialKind}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), materialKind: v }
                      }));
                    }}
                  >
                    <option value="match">Match kind</option>
                    <option value="edges">Edges</option>
                    <option value="cells">Cells</option>
                  </select>
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), normalScale: v }
                      }));
                    }}
                  />
                </label>
                <label class="control-row">
                  <span class="setting-title">Color mode</span>
                  <select
                    value={ov.voronoi.colorMode ?? (config as any).voronoi.colorMode}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), colorMode: v }
                      }));
                    }}
                  >
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="tint">Tint</option>
                  </select>
                </label>
                <label class="control-row">
                  <span class="setting-title">Tint</span>
                  <input
                    type="color"
                    value={ov.voronoi.tintColor ?? (config as any).voronoi.tintColor}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value;
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        voronoi: { ...(cur?.voronoi ?? {}), nucleus: { ...(((cur?.voronoi as any)?.nucleus ?? {}) as any), color: v } }
                      }));
                    }}
                  />
                </label>
              {/if}
            </details>
          {/if}

          {#if is3DType}
            <details class="control-details">
              <summary class="control-details-summary">Facades</summary>

              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.facades?.grazing} oninput={() => togglePaletteBlock(i, 'grazing')} />
                <span class="setting-title">Override grazing</span>
              </label>
              {#if ov?.facades?.grazing}
                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!ov.facades.grazing.enabled}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
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
                  <select
                    value={ov.facades.grazing.mode ?? config.facades.grazing.mode}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), mode: v } }
                      }));
                    }}
                  >
                    <option value="add">Add</option>
                    <option value="mix">Mix</option>
                  </select>
                </label>
                <label class="control-row">
                  <span class="setting-title">Color</span>
                  <input
                    type="color"
                    value={ov.facades.grazing.color ?? config.facades.grazing.color}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value;
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
                        ...(cur ?? { enabled: true }),
                        enabled: true,
                        facades: { ...(cur?.facades ?? {}), grazing: { ...(cur?.facades?.grazing ?? {}), noise: v } }
                      }));
                    }}
                  />
                </label>
              {/if}

              <label class="control-row checkbox">
                <input type="checkbox" checked={!!ov?.facades?.outline} oninput={() => togglePaletteBlock(i, 'outline')} />
                <span class="setting-title">Override outline</span>
              </label>
              {#if ov?.facades?.outline}
                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!ov.facades.outline.enabled}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                      updatePaletteOverride(i, (cur) => ({
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
                  <input type="checkbox" checked={!!ov?.facades?.side} oninput={() => togglePaletteBlock(i, 'side')} />
                  <span class="setting-title">Override side</span>
                </label>
                {#if ov?.facades?.side}
                  <label class="control-row checkbox">
                    <input
                      type="checkbox"
                      checked={!!ov.facades.side.enabled}
                      oninput={(e) => {
                        const checked = (e.currentTarget as HTMLInputElement).checked;
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                <input type="checkbox" checked={!!ov?.edge} oninput={() => togglePaletteBlock(i, 'edge')} />
                <span class="setting-title">Override edge</span>
              </label>
              {#if ov?.edge}
                <label class="control-row checkbox">
                  <input
                    type="checkbox"
                    checked={!!ov.edge.hollow}
                    oninput={(e) => {
                      const checked = (e.currentTarget as HTMLInputElement).checked;
                      updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
                        updatePaletteOverride(i, (cur) => ({
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
    {/each}
  </div>
</details>
