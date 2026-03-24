<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    DEFAULT_CONFIG, 
    DEFAULT_CONFIG_BY_TYPE,
    type WallpaperConfig,
    type WallpaperType,
    RESOLUTION_PRESETS,
    generateRandomConfigNoPresets,
    generateRandomConfigNoPresetsFromSeed,
    normalizeWallpaperConfig,
    encodeAppStateToBase64Url,
    decodeAppStateFromBase64Url,
    type WallpaperAppStateV1,
    exportToPNG,
    exportToJPG,
    exportToWebP,
    exportToSVG,
    downloadFile,
    renderWallpaperToCanvas
  } from '@wallpaper-maker/core';

  import { PopsiclePreview, type PreviewRenderMode } from '$lib/popsicle/preview';
  import { Basic3DPreview, type Basic3DType } from '$lib/basic3d/preview';

  type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

  import { COLOR_PRESETS, COLOR_PRESET_GROUPS, type ColorPreset } from '$lib/color-presets';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>(cloneDefaultConfig());
  
  let canvasContainer: HTMLDivElement;
  let canvasHost: HTMLDivElement;
  let preview: PopsiclePreview | null = null;
  let basic3dPreview: Basic3DPreview | null = null;
  let fallbackCanvas: HTMLCanvasElement | null = null;
  let renderMode = $state<PreviewRenderMode>('raster');

  // Friendly generator errors (e.g. invalid SVG input).
  let renderError = $state<string | null>(null);

  let collisionDragActive = $state(false);
  let cameraDragActive = $state(false);
  let canvasHoverActive = $state(false);

  let renderRaf = 0;
  let renderSettleTimer = 0;
  const RENDER_SETTLE_MS = 280;
  
  // Export format selection
  let exportFormat = $state<'png' | 'jpg' | 'webp' | 'svg'>('png');
  let isExporting = $state(false);
  
  // URL sync + CLI preview
  let urlSyncEnabled = $state(false);
  let cliCommand = $state('');
  let cliViewMode = $state<'bash' | 'json'>('bash');

  function randomSeedU32(): number {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return (a[0] >>> 0) || 1;
    } catch {
      return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    }
  }

  type LockMap = Record<string, boolean>;

  // UI-only: locks are not synced to URL.
  let locks = $state<LockMap>({});

  function isLocked(path: string): boolean {
    return !!locks[path];
  }

  function toggleLock(path: string) {
    locks = { ...locks, [path]: !locks[path] };
  }

  const colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }> = COLOR_PRESET_GROUPS
    .map((group) => ({ group, presets: COLOR_PRESETS.filter((p) => p.group === group) }))
    .filter((g) => g.presets.length > 0);

  // UI-only: selected preset is not synced to URL.
  let selectedColorPresetId = $state(COLOR_PRESETS[0]?.id ?? '');
  let selectedColorPreset = $derived(COLOR_PRESETS.find((p) => p.id === selectedColorPresetId) ?? null);

  function applyColorPreset(preset: ColorPreset) {
    if (preset.colors.length === 0) return;
    const nextColors = [...preset.colors];
    const pAny: any = (config as any).palette;
    const curOverrides: any[] = Array.isArray(pAny?.overrides) ? pAny.overrides.slice() : [];
    const nextOverrides = curOverrides.slice(0, nextColors.length);
    while (nextOverrides.length < nextColors.length) nextOverrides.push(null);

    config = {
      ...config,
      colors: nextColors,
      palette: { ...(pAny && typeof pAny === 'object' ? pAny : {}), overrides: nextOverrides },
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

  let is3DType = $derived(config.type === 'popsicle' || config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg3d');
  let supportsOutlineOnly = $derived(config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg3d');
  let supportsBloom = $derived(config.type !== 'hexgrid2d' && config.type !== 'ridges2d');
  let supportsCollisions = $derived(
    config.type === 'popsicle' ||
      config.type === 'circles2d' ||
      config.type === 'polygon2d' ||
      config.type === 'triangles2d' ||
      config.type === 'spheres3d' ||
      config.type === 'triangles3d'
  );
  let supportsEmission = $derived(
    config.type === 'popsicle' ||
      config.type === 'spheres3d' ||
      config.type === 'triangles3d' ||
      config.type === 'svg3d' ||
      config.type === 'circles2d' ||
      config.type === 'polygon2d' ||
      config.type === 'triangles2d' ||
      config.type === 'svg2d'
  );
  let showEmissionSection = $derived(
    supportsEmission && (config.type === 'circles2d' || config.type === 'polygon2d' || config.type === 'triangles2d' || config.type === 'svg2d' ? config.bloom.enabled : true)
  );

  type FallbackQuality = 'interactive' | 'final';

  function getFallbackPreviewSize(aspect: number, quality: FallbackQuality): {
    previewWidth: number;
    previewHeight: number;
    cssWidth: number;
    cssHeight: number;
  } {
    const cw = Math.max(1, canvasContainer?.clientWidth ?? 1);
    const ch = Math.max(1, canvasContainer?.clientHeight ?? 1);

    const safeAspect = Math.max(0.0001, aspect);
    const cssWidth = Math.min(cw, ch * safeAspect);
    const cssHeight = cssWidth / safeAspect;

    const scale = quality === 'interactive' ? 0.6 : 1.0;
    const previewWidth = Math.max(1, Math.round(cssWidth * scale));
    const previewHeight = Math.max(1, Math.round(cssHeight * scale));

    return { previewWidth, previewHeight, cssWidth, cssHeight };
  }

  function ensureBasic3DPreview(type: Basic3DType): Basic3DPreview {
    if (!canvasHost) {
      // Should not happen; render calls are guarded.
      throw new Error('canvasHost not ready');
    }
    if (!basic3dPreview) {
      basic3dPreview = new Basic3DPreview(canvasHost, type);
      return basic3dPreview;
    }
    basic3dPreview.setType(type);
    return basic3dPreview;
  }

  function disposeBasic3DPreview() {
    basic3dPreview?.dispose();
    basic3dPreview = null;
  }

  function renderBasic3DOnce(quality: FallbackQuality, opts?: { cameraOnly?: boolean }) {
    if (!canvasContainer || !canvasHost) return;

    const aspect = config.width / config.height;
    const { previewWidth, previewHeight, cssWidth, cssHeight } = getFallbackPreviewSize(aspect, quality);

    let effective: WallpaperConfig = { ...config } as any;

    // 3D collision masking is expensive; keep interactive renders snappy by previewing without collisions.
    if (quality === 'interactive' && effective.collisions?.mode === 'carve') {
      effective = {
        ...(effective as any),
        collisions: { ...effective.collisions, mode: 'none', carve: { ...effective.collisions.carve } }
      } as any;
    }

    try {
      const type = effective.type as Basic3DType;
      const p = ensureBasic3DPreview(type);
      p.renderOnce(effective as any, quality, { cameraOnly: !!opts?.cameraOnly, renderSize: { width: previewWidth, height: previewHeight } });

      const el = p.getDomElement();
      if (el) {
        el.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
        el.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
      }

      renderError = null;
    } catch (err: any) {
      renderError = String(err?.message || err);
      console.error('Render failed:', err);
    }
  }

  function render2DOnce(quality: FallbackQuality) {
    if (!canvasContainer || !canvasHost) return;

    const aspect = config.width / config.height;
    const { previewWidth, previewHeight, cssWidth, cssHeight } = getFallbackPreviewSize(aspect, quality);
    const effective: WallpaperConfig = { ...config, width: previewWidth, height: previewHeight } as any;

    try {
      const next = renderWallpaperToCanvas(effective, fallbackCanvas ?? undefined);
      next.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
      next.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
      fallbackCanvas = next;
      if (!next.parentElement) {
        canvasHost.innerHTML = '';
        canvasHost.appendChild(next);
      }
      renderError = null;
    } catch (err: any) {
      renderError = String(err?.message || err);
      console.error('Render failed:', err);
    }
  }

  function renderCurrentOnce(quality: FallbackQuality, opts?: { cameraOnly?: boolean }) {
    if (config.type === 'popsicle') {
      // Popsicle has its own persistent preview.
      if (quality === 'interactive') {
        if (config.collisions.mode === 'carve' && config.colors.length <= 8) {
          const c = {
            ...(config as any),
            collisions: { ...config.collisions, mode: 'none', carve: { ...config.collisions.carve } }
          } as PopsicleConfig;
          preview?.renderOnce(c, 'interactive');
        } else {
          preview?.renderOnce(config as PopsicleConfig, 'interactive');
        }
      } else {
        preview?.renderOnce(config as PopsicleConfig, 'final');
      }
      return;
    }

    if (config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg3d') {
      fallbackCanvas = null;
      renderBasic3DOnce(quality, opts);
      return;
    }

    // 2D types
    disposeBasic3DPreview();
    render2DOnce(quality);
  }

  function schedulePreviewRender() {
    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(() => {
      renderCurrentOnce('interactive', { cameraOnly: cameraDragActive });
    });

    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);

    if (!collisionDragActive && !cameraDragActive) {
      renderSettleTimer = window.setTimeout(() => {
        renderCurrentOnce('final');
      }, RENDER_SETTLE_MS);
    }
  }

  const CAMERA_DISTANCE_MIN = 5;
  const CAMERA_DISTANCE_MAX = 50;
  const CAMERA_ELEVATION_MIN = -80;
  const CAMERA_ELEVATION_MAX = 80;

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function wrapDeg360(deg: number): number {
    const d = deg % 360;
    return d < 0 ? d + 360 : d;
  }

  let camDragPointerId = -1;
  let camDragStartX = 0;
  let camDragStartY = 0;
  let camDragStartAzimuth = 0;
  let camDragStartElevation = 0;

  function resetCamera() {
    config.camera.distance = DEFAULT_CONFIG.camera.distance;
    config.camera.azimuth = DEFAULT_CONFIG.camera.azimuth;
    config.camera.elevation = DEFAULT_CONFIG.camera.elevation;
  }

  function nudgeCamera(kind: 'azimuth' | 'elevation' | 'distance', delta: number, e?: MouseEvent) {
    const mult = e?.shiftKey ? 10 : 1;
    if (kind === 'azimuth') {
      config.camera.azimuth = wrapDeg360(config.camera.azimuth + delta * mult);
    } else if (kind === 'elevation') {
      config.camera.elevation = clamp(config.camera.elevation + delta * mult, CAMERA_ELEVATION_MIN, CAMERA_ELEVATION_MAX);
    } else {
      config.camera.distance = clamp(config.camera.distance + delta * mult, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
    }
  }

  function handleCanvasPointerDown(e: PointerEvent) {
    if (!is3DType) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.camera-overlay')) return;

    cameraDragActive = true;
    camDragPointerId = e.pointerId;
    camDragStartX = e.clientX;
    camDragStartY = e.clientY;
    camDragStartAzimuth = config.camera.azimuth;
    camDragStartElevation = config.camera.elevation;

    canvasHoverActive = true;
    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore.
    }
    e.preventDefault();
  }

  function handleCanvasPointerMove(e: PointerEvent) {
    if (!cameraDragActive) return;
    if (e.pointerId !== camDragPointerId) return;

    const dx = e.clientX - camDragStartX;
    const dy = e.clientY - camDragStartY;

    const sensitivity = e.shiftKey ? 0.08 : 0.22; // deg/px
    config.camera.azimuth = wrapDeg360(camDragStartAzimuth + dx * sensitivity);
    config.camera.elevation = clamp(camDragStartElevation - dy * sensitivity, CAMERA_ELEVATION_MIN, CAMERA_ELEVATION_MAX);

    // Rendering is scheduled via reactive effects.
    e.preventDefault();
  }

  function handleCanvasPointerUp(e: PointerEvent) {
    if (!cameraDragActive) return;
    if (camDragPointerId !== -1 && e.pointerId !== camDragPointerId) return;
    cameraDragActive = false;
    camDragPointerId = -1;
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore.
    }
    schedulePreviewRender();
    e.preventDefault();
  }

  function handleCanvasWheel(e: WheelEvent) {
    if (!is3DType) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.camera-overlay')) return;

    // Smooth, multiplicative zoom.
    const factor = Math.pow(1.0015, e.deltaY);
    const next = clamp(config.camera.distance * factor, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
    config.camera.distance = next;
    e.preventDefault();
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

      const canvas = renderWallpaperToCanvas(config);
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
    const nextColors = [...config.colors, '#ffffff'];
    const pAny: any = (config as any).palette;
    const curOverrides: any[] = Array.isArray(pAny?.overrides) ? pAny.overrides.slice() : [];
    const nextOverrides = curOverrides.slice(0, nextColors.length);
    while (nextOverrides.length < nextColors.length) nextOverrides.push(null);
    config = { ...config, colors: nextColors, palette: { ...(pAny && typeof pAny === 'object' ? pAny : {}), overrides: nextOverrides } } as any;
    schedulePreviewRender();
  }
  
  function removeColor(index: number) {
    if (config.colors.length > 1) {
      const newColors = config.colors.filter((_, i) => i !== index);
      const pAny: any = (config as any).palette;
      const curOverrides: any[] = Array.isArray(pAny?.overrides) ? pAny.overrides.slice() : [];
      const nextOverrides = curOverrides.filter((_, i) => i !== index).slice(0, newColors.length);
      while (nextOverrides.length < newColors.length) nextOverrides.push(null);
      config = { ...config, colors: newColors, palette: { ...(pAny && typeof pAny === 'object' ? pAny : {}), overrides: nextOverrides } } as any;
      schedulePreviewRender();
    }
  }
  
  function updateColor(index: number, color: string) {
    const newColors = [...config.colors];
    newColors[index] = color;
    config = { ...config, colors: newColors };
  }

  function updatePaletteOverride(paletteIndex: number, fn: (cur: any | null) => any | null) {
    const colorsLen = Math.max(0, config.colors.length);
    const pAny: any = (config as any).palette;
    const palette = pAny && typeof pAny === 'object' ? pAny : { overrides: [] };
    const overrides: any[] = Array.isArray(palette.overrides) ? palette.overrides.slice() : [];
    while (overrides.length < colorsLen) overrides.push(null);

    const cur = overrides[paletteIndex];
    const curObj = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : null;
    const next = fn(curObj);
    overrides[paletteIndex] = next;
    config = { ...config, palette: { ...palette, overrides } } as any;
  }

  function togglePaletteOverride(paletteIndex: number) {
    updatePaletteOverride(paletteIndex, (cur) => {
      if (!cur) return { enabled: true };
      return { ...cur, enabled: !cur.enabled };
    });
  }

  function togglePaletteBlock(paletteIndex: number, block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry') {
    updatePaletteOverride(paletteIndex, (cur) => {
      const base = cur ?? { enabled: true };
      const enabled = typeof (base as any).enabled === 'boolean' ? (base as any).enabled : true;
      const next: any = { ...base, enabled };

      if (block === 'emission') {
        if (next.emission) delete next.emission;
        else next.emission = { enabled: true, intensity: Number(config.emission.intensity) || 0 };
      }

      if (block === 'texture') {
        if (next.texture) delete next.texture;
        else next.texture = { type: config.texture, params: {} };
      }

      if (block === 'grazing') {
        if (next.facades?.grazing) {
          next.facades = { ...(next.facades ?? {}) };
          delete next.facades.grazing;
        } else {
          next.facades = { ...(next.facades ?? {}), grazing: { ...config.facades.grazing } };
        }
      }

      if (block === 'side') {
        if (next.facades?.side) {
          next.facades = { ...(next.facades ?? {}) };
          delete next.facades.side;
        } else {
          next.facades = { ...(next.facades ?? {}), side: { ...config.facades.side } };
        }
      }

      if (block === 'outline') {
        if (next.facades?.outline) {
          next.facades = { ...(next.facades ?? {}) };
          delete next.facades.outline;
        } else {
          next.facades = { ...(next.facades ?? {}), outline: { ...config.facades.outline } };
        }
      }

      if (block === 'edge') {
        if (next.edge) delete next.edge;
        else next.edge = { ...config.edge, seam: { ...config.edge.seam }, band: { ...config.edge.band } };
      }

      if (block === 'geometry') {
        if (next.geometry) {
          delete next.geometry;
        } else {
          if (config.type === 'popsicle') next.geometry = { popsicle: { sizeMult: 1, ratioMult: 1, thicknessMult: 1 } };
          else if (config.type === 'spheres3d') next.geometry = { spheres3d: { radiusMult: 1 } };
          else if (config.type === 'triangles3d') next.geometry = { triangles3d: { radiusMult: 1, heightMult: 1 } };
          else if (config.type === 'svg3d') next.geometry = { svg: { sizeMult: 1, extrudeMult: 1 } };
          else if (config.type === 'svg2d') next.geometry = { svg: { sizeMult: 1 } };
          else next.geometry = {};
        }
      }

      return next;
    });
  }

  function cloneDefaultConfig(): WallpaperConfig {
      return {
         ...DEFAULT_CONFIG,
            colors: [...DEFAULT_CONFIG.colors],
            palette: { overrides: Array.isArray((DEFAULT_CONFIG as any).palette?.overrides) ? (DEFAULT_CONFIG as any).palette.overrides.map((v: any) => (v && typeof v === 'object' ? { ...v } : null)) : [] },
             textureParams: {
               drywall: { ...DEFAULT_CONFIG.textureParams.drywall },
               glass: { ...DEFAULT_CONFIG.textureParams.glass },
               cel: { ...DEFAULT_CONFIG.textureParams.cel }
             },
            facades: {
              side: { ...DEFAULT_CONFIG.facades.side },
              grazing: { ...DEFAULT_CONFIG.facades.grazing },
              outline: { ...DEFAULT_CONFIG.facades.outline }
            },
            edge: { ...DEFAULT_CONFIG.edge, seam: { ...DEFAULT_CONFIG.edge.seam }, band: { ...DEFAULT_CONFIG.edge.band } },
             bubbles: { ...(DEFAULT_CONFIG as any).bubbles },
            emission: { ...DEFAULT_CONFIG.emission },
            bloom: { ...DEFAULT_CONFIG.bloom },
            collisions: { ...DEFAULT_CONFIG.collisions, carve: { ...DEFAULT_CONFIG.collisions.carve } },
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

    const cloneAny = <T>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    };

    const merged: WallpaperConfig = {
      ...next,
      colors: [...next.colors],
      palette: {
        overrides: Array.isArray((next as any).palette?.overrides) ? cloneAny((next as any).palette.overrides) : []
      } as any,
      textureParams: {
        drywall: { ...next.textureParams.drywall },
        glass: { ...next.textureParams.glass },
        cel: { ...next.textureParams.cel }
      },
      facades: {
        side: { ...next.facades.side },
        grazing: { ...next.facades.grazing },
        outline: { ...next.facades.outline }
      },
      edge: { ...next.edge, seam: { ...next.edge.seam }, band: { ...next.edge.band } },
       bubbles: { ...(next as any).bubbles },
      emission: { ...next.emission },
      bloom: { ...next.bloom },
      collisions: { ...next.collisions, carve: { ...next.collisions.carve } },
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

    // Geometry quality is not randomized; always preserve the current value.
    merged.geometry = { ...current.geometry };

    const getAtPath = (obj: any, path: string): any => {
      const parts = path.split('.').filter(Boolean);
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    };

    const setAtPath = (obj: any, path: string, value: any) => {
      const parts = path.split('.').filter(Boolean);
      if (parts.length === 0) return;
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
    };

    // 3D collisions are not randomized; preserve them when the type stays 3D.
    const currentIs3D = current.type === 'popsicle' || current.type === 'spheres3d' || current.type === 'triangles3d' || current.type === 'svg3d';
    const nextIs3D = merged.type === 'popsicle' || merged.type === 'spheres3d' || merged.type === 'triangles3d' || merged.type === 'svg3d';
    if (currentIs3D && nextIs3D) {
      merged.collisions = cloneAny(current.collisions);
    }

    // Apply UI locks (by config path). Skip paths that don't exist on either config.
    for (const [path, locked] of Object.entries(locks)) {
      if (!locked) continue;
      const curVal = getAtPath(current as any, path);
      if (typeof curVal === 'undefined') continue;
      const nextVal = getAtPath(merged as any, path);
      if (typeof nextVal === 'undefined') continue;
      setAtPath(merged as any, path, cloneAny(curVal));
    }

    // Randomize-current special case: never randomize the SVG source.
    if ((current.type === 'svg2d' || current.type === 'svg3d') && merged.type === current.type) {
      try {
        (merged as any).svg = { ...(merged as any).svg, source: (current as any).svg?.source };
      } catch {
        // Ignore.
      }
    }

    return merged;
  }

  function cloneConfigDeep(src: WallpaperConfig): WallpaperConfig {
    const cloneAny = <T>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    };

    const palette = {
      overrides: Array.isArray((src as any).palette?.overrides) ? cloneAny((src as any).palette.overrides) : []
    } as any;

    switch (src.type) {
      case 'popsicle':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry }
        };
      case 'spheres3d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          spheres: { ...src.spheres, colorWeights: [...src.spheres.colorWeights], shape: { ...src.spheres.shape } }
        };
      case 'circles2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          circles: {
            ...src.circles,
            stroke: { ...src.circles.stroke },
            colorWeights: [...src.circles.colorWeights],
            croissant: { ...src.circles.croissant }
          }
        };
      case 'polygon2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          polygons: {
            ...src.polygons,
            stroke: { ...src.polygons.stroke },
            colorWeights: [...src.polygons.colorWeights]
          }
        };
      case 'triangles2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          triangles: {
            ...src.triangles,
            stroke: { ...src.triangles.stroke },
            colorWeights: [...src.triangles.colorWeights],
            shading: { ...src.triangles.shading }
          }
        };
      case 'triangles3d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          prisms: { ...src.prisms, colorWeights: [...src.prisms.colorWeights] }
        };
      case 'hexgrid2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          hexgrid: {
            ...src.hexgrid,
            originPx: { ...src.hexgrid.originPx },
            stroke: { ...src.hexgrid.stroke },
            coloring: { ...src.hexgrid.coloring, weights: [...src.hexgrid.coloring.weights] },
            effect: { ...src.hexgrid.effect },
            grouping: { ...src.hexgrid.grouping }
          }
        };
      case 'ridges2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          ridges: {
            ...src.ridges,
            fillBands: { ...src.ridges.fillBands },
            colorWeights: [...src.ridges.colorWeights]
          }
        };
      case 'svg2d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          svg: {
            ...src.svg,
            stroke: { ...src.svg.stroke },
            colorWeights: [...(src.svg.colorWeights ?? [])]
          }
        };
      case 'svg3d':
        return {
          ...src,
          colors: [...src.colors],
          palette,
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          facades: {
            side: { ...src.facades.side },
            grazing: { ...src.facades.grazing },
            outline: { ...src.facades.outline }
          },
          edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
          bubbles: { ...(src as any).bubbles },
          emission: { ...src.emission },
          bloom: { ...src.bloom },
          collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
          lighting: {
            ...src.lighting,
            position: { ...src.lighting.position }
          },
          camera: { ...src.camera },
          environment: { ...src.environment },
          shadows: { ...src.shadows },
          rendering: { ...src.rendering },
          geometry: { ...src.geometry },
          svg: {
            ...src.svg,
            bevel: { ...src.svg.bevel },
            colorWeights: [...(src.svg.colorWeights ?? [])]
          }
        };
    }
  }

  function switchType(nextType: WallpaperType) {
    if (nextType === config.type) return;

    const current = config;
    const next = cloneConfigDeep(DEFAULT_CONFIG_BY_TYPE[nextType]);

    // Preserve shared fields.
    next.seed = current.seed;
    next.width = current.width;
    next.height = current.height;
    next.colors = [...current.colors];
    {
      const curOverrides: any[] = Array.isArray((current as any).palette?.overrides) ? (current as any).palette.overrides : [];
      let nextOverrides: any[];
      try {
        nextOverrides = structuredClone(curOverrides);
      } catch {
        nextOverrides = JSON.parse(JSON.stringify(curOverrides));
      }
      nextOverrides = nextOverrides.slice(0, next.colors.length);
      while (nextOverrides.length < next.colors.length) nextOverrides.push(null);
      (next as any).palette = { overrides: nextOverrides };
    }
    next.backgroundColor = current.backgroundColor;
    next.texture = current.texture;
    next.textureParams = {
      drywall: { ...current.textureParams.drywall },
      glass: { ...current.textureParams.glass },
      cel: { ...current.textureParams.cel }
    };
    next.facades = {
      side: { ...current.facades.side },
      grazing: { ...current.facades.grazing },
      outline: { ...current.facades.outline }
    };
    next.edge = { ...current.edge, seam: { ...current.edge.seam }, band: { ...current.edge.band } };
    (next as any).bubbles = { ...(current as any).bubbles };
    next.emission = { ...current.emission };
    next.bloom = { ...current.bloom };
    next.collisions = { ...current.collisions, carve: { ...current.collisions.carve } };
    next.lighting = { ...current.lighting, position: { ...current.lighting.position } };
    next.camera = { ...current.camera };
    next.environment = { ...current.environment };
    next.shadows = { ...current.shadows };
    next.rendering = { ...current.rendering };
    next.geometry = { ...current.geometry };

    // When switching between SVG generators, keep the current source.
    if ((current as any)?.svg?.source && (next as any)?.svg) {
      try {
        (next as any).svg = { ...(next as any).svg, source: (current as any).svg.source };
      } catch {
        // Ignore.
      }
    }

    config = next;
    schedulePreviewRender();
  }

  type WeightTarget = 'spheres' | 'circles' | 'polygons' | 'triangles2d' | 'prisms' | 'hexgrid' | 'ridges' | 'svg';

  function setEqualWeights(target: WeightTarget) {
    const n = Math.max(0, config.colors.length);
    const w = Array.from({ length: n }, () => 1);

    if (target === 'spheres' && config.type === 'spheres3d') config.spheres.colorWeights = w;
    if (target === 'circles' && config.type === 'circles2d') config.circles.colorWeights = w;
    if (target === 'polygons' && config.type === 'polygon2d') config.polygons.colorWeights = w;
    if (target === 'triangles2d' && config.type === 'triangles2d') config.triangles.colorWeights = w;
    if (target === 'prisms' && config.type === 'triangles3d') config.prisms.colorWeights = w;
    if (target === 'hexgrid' && config.type === 'hexgrid2d') config.hexgrid.coloring.weights = w;
    if (target === 'ridges' && config.type === 'ridges2d') config.ridges.colorWeights = w;
    if (target === 'svg' && (config.type === 'svg2d' || config.type === 'svg3d')) config.svg.colorWeights = w;
  }

  function setRandomWeights(target: WeightTarget) {
    const n = Math.max(0, config.colors.length);
    const w = Array.from({ length: n }, () => Number(Math.max(0.01, Math.random()).toFixed(3)));

    if (target === 'spheres' && config.type === 'spheres3d') config.spheres.colorWeights = w;
    if (target === 'circles' && config.type === 'circles2d') config.circles.colorWeights = w;
    if (target === 'polygons' && config.type === 'polygon2d') config.polygons.colorWeights = w;
    if (target === 'triangles2d' && config.type === 'triangles2d') config.triangles.colorWeights = w;
    if (target === 'prisms' && config.type === 'triangles3d') config.prisms.colorWeights = w;
    if (target === 'hexgrid' && config.type === 'hexgrid2d') config.hexgrid.coloring.weights = w;
    if (target === 'ridges' && config.type === 'ridges2d') config.ridges.colorWeights = w;
    if (target === 'svg' && (config.type === 'svg2d' || config.type === 'svg3d')) config.svg.colorWeights = w;
  }

  function updateWeight(target: WeightTarget, index: number, value: number) {
    const i = Math.max(0, Math.floor(index));
    const v = Number.isFinite(value) ? value : 0;

    if (target === 'spheres' && config.type === 'spheres3d') {
      const a = [...(config.spheres.colorWeights ?? [])];
      a[i] = v;
      config.spheres.colorWeights = a;
    }

    if (target === 'circles' && config.type === 'circles2d') {
      const a = [...(config.circles.colorWeights ?? [])];
      a[i] = v;
      config.circles.colorWeights = a;
    }

    if (target === 'polygons' && config.type === 'polygon2d') {
      const a = [...(config.polygons.colorWeights ?? [])];
      a[i] = v;
      config.polygons.colorWeights = a;
    }

    if (target === 'triangles2d' && config.type === 'triangles2d') {
      const a = [...(config.triangles.colorWeights ?? [])];
      a[i] = v;
      config.triangles.colorWeights = a;
    }

    if (target === 'prisms' && config.type === 'triangles3d') {
      const a = [...(config.prisms.colorWeights ?? [])];
      a[i] = v;
      config.prisms.colorWeights = a;
    }

    if (target === 'hexgrid' && config.type === 'hexgrid2d') {
      const a = [...(config.hexgrid.coloring.weights ?? [])];
      a[i] = v;
      config.hexgrid.coloring.weights = a;
    }

    if (target === 'ridges' && config.type === 'ridges2d') {
      const a = [...(config.ridges.colorWeights ?? [])];
      a[i] = v;
      config.ridges.colorWeights = a;
    }

    if (target === 'svg' && (config.type === 'svg2d' || config.type === 'svg3d')) {
      const a = [...(config.svg.colorWeights ?? [])];
      a[i] = v;
      config.svg.colorWeights = a;
    }
  }

  function generateRandomGeneratedColors() {
    // Randomize everything, including a non-preset generated color theme.
    const seed = randomSeedU32();
    config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, config.type));
    schedulePreviewRender();
  }

  function generateRandomIncludingType() {
    const seed = randomSeedU32();
    const types: WallpaperType[] = ['popsicle', 'spheres3d', 'svg3d', 'circles2d', 'polygon2d', 'svg2d', 'triangles2d', 'ridges2d', 'triangles3d', 'hexgrid2d'];
    const currentType = config.type;
    let nextType = types[seed % types.length] ?? 'popsicle';
    if (types.length > 1 && nextType === currentType) {
      nextType = types[(types.indexOf(nextType) + 1) % types.length] ?? nextType;
    }
    config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, nextType));
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
    const parts: string[] = [];
    parts.push('pnpm', 'cli', 'generate');
    // The CLI accepts either a full app-state object or just the config; we pass the config.
    parts.push('--config', quoteCliArg(JSON.stringify(config)));
    return parts.join(' ');
  }

  function buildCliJsonString(): string {
    return JSON.stringify(config, null, 2);
  }

  function buildCliWidgetText(): string {
    return cliViewMode === 'json' ? buildCliJsonString() : buildCliCommandString();
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
    void cliViewMode;
    cliCommand = buildCliWidgetText();
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
    if (!urlSyncEnabled) return;
    if (!canvasContainer) return;
    if (!canvasHost) return;
    void config.type;

    if (config.type === 'popsicle') {
      if (!preview) {
        disposeBasic3DPreview();
        fallbackCanvas = null;
        canvasHost.innerHTML = '';
        preview = new PopsiclePreview(canvasHost);
        preview.setMode(renderMode);
      }
      return;
    }

    if (preview) {
      preview.dispose();
      preview = null;
    }
    fallbackCanvas = null;
    renderMode = 'raster';
    renderCurrentOnce('final');
  });
  
  $effect(() => {
    if (!canvasContainer) return;
    // Touch all relevant fields so deep mutations re-run this effect.
    // This is critical because many controls mutate nested properties in-place.
    const c = config;
    void c.type;
    void c.width;
    void c.height;
    void c.seed;
    void c.colors.join(',');
    {
      const ovs: any[] | undefined = (c as any).palette?.overrides;
      if (Array.isArray(ovs)) {
        for (const o of ovs) {
          if (!o || typeof o !== 'object') continue;
          void o.enabled;
          void o.emission?.enabled;
          void o.emission?.intensity;
          void o.texture?.type;
          void o.texture?.params?.drywall?.grainAmount;
          void o.texture?.params?.drywall?.grainScale;
          void o.texture?.params?.glass?.style;
          void o.texture?.params?.cel?.bands;
          void o.texture?.params?.cel?.halftone;
          void o.facades?.grazing?.enabled;
          void o.facades?.grazing?.mode;
          void o.facades?.grazing?.color;
          void o.facades?.grazing?.strength;
          void o.facades?.grazing?.power;
          void o.facades?.grazing?.width;
          void o.facades?.grazing?.noise;
          void o.facades?.side?.enabled;
          void o.facades?.side?.tintColor;
          void o.facades?.side?.tintAmount;
          void o.facades?.side?.materialAmount;
          void o.facades?.side?.roughness;
          void o.facades?.side?.metalness;
          void o.facades?.side?.clearcoat;
          void o.facades?.side?.envIntensityMult;
          void o.facades?.outline?.enabled;
          void o.facades?.outline?.color;
          void o.facades?.outline?.thickness;
          void o.facades?.outline?.opacity;
          void o.edge?.hollow;
          void o.edge?.seam?.enabled;
          void o.edge?.seam?.color;
          void o.edge?.seam?.opacity;
          void o.edge?.seam?.width;
          void o.edge?.seam?.noise;
          void o.edge?.seam?.emissiveIntensity;
          void o.edge?.band?.enabled;
          void o.edge?.band?.color;
          void o.edge?.band?.opacity;
          void o.edge?.band?.width;
          void o.edge?.band?.noise;
          void o.edge?.band?.emissiveIntensity;
        }
      }
    }
    void c.texture;
    void c.textureParams.drywall.grainAmount;
    void c.textureParams.drywall.grainScale;
    void c.textureParams.glass.style;
    void c.textureParams.cel.bands;
    void c.textureParams.cel.halftone;
    void c.backgroundColor;
    void c.facades.side.enabled;
    void c.facades.side.tintColor;
    void c.facades.side.tintAmount;
    void c.facades.side.materialAmount;
    void c.facades.side.roughness;
    void c.facades.side.metalness;
    void c.facades.side.clearcoat;
    void c.facades.side.envIntensityMult;
    void c.facades.grazing.enabled;
    void c.facades.grazing.mode;
    void c.facades.grazing.color;
    void c.facades.grazing.strength;
    void c.facades.grazing.power;
    void c.facades.grazing.width;
    void c.facades.grazing.noise;
    void c.facades.outline.enabled;
    void c.facades.outline.color;
    void c.facades.outline.thickness;
    void c.facades.outline.opacity;
    void c.edge.hollow;
    void c.edge.seam.enabled;
    void c.edge.seam.color;
    void c.edge.seam.opacity;
    void c.edge.seam.width;
    void c.edge.seam.noise;
    void c.edge.seam.emissiveIntensity;
    void c.edge.band.enabled;
    void c.edge.band.color;
    void c.edge.band.opacity;
    void c.edge.band.width;
    void c.edge.band.noise;
    void c.edge.band.emissiveIntensity;
    void c.emission.enabled;
    void c.emission.paletteIndex;
    void c.emission.intensity;
    void c.bloom.enabled;
    void c.bloom.strength;
    void c.bloom.radius;
    void c.bloom.threshold;
    void c.collisions.mode;
    void c.collisions.carve.direction;
    void c.collisions.carve.marginPx;
    void c.collisions.carve.edge;
    void c.collisions.carve.featherPx;
    void (c as any).bubbles?.enabled;
    void (c as any).bubbles?.frequency;
    void (c as any).bubbles?.frequencyVariance;
    void (c as any).bubbles?.count;
    void (c as any).bubbles?.radiusMin;
    void (c as any).bubbles?.radiusMax;
    void (c as any).bubbles?.softness;
    void (c as any).bubbles?.wallThickness;
    void (c as any).bubbles?.seedOffset;
    if (c.type === 'popsicle') {
      void c.stickCount;
      void c.stickOverhang;
      void c.rotationCenterOffsetX;
      void c.rotationCenterOffsetY;
      void c.stickGap;
      void c.stickSize;
      void c.stickRatio;
      void c.stickThickness;
      void c.stickEndProfile;
      void c.stickRoundness;
      void c.stickChipAmount;
      void c.stickChipJaggedness;
      void c.stickBevel;
      void c.stickOpacity;
    }
    if (c.type === 'spheres3d') {
      void c.spheres.count;
      void c.spheres.distribution;
      void c.spheres.radiusMin;
      void c.spheres.radiusMax;
      void c.spheres.spread;
      void c.spheres.depth;
      void c.spheres.layers;
      void c.spheres.paletteMode;
      void c.spheres.colorWeights.join(',');
      void c.spheres.opacity;
      void c.spheres.shape.kind;
      void c.spheres.shape.roundness;
      void c.spheres.shape.faceting;
    }
    if (c.type === 'circles2d') {
      void c.circles.mode;
      void c.circles.count;
      void c.circles.rMinPx;
      void c.circles.rMaxPx;
      void c.circles.jitter;
      void c.circles.fillOpacity;
      void c.circles.stroke.enabled;
      void c.circles.stroke.widthPx;
      void c.circles.stroke.color;
      void c.circles.stroke.opacity;
      void c.circles.paletteMode;
      void c.circles.colorWeights.join(',');
      void c.circles.croissant.enabled;
      void c.circles.croissant.innerScale;
      void c.circles.croissant.offset;
      void c.circles.croissant.angleJitterDeg;
    }
    if (c.type === 'polygon2d') {
      void c.polygons.count;
      void c.polygons.edges;
      void c.polygons.rMinPx;
      void c.polygons.rMaxPx;
      void c.polygons.jitter;
      void c.polygons.rotateJitterDeg;
      void c.polygons.fillOpacity;
      void c.polygons.stroke.enabled;
      void c.polygons.stroke.widthPx;
      void c.polygons.stroke.color;
      void c.polygons.stroke.opacity;
      void c.polygons.paletteMode;
      void c.polygons.colorWeights.join(',');
    }
    if (c.type === 'triangles2d') {
      void c.triangles.mode;
      void c.triangles.density;
      void c.triangles.scalePx;
      void c.triangles.jitter;
      void c.triangles.rotateJitterDeg;
      void c.triangles.insetPx;
      void c.triangles.fillOpacity;
      void c.triangles.stroke.enabled;
      void c.triangles.stroke.widthPx;
      void c.triangles.stroke.color;
      void c.triangles.stroke.opacity;
      void c.triangles.paletteMode;
      void c.triangles.colorWeights.join(',');
      void c.triangles.shading.enabled;
      void c.triangles.shading.lightDeg;
      void c.triangles.shading.strength;
    }
    if (c.type === 'triangles3d') {
      void c.prisms.mode;
      void c.prisms.count;
      void c.prisms.base;
      void c.prisms.radius;
      void c.prisms.height;
      void c.prisms.taper;
      void c.prisms.wallBulgeX;
      void c.prisms.wallBulgeY;
      void c.prisms.spread;
      void c.prisms.jitter;
      void c.prisms.paletteMode;
      void c.prisms.colorWeights.join(',');
      void c.prisms.opacity;
    }
    if (c.type === 'svg2d') {
      void (c as any).svg?.source;
      void (c as any).svg?.count;
      void (c as any).svg?.rMinPx;
      void (c as any).svg?.rMaxPx;
      void (c as any).svg?.jitter;
      void (c as any).svg?.rotateJitterDeg;
      void (c as any).svg?.fillOpacity;
      void (c as any).svg?.stroke?.enabled;
      void (c as any).svg?.stroke?.widthPx;
      void (c as any).svg?.stroke?.color;
      void (c as any).svg?.stroke?.opacity;
      void (c as any).svg?.paletteMode;
      void (c as any).svg?.colorWeights?.join(',');
    }
    if (c.type === 'svg3d') {
      void (c as any).svg?.source;
      void (c as any).svg?.count;
      void (c as any).svg?.spread;
      void (c as any).svg?.depth;
      void (c as any).svg?.sizeMin;
      void (c as any).svg?.sizeMax;
      void (c as any).svg?.extrudeDepth;
      void (c as any).svg?.bevel?.enabled;
      void (c as any).svg?.bevel?.size;
      void (c as any).svg?.bevel?.segments;
      void (c as any).svg?.paletteMode;
      void (c as any).svg?.colorWeights?.join(',');
      void (c as any).svg?.opacity;
    }
    if (c.type === 'hexgrid2d') {
      void c.hexgrid.radiusPx;
      void c.hexgrid.marginPx;
      void c.hexgrid.overscanPx;
      void c.hexgrid.fillOpacity;
      void c.hexgrid.originPx.x;
      void c.hexgrid.originPx.y;
      void c.hexgrid.stroke.enabled;
      void c.hexgrid.stroke.widthPx;
      void c.hexgrid.stroke.join;
      void c.hexgrid.stroke.color;
      void c.hexgrid.stroke.opacity;
      void c.hexgrid.coloring.paletteMode;
      void c.hexgrid.coloring.weightsMode;
      void c.hexgrid.coloring.preset;
      void c.hexgrid.coloring.weights.join(',');
      void c.hexgrid.grouping.mode;
      void c.hexgrid.grouping.strength;
      void c.hexgrid.grouping.targetGroupCount;
      void c.hexgrid.effect.kind;
      void c.hexgrid.effect.amount;
      void c.hexgrid.effect.frequency;
    }
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
    if (config.type !== 'popsicle' && renderMode === 'path') {
      renderMode = 'raster';
      return;
    }

    if ((config.texture === 'cel' || config.facades.outline.enabled || config.bloom.enabled) && renderMode === 'path') {
      renderMode = 'raster';
    }
  });

  $effect(() => {
    const maxIndex = Math.max(0, config.colors.length - 1);
    const next = Math.max(0, Math.min(maxIndex, Math.round(Number(config.emission.paletteIndex) || 0)));
    if (config.emission.paletteIndex !== next) {
      config.emission.paletteIndex = next;
    }
  });

  $effect(() => {
    // Avoid no-op toggles: emission for 2D types needs bloom; hexgrid doesn't support either.
    if (config.type === 'circles2d' || config.type === 'polygon2d' || config.type === 'triangles2d') {
      if (config.emission.enabled && !config.bloom.enabled) {
        config.bloom.enabled = true;
      }
    }

    if (config.type === 'hexgrid2d' || config.type === 'ridges2d') {
      if (config.emission.enabled) config.emission.enabled = false;
      if (config.bloom.enabled) config.bloom.enabled = false;
    }
  });

  $effect(() => {
    if (!preview) return;
    if (config.type !== 'popsicle') return;
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
          config = normalizeWallpaperConfig(state.c as any);
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
    preview = null;
    disposeBasic3DPreview();
    fallbackCanvas = null;
    if (canvasHost) canvasHost.innerHTML = '';

    if (config.type === 'popsicle') {
      preview = new PopsiclePreview(canvasHost);
      preview.setMode(renderMode);
    } else {
      renderMode = 'raster';
      renderCurrentOnce('final');
    }

    schedulePreviewRender();
    
    const resizeObserver = new ResizeObserver(() => {
      schedulePreviewRender();
    });

    const handleGlobalPointerUp = () => {
      let changed = false;

      if (cameraDragActive) {
        cameraDragActive = false;
        camDragPointerId = -1;
        changed = true;
      }

      if (collisionDragActive) {
        collisionDragActive = false;
        changed = true;
      }

      if (changed) schedulePreviewRender();
    };

    const handleGlobalBlur = () => {
      // If the window loses focus mid-drag, make sure we can recover.
      handleGlobalPointerUp();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { passive: true });
    window.addEventListener('blur', handleGlobalBlur);
    
    if (canvasContainer) {
      resizeObserver.observe(canvasContainer);
    }
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleGlobalBlur);
      if (renderRaf) cancelAnimationFrame(renderRaf);
      if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
      preview?.dispose();
      preview = null;
      disposeBasic3DPreview();
      fallbackCanvas = null;
      if (canvasHost) canvasHost.innerHTML = '';
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
        <!-- Random Config -->
         <section class="control-section">
           <h3>Randomize</h3>
           <div class="randomize-buttons">
             <button type="button" onclick={generateRandomGeneratedColors} title="Randomize all settings, generate a new non-preset color theme">
                current
              </button>
              <button type="button" onclick={generateRandomIncludingType} title="Randomize all settings and generator type (keeps resolution/geometry quality)">
                all
              </button>
            </div>
          </section>

      <!-- Type -->
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

      <!-- Colors Section -->
      <section class="control-section">
        <h3>
          <button type="button" class="setting-title" class:locked={isLocked('colors')} onclick={() => toggleLock('colors')} title="Click to lock/unlock for randomize">
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), sizeMult: v }
                                  }
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), ratioMult: v }
                                  }
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    popsicle: { ...(((cur as any)?.geometry?.popsicle ?? {}) as any), thicknessMult: v }
                                  }
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    spheres3d: { ...(((cur as any)?.geometry?.spheres3d ?? {}) as any), radiusMult: v }
                                  }
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    triangles3d: { ...(((cur as any)?.geometry?.triangles3d ?? {}) as any), radiusMult: v }
                                  }
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
                                  geometry: {
                                    ...((cur as any)?.geometry ?? {}),
                                    triangles3d: { ...(((cur as any)?.geometry?.triangles3d ?? {}) as any), heightMult: v }
                                  }
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
                                  texture: {
                                    ...(cur?.texture ?? {}),
                                    params: { ...((cur?.texture as any)?.params ?? {}), glass: { style: v } }
                                  }
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
      </section>
      
      <!-- Appearance -->
      <section class="control-section">
        <h3>Appearance</h3>
        {#if is3DType}
          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('texture')} onclick={() => toggleLock('texture')} title="Click to lock/unlock for randomize">Texture</button>
            <select bind:value={config.texture}>
              <option value="glossy">Glossy</option>
              <option value="matte">Matte</option>
              <option value="metallic">Metallic</option>
              <option value="drywall">Drywall</option>
              <option value="glass">Glass</option>
              <option value="mirror">Mirror</option>
              <option value="cel">Cel</option>
            </select>
          </label>

          {#if config.texture === 'drywall'}
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('textureParams.drywall.grainAmount')} onclick={() => toggleLock('textureParams.drywall.grainAmount')} title="Click to lock/unlock for randomize">Grain: {config.textureParams.drywall.grainAmount.toFixed(2)}</button>
              <input type="range" bind:value={config.textureParams.drywall.grainAmount} min="0" max="1" step="0.01" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('textureParams.drywall.grainScale')} onclick={() => toggleLock('textureParams.drywall.grainScale')} title="Click to lock/unlock for randomize">Grain Scale: {config.textureParams.drywall.grainScale.toFixed(2)}</button>
              <input type="range" bind:value={config.textureParams.drywall.grainScale} min="0.5" max="8" step="0.05" />
            </label>
          {/if}

          {#if config.texture === 'glass'}
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('textureParams.glass.style')} onclick={() => toggleLock('textureParams.glass.style')} title="Click to lock/unlock for randomize">Glass Style</button>
              <select bind:value={config.textureParams.glass.style}>
                <option value="simple">Simple</option>
                <option value="frosted">Frosted</option>
                <option value="thick">Thick</option>
                <option value="stylized">Stylized</option>
              </select>
            </label>
          {/if}

          {#if config.texture === 'cel'}
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('textureParams.cel.bands')} onclick={() => toggleLock('textureParams.cel.bands')} title="Click to lock/unlock for randomize">Bands: {Math.round(config.textureParams.cel.bands)}</button>
              <input type="range" bind:value={config.textureParams.cel.bands} min="2" max="8" step="1" />
            </label>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.textureParams.cel.halftone} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('textureParams.cel.halftone')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('textureParams.cel.halftone');
                }}
                title="Click to lock/unlock for randomize"
              >
                Halftone
              </button>
            </label>
          {/if}
        {/if}
         <label class="control-row">
           <button type="button" class="setting-title" class:locked={isLocked('backgroundColor')} onclick={() => toggleLock('backgroundColor')} title="Click to lock/unlock for randomize">Background</button>
           <input type="color" bind:value={config.backgroundColor} />
         </label>
       </section>

      <!-- Emission -->
      {#if showEmissionSection}
        <section class="control-section">
          <h3>Emission</h3>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.emission.enabled} />
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('emission.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('emission.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Enable
            </button>
          </label>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('emission.paletteIndex')} onclick={() => toggleLock('emission.paletteIndex')} title="Click to lock/unlock for randomize">Palette Index</button>
            <select bind:value={config.emission.paletteIndex} disabled={!config.emission.enabled}>
              {#each config.colors as c, i}
                <option value={i}>{i}: {c}</option>
              {/each}
            </select>
          </label>

          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('emission.intensity')} onclick={() => toggleLock('emission.intensity')} title="Click to lock/unlock for randomize">Intensity: {config.emission.intensity.toFixed(2)}</button>
            <input type="range" bind:value={config.emission.intensity} min="0" max="20" step="0.05" disabled={!config.emission.enabled} />
          </label>
        </section>
      {/if}

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
       
      {#if is3DType}
        <!-- Camera View -->
        <section class="control-section">
          <details class="control-details">
            <summary class="control-details-summary">Camera</summary>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('camera.azimuth')} onclick={() => toggleLock('camera.azimuth')} title="Click to lock/unlock for randomize">Azimuth: {config.camera.azimuth}°</button>
              <input type="range" bind:value={config.camera.azimuth} min="0" max="360" step="5" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('camera.elevation')} onclick={() => toggleLock('camera.elevation')} title="Click to lock/unlock for randomize">Elevation: {config.camera.elevation}°</button>
              <input type="range" bind:value={config.camera.elevation} min="-80" max="80" step="5" />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('camera.distance')} onclick={() => toggleLock('camera.distance')} title="Click to lock/unlock for randomize">Distance: {config.camera.distance.toFixed(1)}</button>
              <input type="range" bind:value={config.camera.distance} min="5" max="50" step="0.1" />
            </label>
          </details>
        </section>
      {/if}
      
      {#if is3DType}
      <!-- Lighting -->
      <section class="control-section">
        <h3>Lighting</h3>
        <label class="control-row checkbox">
          <input type="checkbox" bind:checked={config.lighting.enabled} />
          <button
            type="button"
            class="setting-title"
            class:locked={isLocked('lighting.enabled')}
            onclick={(e) => {
              e.preventDefault();
              toggleLock('lighting.enabled');
            }}
            title="Click to lock/unlock for randomize"
          >
            Enable Lighting
          </button>
        </label>
        {#if config.lighting.enabled}
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('lighting.intensity')} onclick={() => toggleLock('lighting.intensity')} title="Click to lock/unlock for randomize">Intensity: {config.lighting.intensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.intensity} min="0" max="3" step="0.1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('lighting.position.x')} onclick={() => toggleLock('lighting.position.x')} title="Click to lock/unlock for randomize">Position X: {config.lighting.position.x}</button>
            <input type="range" bind:value={config.lighting.position.x} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('lighting.position.y')} onclick={() => toggleLock('lighting.position.y')} title="Click to lock/unlock for randomize">Position Y: {config.lighting.position.y}</button>
            <input type="range" bind:value={config.lighting.position.y} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('lighting.position.z')} onclick={() => toggleLock('lighting.position.z')} title="Click to lock/unlock for randomize">Position Z: {config.lighting.position.z}</button>
            <input type="range" bind:value={config.lighting.position.z} min="0" max="20" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('lighting.ambientIntensity')} onclick={() => toggleLock('lighting.ambientIntensity')} title="Click to lock/unlock for randomize">Ambient: {config.lighting.ambientIntensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.ambientIntensity} min="0" max="1" step="0.1" />
          </label>
        {/if}
      </section>
      {/if}

      <!-- Render -->
      <section class="control-section">
        <h3>Render</h3>

        {#if is3DType}
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('rendering.exposure')} onclick={() => toggleLock('rendering.exposure')} title="Click to lock/unlock for randomize">Exposure: {config.rendering.exposure.toFixed(2)}</button>
            <input type="range" bind:value={config.rendering.exposure} min="0.3" max="2.5" step="0.01" />
          </label>

          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('rendering.toneMapping')} onclick={() => toggleLock('rendering.toneMapping')} title="Click to lock/unlock for randomize">Tone Mapping</button>
            <select bind:value={config.rendering.toneMapping}>
              <option value="aces">ACES</option>
              <option value="none">None</option>
            </select>
          </label>

          <label class="control-row">
            <span class="setting-title">Mode</span>
            <select bind:value={renderMode} title="Raster is instant; Path traced refines progressively">
              <option value="raster">Raster</option>
              <option value="path" disabled={config.type !== 'popsicle' || config.texture === 'cel' || config.facades.outline.enabled || config.bloom.enabled}>Path traced</option>
            </select>
          </label>
        {/if}

        {#if supportsBloom}
          <details class="control-details">
            <summary class="control-details-summary">Bloom</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.bloom.enabled} />
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('bloom.enabled')}
                onclick={(e) => {
                  e.preventDefault();
                  toggleLock('bloom.enabled');
                }}
                title="Click to lock/unlock for randomize"
              >
                Enable bloom
              </button>
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bloom.strength')} onclick={() => toggleLock('bloom.strength')} title="Click to lock/unlock for randomize">Strength: {config.bloom.strength.toFixed(2)}</button>
              <input type="range" bind:value={config.bloom.strength} min="0" max="3" step="0.01" disabled={!config.bloom.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bloom.radius')} onclick={() => toggleLock('bloom.radius')} title="Click to lock/unlock for randomize">Radius: {config.bloom.radius.toFixed(2)}</button>
              <input type="range" bind:value={config.bloom.radius} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('bloom.threshold')} onclick={() => toggleLock('bloom.threshold')} title="Click to lock/unlock for randomize">Threshold: {config.bloom.threshold.toFixed(2)}</button>
              <input type="range" bind:value={config.bloom.threshold} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
            </label>
          </details>
        {/if}

        {#if is3DType}
        <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.environment.enabled} />
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('environment.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('environment.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Environment (Reflections)
            </button>
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('environment.intensity')} onclick={() => toggleLock('environment.intensity')} title="Click to lock/unlock for randomize">Env Intensity: {config.environment.intensity.toFixed(2)}</button>
            <input type="range" bind:value={config.environment.intensity} min="0" max="5" step="0.01" disabled={!config.environment.enabled} />
          </label>

          {#if config.texture !== 'matte'}
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('environment.rotation')} onclick={() => toggleLock('environment.rotation')} title="Click to lock/unlock for randomize">Env Rotation: {config.environment.rotation.toFixed(0)}°</button>
              <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
            </label>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('environment.style')} onclick={() => toggleLock('environment.style')} title="Click to lock/unlock for randomize">Env Style</button>
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
                <button type="button" class="setting-title" class:locked={isLocked('environment.rotation')} onclick={() => toggleLock('environment.rotation')} title="Click to lock/unlock for randomize">Env Rotation: {config.environment.rotation.toFixed(0)}°</button>
                <input type="range" bind:value={config.environment.rotation} min="0" max="360" step="1" disabled={!config.environment.enabled} />
              </label>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('environment.style')} onclick={() => toggleLock('environment.style')} title="Click to lock/unlock for randomize">Env Style</button>
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
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('shadows.enabled')}
              onclick={(e) => {
                e.preventDefault();
                toggleLock('shadows.enabled');
              }}
              title="Click to lock/unlock for randomize"
            >
              Shadows
            </button>
          </label>
          <label class="control-row">
            <button type="button" class="setting-title" class:locked={isLocked('shadows.type')} onclick={() => toggleLock('shadows.type')} title="Click to lock/unlock for randomize">Shadow Type</button>
            <select bind:value={config.shadows.type} disabled={!config.shadows.enabled}>
              <option value="pcfsoft">PCF Soft</option>
              <option value="vsm">VSM</option>
            </select>
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={isLocked('shadows.mapSize')} onclick={() => toggleLock('shadows.mapSize')} title="Click to lock/unlock for randomize">Shadow Map: {config.shadows.mapSize}</button>
            <input type="range" bind:value={config.shadows.mapSize} min="256" max="4096" step="256" disabled={!config.shadows.enabled} />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Shadow tuning</summary>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('shadows.normalBias')} onclick={() => toggleLock('shadows.normalBias')} title="Click to lock/unlock for randomize">Normal Bias: {config.shadows.normalBias.toFixed(3)}</button>
              <input type="range" bind:value={config.shadows.normalBias} min="0" max="0.2" step="0.001" disabled={!config.shadows.enabled} />
            </label>
            <label class="control-row slider">
              <button type="button" class="setting-title" class:locked={isLocked('shadows.bias')} onclick={() => toggleLock('shadows.bias')} title="Click to lock/unlock for randomize">Shadow Bias: {config.shadows.bias.toFixed(5)}</button>
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

        {/if}
      </section>

      {#if supportsCollisions}
        <section class="control-section">
          <h3>Collisions</h3>
            <label class="control-row">
              <button type="button" class="setting-title" class:locked={isLocked('collisions.mode')} onclick={() => toggleLock('collisions.mode')} title="Click to lock/unlock for randomize">Mode</button>
              <select bind:value={config.collisions.mode} disabled={config.colors.length > 8}>
                <option value="none">None</option>
                <option value="carve">Carve</option>
              </select>
            </label>

            {#if config.colors.length > 8}
              <div style="font-size: 0.75rem; color: #a9a9b3; line-height: 1.2;">
                Collision masking is disabled when the palette has more than 8 colors.
              </div>
            {/if}

            {#if config.collisions.mode === 'carve' && config.colors.length <= 8}
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.direction')} onclick={() => toggleLock('collisions.carve.direction')} title="Click to lock/unlock for randomize">Direction</button>
                <select bind:value={config.collisions.carve.direction}>
                  <option value="oneWay">One-way</option>
                  <option value="twoWay">Two-way</option>
                </select>
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.marginPx')} onclick={() => toggleLock('collisions.carve.marginPx')} title="Click to lock/unlock for randomize">Margin: {Math.round(config.collisions.carve.marginPx)}px</button>
                <input
                  type="range"
                  bind:value={config.collisions.carve.marginPx}
                  min="0"
                  max="400"
                  step="1"
                  onpointerdown={() => {
                    collisionDragActive = true;
                    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
                  }}
                  onpointerup={() => {
                    collisionDragActive = false;
                    schedulePreviewRender();
                  }}
                  onpointercancel={() => {
                    collisionDragActive = false;
                    schedulePreviewRender();
                  }}
                />
              </label>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.marginPx')} onclick={() => toggleLock('collisions.carve.marginPx')} title="Click to lock/unlock for randomize">Margin (exact)</button>
                <input type="number" bind:value={config.collisions.carve.marginPx} min="0" max="2000" step="1" />
              </label>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.edge')} onclick={() => toggleLock('collisions.carve.edge')} title="Click to lock/unlock for randomize">Edge</button>
                <select bind:value={config.collisions.carve.edge}>
                  <option value="hard">Hard</option>
                  <option value="soft">Soft</option>
                </select>
              </label>
              <label class="control-row slider">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.featherPx')} onclick={() => toggleLock('collisions.carve.featherPx')} title="Click to lock/unlock for randomize">Feather: {Math.round(config.collisions.carve.featherPx)}px</button>
                <input
                  type="range"
                  bind:value={config.collisions.carve.featherPx}
                  min="0"
                  max="200"
                  step="1"
                  disabled={config.collisions.carve.edge !== 'soft'}
                  onpointerdown={() => {
                    collisionDragActive = true;
                    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
                  }}
                  onpointerup={() => {
                    collisionDragActive = false;
                    schedulePreviewRender();
                  }}
                  onpointercancel={() => {
                    collisionDragActive = false;
                    schedulePreviewRender();
                  }}
                />
              </label>
              <label class="control-row">
                <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.featherPx')} onclick={() => toggleLock('collisions.carve.featherPx')} title="Click to lock/unlock for randomize">Feather (exact)</button>
                <input
                  type="number"
                  bind:value={config.collisions.carve.featherPx}
                  min="0"
                  max="2000"
                  step="1"
                  disabled={config.collisions.carve.edge !== 'soft'}
                />
              </label>

              {#if is3DType}
                <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
                  <label class="control-row">
                    <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.finish')} onclick={() => toggleLock('collisions.carve.finish')} title="Click to lock/unlock for randomize">Finish Volume</button>
                    <select bind:value={config.collisions.carve.finish}>
                      <option value="none">None</option>
                      <option value="wallsCap">Walls + Cap</option>
                    </select>
                  </label>

                  {#if config.collisions.carve.finish === 'wallsCap'}
                    <label class="control-row slider">
                      <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.finishAutoDepthMult')} onclick={() => toggleLock('collisions.carve.finishAutoDepthMult')} title="Click to lock/unlock for randomize">Depth (auto): {config.collisions.carve.finishAutoDepthMult.toFixed(2)}x</button>
                      <input type="range" bind:value={config.collisions.carve.finishAutoDepthMult} min="0" max="4" step="0.05" />
                    </label>
                    <label class="control-row">
                      <button type="button" class="setting-title" class:locked={isLocked('collisions.carve.finishAutoDepthMult')} onclick={() => toggleLock('collisions.carve.finishAutoDepthMult')} title="Click to lock/unlock for randomize">Depth (auto, exact)</button>
                      <input type="number" bind:value={config.collisions.carve.finishAutoDepthMult} min="0" max="20" step="0.05" />
                    </label>
                  {/if}
                </div>
              {/if}
              <div style="font-size: 0.75rem; color: #a9a9b3; line-height: 1.2;">
                One-way priority is based on palette weights: higher weight carves lower.
              </div>
            {/if}
        </section>
      {/if}

      <section class="control-section">
        <h3>CLI</h3>
        <div class="cli-controls">
          <textarea class="cli-text" readonly rows={cliViewMode === 'json' ? 10 : 4}>{cliCommand}</textarea>
          <div class="cli-buttons">
            <button
              class="cli-toggle"
              onclick={() => {
                cliViewMode = cliViewMode === 'bash' ? 'json' : 'bash';
              }}
              title={cliViewMode === 'bash' ? 'Show raw JSON' : 'Show bash command'}
            >
              {cliViewMode === 'bash' ? 'JSON' : 'Bash'}
            </button>
            <button class="cli-copy" onclick={copyCliCommand}>Copy</button>
          </div>
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
    </div>
  </aside>
  
  <main class="preview-area">
    <div
      bind:this={canvasContainer}
      class="canvas-container"
      role="application"
      aria-label="Preview canvas"
      style={`background: ${config.backgroundColor}`}
      onmouseenter={() => {
        canvasHoverActive = true;
      }}
      onmouseleave={() => {
        canvasHoverActive = false;
      }}
      onpointerdown={handleCanvasPointerDown}
      onpointermove={handleCanvasPointerMove}
      onpointerup={handleCanvasPointerUp}
      onpointercancel={handleCanvasPointerUp}
      onwheel={handleCanvasWheel}
    >
      <div bind:this={canvasHost} class="canvas-host"></div>

      {#if is3DType}
        <div class="camera-overlay" class:visible={canvasHoverActive || cameraDragActive} aria-hidden={!(canvasHoverActive || cameraDragActive)}>
          <div class="camera-overlay-row">
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('elevation', +1, e)} title="Tilt up (Shift = 10x)">Up</button>
          </div>
          <div class="camera-overlay-row">
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('azimuth', -1, e)} title="Rotate left (Shift = 10x)">Left</button>
            <button type="button" class="camera-btn" onclick={() => resetCamera()} title="Reset camera">Reset</button>
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('azimuth', +1, e)} title="Rotate right (Shift = 10x)">Right</button>
          </div>
          <div class="camera-overlay-row">
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('elevation', -1, e)} title="Tilt down (Shift = 10x)">Down</button>
          </div>
          <div class="camera-overlay-row camera-overlay-zoom">
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('distance', -0.2, e)} title="Zoom in (Shift = 10x)">+</button>
            <button type="button" class="camera-btn" onclick={(e) => nudgeCamera('distance', +0.2, e)} title="Zoom out (Shift = 10x)">-</button>
          </div>
          <div class="camera-overlay-hint">Drag to orbit, wheel to zoom</div>
        </div>
      {/if}
    </div>
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

  .error-box {
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.35);
    color: #fecaca;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.25;
    white-space: pre-wrap;
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

  .cli-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cli-toggle {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #1a1a24;
    color: #d7d7e3;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .cli-toggle:hover {
    background: #2a2a36;
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

  .palette-overrides {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .palette-override-item {
    border: 1px solid #252530;
    border-radius: 8px;
    background: #141420;
    padding: 0.25rem 0.5rem;
  }

  .palette-override-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .palette-override-summary .swatch {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
    color: #cbd5e1;
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
    position: relative;
    overflow: hidden;
  }

  .canvas-host {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .canvas-container :global(canvas) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    touch-action: none;
  }

  .camera-overlay {
    position: absolute;
    right: 14px;
    bottom: 14px;
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(10, 10, 15, 0.72);
    backdrop-filter: blur(10px);
    opacity: 0;
    transform: translateY(6px);
    pointer-events: none;
    transition: opacity 140ms ease, transform 160ms ease;
    user-select: none;
  }

  .camera-overlay.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .camera-overlay-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .camera-overlay-zoom {
    justify-content: space-between;
  }

  .camera-btn {
    min-width: 72px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .camera-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .camera-btn:active {
    background: rgba(255, 255, 255, 0.16);
  }

  .camera-overlay-hint {
    font-size: 0.72rem;
    opacity: 0.78;
    text-align: center;
  }

  @media (hover: none) {
    .camera-overlay {
      opacity: 1;
      transform: none;
      pointer-events: auto;
    }
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
