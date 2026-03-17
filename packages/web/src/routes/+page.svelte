<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    DEFAULT_CONFIG, 
    type WallpaperConfig,
    RESOLUTION_PRESETS,
    generateRandomConfigNoPresets,
    generateRandomConfigNoPresetsFromSeed,
    encodeAppStateToBase64Url,
    decodeAppStateFromBase64Url,
    type WallpaperAppStateV1,
    exportToPNG,
    exportToJPG,
    exportToWebP,
    exportToSVG,
    downloadFile
  } from '@wallpaper-maker/core';

  import { PopsiclePreview, renderRasterToCanvas, type PreviewRenderMode } from '$lib/popsicle/preview';

  import { COLOR_PRESETS, COLOR_PRESET_GROUPS, type ColorPreset } from '$lib/color-presets';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>(cloneDefaultConfig());
  
  let canvasContainer: HTMLDivElement;
  let preview: PopsiclePreview | null = null;
  let renderMode = $state<PreviewRenderMode>('raster');

  let renderRaf = 0;
  let renderSettleTimer = 0;
  const RENDER_SETTLE_MS = 280;
  
  // Export format selection
  let exportFormat = $state<'png' | 'jpg' | 'webp' | 'svg'>('png');
  let isExporting = $state(false);
  
  // URL sync + CLI preview
  let urlSyncEnabled = $state(false);
  let cliCommand = $state('');

  function randomSeedU32(): number {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return (a[0] >>> 0) || 1;
    } catch {
      return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    }
  }

  type LockState = {
    colors: boolean;
    backgroundColor: boolean;
    texture: boolean;
    stickCount: boolean;
    stickOverhang: boolean;
    rotationCenterOffsetX: boolean;
    rotationCenterOffsetY: boolean;
    stickGap: boolean;
    stickSize: boolean;
    stickRatio: boolean;
    stickThickness: boolean;
    stickRoundness: boolean;
    stickBevel: boolean;
    stickOpacity: boolean;
    cameraDistance: boolean;
    cameraAzimuth: boolean;
    cameraElevation: boolean;
    lightingEnabled: boolean;
    lightingIntensity: boolean;
    lightingX: boolean;
    lightingY: boolean;
    lightingZ: boolean;
    lightingAmbient: boolean;
  };

  type LockKey = keyof LockState;

  // UI-only: locks are not synced to URL.
  let locks = $state<LockState>({
    colors: false,
    backgroundColor: false,
    texture: false,
    stickCount: false,
    stickOverhang: false,
    rotationCenterOffsetX: false,
    rotationCenterOffsetY: false,
    stickGap: false,
    stickSize: false,
    stickRatio: false,
    stickThickness: false,
    stickRoundness: false,
    stickBevel: false,
    stickOpacity: false,
    cameraDistance: false,
    cameraAzimuth: false,
    cameraElevation: false,
    lightingEnabled: false,
    lightingIntensity: false,
    lightingX: false,
    lightingY: false,
    lightingZ: false,
    lightingAmbient: false
  });

  function toggleLock(key: LockKey) {
    locks = { ...locks, [key]: !locks[key] };
  }

  const colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }> = COLOR_PRESET_GROUPS
    .map((group) => ({ group, presets: COLOR_PRESETS.filter((p) => p.group === group) }))
    .filter((g) => g.presets.length > 0);

  // UI-only: selected preset is not synced to URL.
  let selectedColorPresetId = $state(COLOR_PRESETS[0]?.id ?? '');
  let selectedColorPreset = $derived(COLOR_PRESETS.find((p) => p.id === selectedColorPresetId) ?? null);

  function applyColorPreset(preset: ColorPreset) {
    if (preset.colors.length === 0) return;
    config = {
      ...config,
      colors: [...preset.colors],
      backgroundColor: preset.backgroundColor
    };

    schedulePreviewRender();
  }

  function applySelectedColorPreset() {
    const preset = COLOR_PRESETS.find((p) => p.id === selectedColorPresetId);
    if (!preset) return;
    applyColorPreset(preset);
  }

  function cycleColorPreset(delta: number) {
    if (COLOR_PRESETS.length === 0) return;

    const currentIndex = COLOR_PRESETS.findIndex((p) => p.id === selectedColorPresetId);
    const base = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (base + delta + COLOR_PRESETS.length) % COLOR_PRESETS.length;
    const next = COLOR_PRESETS[nextIndex];

    selectedColorPresetId = next.id;
    applyColorPreset(next);
  }
  
  // Derived values
  let aspectRatio = $derived(config.width / config.height);

  function schedulePreviewRender() {
    if (!preview) return;
    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(() => {
      preview?.renderOnce(config, 'interactive');
    });

    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
    renderSettleTimer = window.setTimeout(() => {
      preview?.renderOnce(config, 'final');
    }, RENDER_SETTLE_MS);
  }
  
  // 3D rendering is handled by PopsiclePreview.
  
  async function handleExport() {
    isExporting = true;
    
    try {
      if (exportFormat === 'svg') {
        const result = await exportToSVG(config);
        const filename = `wallpaper-${Date.now()}.svg`;
        downloadFile(result.data, filename, result.mimeType);
        return;
      }

      const canvas = await renderRasterToCanvas(config);
      let result;
      
      switch (exportFormat) {
        case 'png':
          result = await exportToPNG(canvas, { format: 'png', quality: 0.95 });
          break;
        case 'jpg':
          result = await exportToJPG(canvas, { format: 'jpg', quality: 0.95 });
          break;
        case 'webp':
          result = await exportToWebP(canvas, { format: 'webp', quality: 0.95 });
          break;
      }
      
      const filename = `wallpaper-${Date.now()}.${exportFormat}`;
      downloadFile(result.data, filename, result.mimeType);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }
  
  function applyResolutionPreset(preset: keyof typeof RESOLUTION_PRESETS) {
    const { width, height } = RESOLUTION_PRESETS[preset];
    config = { ...config, width, height };
    schedulePreviewRender();
  }
  
  function addColor() {
    config = { ...config, colors: [...config.colors, '#ffffff'] };
    schedulePreviewRender();
  }
  
  function removeColor(index: number) {
    if (config.colors.length > 1) {
      const newColors = config.colors.filter((_, i) => i !== index);
      config = { ...config, colors: newColors };
      schedulePreviewRender();
    }
  }
  
  function updateColor(index: number, color: string) {
    const newColors = [...config.colors];
    newColors[index] = color;
    config = { ...config, colors: newColors };
  }

  function cloneDefaultConfig(): WallpaperConfig {
      return {
        ...DEFAULT_CONFIG,
        colors: [...DEFAULT_CONFIG.colors],
        lighting: {
          ...DEFAULT_CONFIG.lighting,
          position: { ...DEFAULT_CONFIG.lighting.position }
        },
        camera: { ...DEFAULT_CONFIG.camera },
        environment: { ...DEFAULT_CONFIG.environment },
        shadows: { ...DEFAULT_CONFIG.shadows },
        rendering: { ...DEFAULT_CONFIG.rendering },
        geometry: { ...DEFAULT_CONFIG.geometry }
      };
   }

  function mergeWithLocks(next: WallpaperConfig): WallpaperConfig {
    const current = config;
    const merged: WallpaperConfig = {
      ...next,
      colors: [...next.colors],
      lighting: {
        ...next.lighting,
        position: { ...next.lighting.position }
      },
      camera: { ...next.camera },
      environment: { ...next.environment },
      shadows: { ...next.shadows },
      rendering: { ...next.rendering },
      geometry: { ...next.geometry }
    };

    // Resolution is not randomized; always preserve the current values.
    merged.width = current.width;
    merged.height = current.height;

    // Render pipeline settings are not randomized; always preserve the current values.
    merged.environment = { ...current.environment };
    merged.shadows = { ...current.shadows };
    merged.rendering = { ...current.rendering };
    merged.geometry = { ...current.geometry };

     if (locks.colors) merged.colors = [...current.colors];
     if (locks.backgroundColor) merged.backgroundColor = current.backgroundColor;

     if (locks.texture) merged.texture = current.texture;

    if (locks.stickCount) merged.stickCount = current.stickCount;
    if (locks.stickOverhang) merged.stickOverhang = current.stickOverhang;
    if (locks.rotationCenterOffsetX) merged.rotationCenterOffsetX = current.rotationCenterOffsetX;
    if (locks.rotationCenterOffsetY) merged.rotationCenterOffsetY = current.rotationCenterOffsetY;
    if (locks.stickGap) merged.stickGap = current.stickGap;
    if (locks.stickSize) merged.stickSize = current.stickSize;
    if (locks.stickRatio) merged.stickRatio = current.stickRatio;
     if (locks.stickThickness) merged.stickThickness = current.stickThickness;
     if (locks.stickRoundness) merged.stickRoundness = current.stickRoundness;
     if (locks.stickBevel) merged.stickBevel = current.stickBevel;
     if (locks.stickOpacity) merged.stickOpacity = current.stickOpacity;

    if (locks.cameraDistance) merged.camera.distance = current.camera.distance;
    if (locks.cameraAzimuth) merged.camera.azimuth = current.camera.azimuth;
    if (locks.cameraElevation) merged.camera.elevation = current.camera.elevation;

    if (locks.lightingEnabled) merged.lighting.enabled = current.lighting.enabled;
    if (locks.lightingIntensity) merged.lighting.intensity = current.lighting.intensity;
    if (locks.lightingX) merged.lighting.position.x = current.lighting.position.x;
    if (locks.lightingY) merged.lighting.position.y = current.lighting.position.y;
    if (locks.lightingZ) merged.lighting.position.z = current.lighting.position.z;
    if (locks.lightingAmbient) merged.lighting.ambientIntensity = current.lighting.ambientIntensity;

    return merged;
  }

  function generateRandomGeneratedColors() {
    // Randomize everything, including a non-preset generated color theme.
    const seed = randomSeedU32();
    config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed));
    schedulePreviewRender();
  }

  function getAppState(): WallpaperAppStateV1 {
    return {
      v: 1,
      c: config,
      f: exportFormat,
      m: renderMode
    };
  }

  function quoteCliArg(value: string): string {
    // Keep it simple and shell-friendly.
    if (/^[A-Za-z0-9_\-.,#/:]+$/.test(value)) return value;
    return JSON.stringify(value);
  }

  function buildCliCommandString(): string {
    const state = getAppState();
    const cfg = encodeAppStateToBase64Url(state);

    const parts: string[] = [];
    parts.push('pnpm', 'cli', 'generate');
    parts.push('--cfg', quoteCliArg(cfg));
    return parts.join(' ');
  }

  async function copyCliCommand() {
    try {
      await navigator.clipboard.writeText(cliCommand);
    } catch {
      // Older browsers / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = cliCommand;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  $effect(() => {
    cliCommand = buildCliCommandString();
  });

  $effect(() => {
    if (!urlSyncEnabled) return;
    if (typeof window === 'undefined') return;

    const cfg = encodeAppStateToBase64Url(getAppState());
    const url = new URL(window.location.href);
    if (url.searchParams.get('cfg') === cfg && url.searchParams.size === 1) return;

    // Debounce URL updates to avoid spamming history.
    const handle = window.setTimeout(() => {
      const u = new URL(window.location.href);
      u.search = '';
      u.searchParams.set('cfg', cfg);
      history.replaceState({}, '', u);
    }, 120);

    return () => {
      window.clearTimeout(handle);
    };
  });
  
  $effect(() => {
    if (!preview) return;
    // Touch all relevant fields so deep mutations re-run this effect.
    // This is critical because many controls mutate nested properties in-place.
    const c = config;
    void c.width;
    void c.height;
    void c.seed;
    void c.colors.join(',');
    void c.texture;
    void c.backgroundColor;
    void c.stickCount;
    void c.stickOverhang;
    void c.rotationCenterOffsetX;
    void c.rotationCenterOffsetY;
    void c.stickGap;
    void c.stickSize;
    void c.stickRatio;
    void c.stickThickness;
    void c.stickRoundness;
    void c.stickBevel;
    void c.stickOpacity;
    void c.camera.distance;
    void c.camera.azimuth;
    void c.camera.elevation;
    void c.lighting.enabled;
    void c.lighting.intensity;
    void c.lighting.position.x;
    void c.lighting.position.y;
    void c.lighting.position.z;
    void c.lighting.ambientIntensity;
    void c.environment.enabled;
    void c.environment.style;
    void c.environment.intensity;
    void c.environment.rotation;
    void c.shadows.enabled;
    void c.shadows.type;
    void c.shadows.mapSize;
    void c.shadows.bias;
    void c.shadows.normalBias;
    void c.rendering.toneMapping;
    void c.rendering.exposure;
    void c.geometry.quality;
    void renderMode;
    void exportFormat;
    schedulePreviewRender();
  });

  $effect(() => {
    if (!preview) return;
    preview.setMode(renderMode);
    schedulePreviewRender();
  });
  
  onMount(() => {
    const hasUrlParams = window.location.search.length > 0;
    
    try {
      if (hasUrlParams) {
        const sp = new URLSearchParams(window.location.search);
        const cfg = sp.get('cfg');
        if (cfg) {
          const state = decodeAppStateFromBase64Url(cfg);
          config = state.c;
          exportFormat = state.f;
          renderMode = state.m;
        } else {
          config = generateRandomConfigNoPresets();
        }
      } else {
        // Use fully random configuration when no URL parameters are present
        config = generateRandomConfigNoPresets();
      }
    } catch {
      // Ignore malformed URLs and use random config
      config = generateRandomConfigNoPresets();
    }

    urlSyncEnabled = true;

    preview?.dispose();
    preview = new PopsiclePreview(canvasContainer);
    preview.setMode(renderMode);
    schedulePreviewRender();
    
    const resizeObserver = new ResizeObserver(() => {
      schedulePreviewRender();
    });
    
    if (canvasContainer) {
      resizeObserver.observe(canvasContainer);
    }
    
    return () => {
      resizeObserver.disconnect();
      if (renderRaf) cancelAnimationFrame(renderRaf);
      if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
      preview?.dispose();
      preview = null;
    };
  });
</script>

<svelte:head>
  <title>ColorWhirl</title>
</svelte:head>

<div class="app">
  <aside class="sidebar" oninput={schedulePreviewRender} onchange={schedulePreviewRender}>
    <div class="sidebar-header">
      <h1>ColorWhirl</h1>
    </div>
    
    <div class="sidebar-content">
      <!-- Export Section -->
      <section class="control-section">
        <h3>Export</h3>
        <div class="export-controls">
          <select bind:value={exportFormat}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
          <button onclick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </section>
      
        <!-- Random Config -->
        <section class="control-section">
          <h3>Randomize</h3>
          <div class="randomize-buttons">
            <button type="button" onclick={generateRandomGeneratedColors} title="Randomize all settings, generate a new non-preset color theme">
              Randomize
            </button>
          </div>
        </section>
       
       <!-- Resolution Controls -->
      <section class="control-section">
        <h3>Resolution</h3>
        <div class="preset-buttons">
          {#each Object.keys(RESOLUTION_PRESETS) as preset}
            <button onclick={() => applyResolutionPreset(preset as keyof typeof RESOLUTION_PRESETS)}>
              {preset}
            </button>
          {/each}
        </div>
        <div class="input-row">
          <label>
            <span>W</span>
            <input type="number" bind:value={config.width} min="100" max="8000" />
          </label>
          <label>
            <span>H</span>
            <input type="number" bind:value={config.height} min="100" max="8000" />
          </label>
        </div>
      </section>
      
      <!-- Colors Section -->
      <section class="control-section">
        <h3>
          <button type="button" class="setting-title" class:locked={locks.colors} onclick={() => toggleLock('colors')} title="Click to lock/unlock for randomize">
            Colors
          </button>
        </h3>
        <div class="palette-controls">
          <div class="palette-row">
            <button type="button" class="palette-nav" onclick={() => cycleColorPreset(-1)} title="Previous preset">
              Prev
            </button>
            <select bind:value={selectedColorPresetId} onchange={applySelectedColorPreset} title="Apply a preset to colors + background">
              {#each colorPresetGroups as g}
                <optgroup label={g.group}>
                  {#each g.presets as preset}
                    <option value={preset.id}>{preset.label}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
            <button type="button" class="palette-nav" onclick={() => cycleColorPreset(1)} title="Next preset">
              Next
            </button>
          </div>
          {#if selectedColorPreset}
            <div class="palette-preview" title={selectedColorPreset.source ?? ''}>
              <span class="swatch swatch-bg" style={`background: ${selectedColorPreset.backgroundColor}`}></span>
              {#each selectedColorPreset.colors.slice(0, 10) as c}
                <span class="swatch" style={`background: ${c}`}></span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="colors-list">
          {#each config.colors as color, i}
            <div class="color-item">
              <input type="color" value={color} oninput={(e) => updateColor(i, e.currentTarget.value)} />
              <button class="remove-btn" onclick={() => removeColor(i)} disabled={config.colors.length <= 1}>×</button>
            </div>
          {/each}
          <button class="add-btn" onclick={addColor}>+ Add Color</button>
        </div>
      </section>
      
      <!-- Appearance -->
      <section class="control-section">
        <h3>Appearance</h3>
        <label class="control-row">
          <button type="button" class="setting-title" class:locked={locks.texture} onclick={() => toggleLock('texture')} title="Click to lock/unlock for randomize">Texture</button>
          <select bind:value={config.texture}>
            <option value="glossy">Glossy</option>
            <option value="matte">Matte</option>
            <option value="metallic">Metallic</option>
          </select>
        </label>
         <label class="control-row">
           <button type="button" class="setting-title" class:locked={locks.backgroundColor} onclick={() => toggleLock('backgroundColor')} title="Click to lock/unlock for randomize">Background</button>
           <input type="color" bind:value={config.backgroundColor} />
         </label>
       </section>
      
       <!-- Stick Settings -->
        <section class="control-section">
          <h3>Stick Settings</h3>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickCount} onclick={() => toggleLock('stickCount')} title="Click to lock/unlock for randomize">Count: {config.stickCount}</button>
            <input type="range" bind:value={config.stickCount} min="1" max="200" />
          </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickGap} onclick={() => toggleLock('stickGap')} title="Click to lock/unlock for randomize">Gap: {config.stickGap.toFixed(2)}</button>
             <input type="range" bind:value={config.stickGap} min="0" max="5.0" step="0.01" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickSize} onclick={() => toggleLock('stickSize')} title="Click to lock/unlock for randomize">Size: {config.stickSize.toFixed(2)}</button>
             <input type="range" bind:value={config.stickSize} min="0.25" max="2.5" step="0.01" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickRatio} onclick={() => toggleLock('stickRatio')} title="Click to lock/unlock for randomize">Ratio: {config.stickRatio.toFixed(2)}</button>
             <input type="range" bind:value={config.stickRatio} min="0.5" max="12" step="0.05" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickThickness} onclick={() => toggleLock('stickThickness')} title="Click to lock/unlock for randomize">Thickness: {config.stickThickness.toFixed(1)}</button>
              <input type="range" bind:value={config.stickThickness} min="0.1" max="3.0" step="0.1" />
            </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickRoundness} onclick={() => toggleLock('stickRoundness')} title="Click to lock/unlock for randomize">Roundness: {config.stickRoundness.toFixed(2)}</button>
             <input type="range" bind:value={config.stickRoundness} min="0" max="1" step="0.01" />
           </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickBevel} onclick={() => toggleLock('stickBevel')} title="Click to lock/unlock for randomize">Bevel: {config.stickBevel.toFixed(2)}</button>
             <input type="range" bind:value={config.stickBevel} min="0" max="1" step="0.01" />
            </label>
           <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.stickOpacity} onclick={() => toggleLock('stickOpacity')} title="Click to lock/unlock for randomize">Opacity: {config.stickOpacity.toFixed(2)}</button>
             <input type="range" bind:value={config.stickOpacity} min="0" max="1" step="0.01" />
           </label>
          
          <!-- Helix Settings -->
          <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.stickOverhang} onclick={() => toggleLock('stickOverhang')} title="Click to lock/unlock for randomize">Overhang: {config.stickOverhang.toFixed(0)}°</button>
               <input type="range" bind:value={config.stickOverhang} min="0" max="180" step="1" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.rotationCenterOffsetX} onclick={() => toggleLock('rotationCenterOffsetX')} title="Click to lock/unlock for randomize">Rotation Center X: {config.rotationCenterOffsetX.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetX} min="-100" max="100" step="5" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.rotationCenterOffsetY} onclick={() => toggleLock('rotationCenterOffsetY')} title="Click to lock/unlock for randomize">Rotation Center Y: {config.rotationCenterOffsetY.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetY} min="-100" max="100" step="5" />
             </label>
           </div>
        </section>
      
      <!-- Camera View -->
      <section class="control-section">
        <h3>Camera View</h3>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraAzimuth} onclick={() => toggleLock('cameraAzimuth')} title="Click to lock/unlock for randomize">Azimuth: {config.camera.azimuth}°</button>
          <input type="range" bind:value={config.camera.azimuth} min="0" max="360" step="5" />
        </label>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraElevation} onclick={() => toggleLock('cameraElevation')} title="Click to lock/unlock for randomize">Elevation: {config.camera.elevation}°</button>
          <input type="range" bind:value={config.camera.elevation} min="-80" max="80" step="5" />
        </label>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraDistance} onclick={() => toggleLock('cameraDistance')} title="Click to lock/unlock for randomize">Distance: {config.camera.distance.toFixed(1)}</button>
          <input type="range" bind:value={config.camera.distance} min="5" max="50" step="0.1" />
        </label>
      </section>
      
      <!-- Lighting -->
      <section class="control-section">
        <h3>Lighting</h3>
        <label class="control-row checkbox">
          <input type="checkbox" bind:checked={config.lighting.enabled} />
          <button
            type="button"
            class="setting-title"
            class:locked={locks.lightingEnabled}
            onclick={(e) => {
              e.preventDefault();
              toggleLock('lightingEnabled');
            }}
            title="Click to lock/unlock for randomize"
          >
            Enable Lighting
          </button>
        </label>
        {#if config.lighting.enabled}
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingIntensity} onclick={() => toggleLock('lightingIntensity')} title="Click to lock/unlock for randomize">Intensity: {config.lighting.intensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.intensity} min="0" max="3" step="0.1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingX} onclick={() => toggleLock('lightingX')} title="Click to lock/unlock for randomize">Position X: {config.lighting.position.x}</button>
            <input type="range" bind:value={config.lighting.position.x} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingY} onclick={() => toggleLock('lightingY')} title="Click to lock/unlock for randomize">Position Y: {config.lighting.position.y}</button>
            <input type="range" bind:value={config.lighting.position.y} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingZ} onclick={() => toggleLock('lightingZ')} title="Click to lock/unlock for randomize">Position Z: {config.lighting.position.z}</button>
            <input type="range" bind:value={config.lighting.position.z} min="0" max="20" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingAmbient} onclick={() => toggleLock('lightingAmbient')} title="Click to lock/unlock for randomize">Ambient: {config.lighting.ambientIntensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.ambientIntensity} min="0" max="1" step="0.1" />
          </label>
        {/if}
      </section>

      <!-- Render -->
      <section class="control-section">
        <h3>Render</h3>

        <label class="control-row slider">
          <span class="setting-title">Exposure: {config.rendering.exposure.toFixed(2)}</span>
          <input type="range" bind:value={config.rendering.exposure} min="0.3" max="2.5" step="0.01" />
        </label>

        <label class="control-row">
          <span class="setting-title">Tone Mapping</span>
          <select bind:value={config.rendering.toneMapping}>
            <option value="aces">ACES</option>
            <option value="none">None</option>
          </select>
        </label>

        <label class="control-row">
          <span class="setting-title">Mode</span>
          <select bind:value={renderMode} title="Raster is instant; Path traced refines progressively">
            <option value="raster">Raster</option>
            <option value="path">Path traced</option>
          </select>
        </label>

        <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.environment.enabled} />
            <span class="setting-title">Environment (Reflections)</span>
          </label>
          <label class="control-row slider">
            <span class="setting-title">Env Intensity: {config.environment.intensity.toFixed(2)}</span>
            <input type="range" bind:value={config.environment.intensity} min="0" max="5" step="0.01" disabled={!config.environment.enabled} />
          </label>

          {#if config.texture !== 'matte'}
            <label class="control-row slider">
              <span class="setting-title">Env Rotation: {config.environment.rotation.toFixed(0)}°</span>
              <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
            </label>
            <label class="control-row">
              <span class="setting-title">Env Style</span>
              <select bind:value={config.environment.style} disabled={!config.environment.enabled}>
                <option value="studio">Studio</option>
                <option value="overcast">Overcast</option>
                <option value="sunset">Sunset</option>
              </select>
            </label>
          {:else}
            <details class="control-details">
              <summary class="control-details-summary">More env options</summary>
              <label class="control-row slider">
                <span class="setting-title">Env Rotation: {config.environment.rotation.toFixed(0)}°</span>
                <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
              </label>
              <label class="control-row">
                <span class="setting-title">Env Style</span>
                <select bind:value={config.environment.style} disabled={!config.environment.enabled}>
                  <option value="studio">Studio</option>
                  <option value="overcast">Overcast</option>
                  <option value="sunset">Sunset</option>
                </select>
              </label>
            </details>
          {/if}
        </div>

        <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.shadows.enabled} />
            <span class="setting-title">Shadows</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Shadow Type</span>
            <select bind:value={config.shadows.type} disabled={!config.shadows.enabled}>
              <option value="pcfsoft">PCF Soft</option>
              <option value="vsm">VSM</option>
            </select>
          </label>
          <label class="control-row slider">
            <span class="setting-title">Shadow Map: {config.shadows.mapSize}</span>
            <input type="range" bind:value={config.shadows.mapSize} min="256" max="4096" step="256" disabled={!config.shadows.enabled} />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Shadow tuning</summary>
            <label class="control-row slider">
              <span class="setting-title">Normal Bias: {config.shadows.normalBias.toFixed(3)}</span>
              <input type="range" bind:value={config.shadows.normalBias} min="0" max="0.2" step="0.001" disabled={!config.shadows.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Shadow Bias: {config.shadows.bias.toFixed(5)}</span>
              <input type="range" bind:value={config.shadows.bias} min="-0.01" max="0.01" step="0.00001" disabled={!config.shadows.enabled} />
            </label>
          </details>
        </div>

        <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
          <details class="control-details">
            <summary class="control-details-summary">Quality</summary>
            <label class="control-row slider">
              <span class="setting-title">Geometry Quality: {config.geometry.quality.toFixed(2)}</span>
              <input type="range" bind:value={config.geometry.quality} min="0" max="1" step="0.01" />
            </label>
          </details>
        </div>
      </section>

      <section class="control-section">
        <h3>CLI</h3>
        <div class="cli-controls">
          <textarea class="cli-text" readonly rows="4">{cliCommand}</textarea>
          <button class="cli-copy" onclick={copyCliCommand}>Copy</button>
        </div>
      </section>
    </div>
  </aside>
  
  <main class="preview-area">
    <div bind:this={canvasContainer} class="canvas-container" style={`background: ${config.backgroundColor}`}></div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    background: #0a0a0f;
    color: #fff;
    overflow: hidden;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
  }
  
  .sidebar {
    width: 300px;
    min-width: 300px;
    background: #111118;
    border-right: 1px solid #222;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #222;
    background: #0d0d12;
  }
  
  .sidebar-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
  }
  
  .control-section {
    background: #1a1a24;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #252530;
  }
  
  .control-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .export-controls {
    display: flex;
    gap: 0.5rem;
  }
  
  .export-controls select {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .export-controls button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .export-controls button:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .export-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .randomize-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: nowrap;
  }

  .randomize-buttons button {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0.5rem;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .cli-controls {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .cli-text {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #0f0f14;
    color: #d7d7e3;
    font-size: 0.75rem;
    line-height: 1.25;
    resize: vertical;
    min-height: 4.5rem;
  }

  .cli-copy {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .cli-copy:hover {
    background: #333;
  }
  
  .preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }
  
  .preset-buttons button {
    padding: 0.375rem 0.625rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #aaa;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }
  
  .preset-buttons button:hover {
    background: #333;
    color: #fff;
    border-color: #444;
  }

  .palette-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .palette-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .palette-row select {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.8125rem;
  }

  .palette-nav {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #1b1b24;
    color: #ddd;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }

  .palette-nav:hover {
    background: #333;
    color: #fff;
    border-color: #444;
  }

  .palette-preview {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .swatch {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;
  }

  .swatch-bg {
    width: 22px;
  }
  
  .input-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-row label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .input-row label span {
    font-size: 0.75rem;
    color: #888;
    min-width: 1rem;
  }
  
  .input-row input[type="number"] {
    flex: 1;
    padding: 0.375rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    width: 0;
  }
  
  .colors-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .color-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .color-item input[type="color"] {
    flex: 1;
    height: 32px;
    border: 1px solid #333;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  
  .remove-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: none;
    background: #ff4444;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .remove-btn:hover:not(:disabled) {
    background: #ff6666;
  }
  
  .remove-btn:disabled {
    background: #444;
    cursor: not-allowed;
  }
  
  .add-btn {
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px dashed #444;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .add-btn:hover {
    border-color: #666;
    color: #fff;
    background: #252530;
  }
  
  .control-row {
    display: flex;
    align-items: center;
    margin-bottom: 0.625rem;
  }
  
  .control-row:last-child {
    margin-bottom: 0;
  }

  .control-details {
    margin-top: 0.5rem;
    padding-top: 0.25rem;
  }

  .control-details-summary {
    cursor: pointer;
    user-select: none;
    font-size: 0.8125rem;
    color: #b6b6c6;
    margin-bottom: 0.5rem;
    outline: none;
  }

  .control-details[open] .control-details-summary {
    color: #fff;
  }
  
  .control-row .setting-title {
    min-width: 100px;
    font-size: 0.875rem;
    color: #ccc;
    text-align: left;
  }

  .setting-title {
    cursor: pointer;
    user-select: none;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    line-height: inherit;
    color: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  .setting-title:not(.locked):hover {
    color: #fff;
  }

  .setting-title.locked {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: #3a1111;
    border: 1px solid #ff5a5a;
    color: #ffd5d5;
  }

  .setting-title.locked:hover {
    background: #4a1616;
  }
  
  .control-row select {
    flex: 1;
    padding: 0.375rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .control-row input[type="color"] {
    width: 50px;
    height: 28px;
    border: 1px solid #333;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  
  .control-row.slider {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }
  
  .control-row.slider .setting-title {
    min-width: auto;
    font-size: 0.8125rem;
    color: #aaa;
  }
  
  .control-row input[type="range"] {
    width: 100%;
    height: 4px;
    background: #333;
    border-radius: 2px;
    outline: none;
    -webkit-appearance: none;
  }
  
  .control-row input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .control-row input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
  
  .control-row.checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .control-row.checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #667eea;
    cursor: pointer;
  }
  
  .control-row.checkbox .setting-title {
    min-width: auto;
  }
  
  .preview-area {
    flex: 1;
    background: #0a0a0f;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    position: relative;
  }
  
  .canvas-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f0f15;
    border-radius: 12px;
    border: 1px solid #1a1a24;
  }
  
  .canvas-container :global(canvas) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }
  
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.3s;
    }
    
    .sidebar.open {
      transform: translateX(0);
    }
    
    .preview-area {
      padding: 1rem;
    }
  }
</style>
