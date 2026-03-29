<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/ui/styles/app.css';
  import { 
    DEFAULT_CONFIG, 
    DEFAULT_CONFIG_BY_TYPE,
    type WallpaperConfig,
    type WallpaperType,
    RESOLUTION_PRESETS,
    generateRandomConfigNoPresets,
    generateRandomConfigNoPresetsFromSeed,
    normalizeWallpaperConfig,
    exportToPNG,
    exportToJPG,
    exportToWebP,
    exportToSVG,
    downloadFile,
    renderWallpaperToCanvas,
    type WallpaperAppStateV1
  } from '@wallpaper-maker/core';

  import { PopsiclePreview, type PreviewRenderMode } from '$lib/popsicle/preview';
  import { Basic3DPreview, type Basic3DType } from '$lib/basic3d/preview';

  type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

  import { COLOR_PRESETS, COLOR_PRESET_GROUPS, type ColorPreset } from '$lib/color-presets';

  import GeneratorSection from '$lib/ui/inspector/GeneratorSection.svelte';

  import ColorsSection from '$lib/ui/sections/ColorsSection.svelte';
  import RandomizeSection from '$lib/ui/sections/RandomizeSection.svelte';
  import TypeSection from '$lib/ui/sections/TypeSection.svelte';
  import AppearanceSection from '$lib/ui/sections/AppearanceSection.svelte';
  import EmissionSection from '$lib/ui/sections/EmissionSection.svelte';
  import CameraSection from '$lib/ui/sections/CameraSection.svelte';
  import LightingSection from '$lib/ui/sections/LightingSection.svelte';
  import RenderSection from '$lib/ui/sections/RenderSection.svelte';
  import CollisionsSection from '$lib/ui/sections/CollisionsSection.svelte';
  import CliSection from '$lib/ui/sections/CliSection.svelte';
  import ResolutionSection from '$lib/ui/sections/ResolutionSection.svelte';
  import ExportSection from '$lib/ui/sections/ExportSection.svelte';

  import { cloneDefaultConfig } from '$lib/app/config/config';
  import {
    mergeWithLocks as mergeWithLocksImpl,
    isLocked as isLockedImpl,
    toggleLock as toggleLockImpl,
    type LockMap
  } from '$lib/app/config/locks';
  import { buildAppState, decodeCfgParam, encodeCfgParam, getCfgParamFromSearch, scheduleReplaceCfgInUrl, shouldSkipUrlUpdate } from '$lib/app/url/cfg';
  import { createPreviewScheduler } from '$lib/app/preview/scheduler';
  import {
    disposeBasic3DPreview as disposeBasic3DPreviewImpl,
    renderCurrentOnce as renderCurrentOnceImpl,
    type FallbackQuality,
    type PreviewRefs,
    type PreviewRendererCtx
  } from '$lib/app/preview/renderers';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>(cloneDefaultConfig());
  
  let canvasContainer: HTMLDivElement | null = null;
  let canvasHost: HTMLDivElement | null = null;

  const previewRefs: PreviewRefs = {
    preview: null,
    basic3dPreview: null,
    fallbackCanvas: null
  };
  let renderMode = $state<PreviewRenderMode>('raster');

  // Friendly generator errors (e.g. invalid SVG input).
  let renderError = $state<string | null>(null);

  let collisionDragActive = $state(false);
  let cameraDragActive = $state(false);
  let canvasHoverActive = $state(false);

  const RENDER_SETTLE_MS = 280;
  
  // Export format selection
  let exportFormat = $state<'png' | 'jpg' | 'webp' | 'svg'>('png');
  let isExporting = $state(false);
  
  // URL sync + CLI preview
  let urlSyncEnabled = $state(false);
  let cliCommand = $state('');
  let cliViewMode = $state<'bash' | 'json'>('bash');

  // SVG icon picker UI moved to $lib/icons/IconPicker.svelte

  function randomSeedU32(): number {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return (a[0] >>> 0) || 1;
    } catch {
      return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    }
  }

  // UI-only: locks are not synced to URL.
  let locks = $state<LockMap>({});

  function isLocked(path: string): boolean {
    return isLockedImpl(locks, path);
  }

  function toggleLock(path: string) {
    locks = toggleLockImpl(locks, path);
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
  let supportsBloom = $derived(
    config.type !== 'hexgrid2d' &&
      config.type !== 'ridges2d' &&
      config.type !== 'bands2d' &&
      config.type !== 'flowlines2d' &&
      config.type !== 'diamondgrid2d'
  );
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

  const previewRendererCtx: PreviewRendererCtx = {
    getConfig: () => config,
    getRenderMode: () => renderMode,
    setRenderError: (msg) => {
      renderError = msg;
    },
    canvasContainer: () => canvasContainer,
    canvasHost: () => canvasHost,
    refs: previewRefs
  };

  function disposeBasic3DPreview() {
    disposeBasic3DPreviewImpl(previewRefs);
  }

  function renderCurrentOnce(quality: FallbackQuality, opts?: { cameraOnly?: boolean }) {
    renderCurrentOnceImpl(previewRendererCtx, quality, opts);
  }

  const previewScheduler = createPreviewScheduler({
    renderCurrentOnce,
    getCollisionDragActive: () => collisionDragActive,
    getCameraDragActive: () => cameraDragActive,
    settleMs: RENDER_SETTLE_MS
  });

  function schedulePreviewRender() {
    previewScheduler.schedulePreviewRender();
  }

  function clearPreviewSettleTimer() {
    previewScheduler.clearSettleTimer();
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
    clearPreviewSettleTimer();

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

  function togglePaletteBlock(paletteIndex: number, block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi') {
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

      if (block === 'bubbles') {
        if (next.bubbles) {
          delete next.bubbles;
        } else {
          next.bubbles = { ...(config as any).bubbles };
        }
      }

      if (block === 'voronoi') {
        if (next.voronoi) {
          delete next.voronoi;
        } else {
          next.voronoi = { ...(config as any).voronoi, nucleus: { ...((config as any).voronoi?.nucleus ?? { enabled: false }) } };
        }
      }

      return next;
    });
  }

  function mergeWithLocks(next: WallpaperConfig): WallpaperConfig {
    return mergeWithLocksImpl(config, next, locks);
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

    const voronoi = {
      ...((src as any).voronoi ?? {}),
      nucleus: { ...(((src as any).voronoi?.nucleus ?? { enabled: false }) as any) }
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
          voronoi,
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
          voronoi,
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
      case 'bands2d':
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
          voronoi,
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
          bands: {
            ...src.bands,
            panel: {
              ...src.bands.panel,
              rectFrac: { ...src.bands.panel.rectFrac },
              fill: { ...src.bands.panel.fill }
            },
            fill: { ...src.bands.fill },
            stroke: { ...src.bands.stroke },
            waves: { ...src.bands.waves },
            chevron: { ...src.bands.chevron },
            colorWeights: [...(src.bands.colorWeights ?? [])]
          }
        };
      case 'flowlines2d':
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
          voronoi,
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
          flowlines: {
            ...src.flowlines,
            stroke: { ...src.flowlines.stroke },
            colorWeights: [...(src.flowlines.colorWeights ?? [])]
          }
        };
      case 'diamondgrid2d':
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
          voronoi,
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
          diamondgrid: {
            ...src.diamondgrid,
            originPx: { ...src.diamondgrid.originPx },
            stroke: { ...src.diamondgrid.stroke },
            coloring: { ...src.diamondgrid.coloring, colorWeights: [...(src.diamondgrid.coloring.colorWeights ?? [])] },
            bevel: { ...src.diamondgrid.bevel },
            sparkles: { ...src.diamondgrid.sparkles }
          }
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
          voronoi,
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
          voronoi,
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
            grid: { ...src.polygons.grid },
            star: { ...src.polygons.star },
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
          voronoi,
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
          voronoi,
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
          voronoi,
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
        return ({
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
          voronoi,
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
          svg: ({
            ...(src as any).svg,
            stroke: { ...(src as any).svg?.stroke },
            bevel: { ...(src as any).svg?.bevel },
            colorWeights: [...((src as any).svg?.colorWeights ?? [])]
          } as any)
        } as any);
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
    (next as any).voronoi = {
      ...((current as any).voronoi ?? {}),
      nucleus: { ...(((current as any).voronoi?.nucleus ?? { enabled: false }) as any) }
    };
    next.facades = {
      side: { ...current.facades.side },
      grazing: { ...current.facades.grazing },
      outline: { ...current.facades.outline }
    };
    next.edge = { ...current.edge, seam: { ...current.edge.seam }, band: { ...current.edge.band } };
    (next as any).bubbles = { ...(current as any).bubbles, interior: { ...((current as any).bubbles?.interior ?? { enabled: true }) } };
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

  type WeightTarget = 'spheres' | 'circles' | 'polygons' | 'triangles2d' | 'prisms' | 'hexgrid' | 'ridges' | 'svg' | 'bands' | 'flowlines' | 'diamondgrid';

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
    if (target === 'bands' && config.type === 'bands2d') config.bands.colorWeights = w;
    if (target === 'flowlines' && config.type === 'flowlines2d') config.flowlines.colorWeights = w;
    if (target === 'diamondgrid' && config.type === 'diamondgrid2d') config.diamondgrid.coloring.colorWeights = w;
  }

  function setRandomWeights(target: WeightTarget) {
    const n = Math.max(0, config.colors.length);
    const seed = (config.seed >>> 0) || 1;
    const hashU32 = (x: number) => {
      x >>>= 0;
      x ^= x >>> 16;
      x = Math.imul(x, 0x7feb352d);
      x ^= x >>> 15;
      x = Math.imul(x, 0x846ca68b);
      x ^= x >>> 16;
      return x >>> 0;
    };
    const rand01 = (i: number) => {
      const x = (seed ^ hashU32(i * 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
      return (hashU32(x) >>> 0) / 4294967296;
    };
    const w = Array.from({ length: n }, (_, i) => Number(Math.max(0.01, rand01(i)).toFixed(3)));

    if (target === 'spheres' && config.type === 'spheres3d') config.spheres.colorWeights = w;
    if (target === 'circles' && config.type === 'circles2d') config.circles.colorWeights = w;
    if (target === 'polygons' && config.type === 'polygon2d') config.polygons.colorWeights = w;
    if (target === 'triangles2d' && config.type === 'triangles2d') config.triangles.colorWeights = w;
    if (target === 'prisms' && config.type === 'triangles3d') config.prisms.colorWeights = w;
    if (target === 'hexgrid' && config.type === 'hexgrid2d') config.hexgrid.coloring.weights = w;
    if (target === 'ridges' && config.type === 'ridges2d') config.ridges.colorWeights = w;
    if (target === 'svg' && (config.type === 'svg2d' || config.type === 'svg3d')) config.svg.colorWeights = w;
    if (target === 'bands' && config.type === 'bands2d') config.bands.colorWeights = w;
    if (target === 'flowlines' && config.type === 'flowlines2d') config.flowlines.colorWeights = w;
    if (target === 'diamondgrid' && config.type === 'diamondgrid2d') config.diamondgrid.coloring.colorWeights = w;
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

    if (target === 'bands' && config.type === 'bands2d') {
      const a = [...(config.bands.colorWeights ?? [])];
      a[i] = v;
      config.bands.colorWeights = a;
    }

    if (target === 'flowlines' && config.type === 'flowlines2d') {
      const a = [...(config.flowlines.colorWeights ?? [])];
      a[i] = v;
      config.flowlines.colorWeights = a;
    }

    if (target === 'diamondgrid' && config.type === 'diamondgrid2d') {
      const a = [...(config.diamondgrid.coloring.colorWeights ?? [])];
      a[i] = v;
      config.diamondgrid.coloring.colorWeights = a;
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
    const types: WallpaperType[] = [
      'popsicle',
      'spheres3d',
      'svg3d',
      'bands2d',
      'flowlines2d',
      'diamondgrid2d',
      'circles2d',
      'polygon2d',
      'svg2d',
      'triangles2d',
      'ridges2d',
      'triangles3d',
      'hexgrid2d'
    ];
    const currentType = config.type;
    let nextType = types[seed % types.length] ?? 'popsicle';
    if (types.length > 1 && nextType === currentType) {
      nextType = types[(types.indexOf(nextType) + 1) % types.length] ?? nextType;
    }
    config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, nextType));
    schedulePreviewRender();
  }

  function getAppState(): WallpaperAppStateV1 {
    return buildAppState({ config, exportFormat, renderMode });
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

    const cfg = encodeCfgParam(getAppState());
    const url = new URL(window.location.href);
    if (shouldSkipUrlUpdate(url, cfg)) return;

    // Debounce URL updates to avoid spamming history.
    return scheduleReplaceCfgInUrl(cfg, { debounceMs: 120 });
  });

  $effect(() => {
    if (!urlSyncEnabled) return;
    if (!canvasContainer) return;
    if (!canvasHost) return;
    void config.type;

    if (config.type === 'popsicle') {
      if (!previewRefs.preview) {
        disposeBasic3DPreview();
        previewRefs.fallbackCanvas = null;
        canvasHost.innerHTML = '';
        previewRefs.preview = new PopsiclePreview(canvasHost);
        previewRefs.preview.setMode(renderMode);
      }
      return;
    }

    if (previewRefs.preview) {
      previewRefs.preview.dispose();
      previewRefs.preview = null;
    }
    previewRefs.fallbackCanvas = null;
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
          void o.voronoi?.enabled;
          void o.voronoi?.space;
          void o.voronoi?.kind;
          void o.voronoi?.scale;
          void o.voronoi?.seedOffset;
          void o.voronoi?.amount;
          void o.voronoi?.edgeWidth;
          void o.voronoi?.softness;
          void o.voronoi?.colorStrength;
          void o.voronoi?.colorMode;
          void o.voronoi?.tintColor;
          void o.voronoi?.materialMode;
          void (o.voronoi as any)?.materialKind;
          void o.voronoi?.roughnessStrength;
          void o.voronoi?.normalStrength;
          void o.voronoi?.normalScale;
          void (o.voronoi as any)?.crackleAmount;
          void (o.voronoi as any)?.crackleScale;
          void (o.voronoi as any)?.nucleus?.enabled;
          void (o.voronoi as any)?.nucleus?.size;
          void (o.voronoi as any)?.nucleus?.softness;
          void (o.voronoi as any)?.nucleus?.strength;
          void (o.voronoi as any)?.nucleus?.color;
        }
      }
    }
    void c.texture;
    void c.textureParams.drywall.grainAmount;
    void c.textureParams.drywall.grainScale;
    void c.textureParams.glass.style;
    void c.textureParams.cel.bands;
    void c.textureParams.cel.halftone;
    void (c as any).voronoi?.enabled;
    void (c as any).voronoi?.space;
    void (c as any).voronoi?.kind;
    void (c as any).voronoi?.scale;
    void (c as any).voronoi?.seedOffset;
    void (c as any).voronoi?.amount;
    void (c as any).voronoi?.edgeWidth;
    void (c as any).voronoi?.softness;
    void (c as any).voronoi?.colorStrength;
    void (c as any).voronoi?.colorMode;
    void (c as any).voronoi?.tintColor;
    void (c as any).voronoi?.materialMode;
    void (c as any).voronoi?.materialKind;
    void (c as any).voronoi?.roughnessStrength;
    void (c as any).voronoi?.normalStrength;
    void (c as any).voronoi?.normalScale;
    void (c as any).voronoi?.crackleAmount;
    void (c as any).voronoi?.crackleScale;
    void (c as any).voronoi?.nucleus?.enabled;
    void (c as any).voronoi?.nucleus?.size;
    void (c as any).voronoi?.nucleus?.softness;
    void (c as any).voronoi?.nucleus?.strength;
    void (c as any).voronoi?.nucleus?.color;
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
    void (c as any).bubbles?.mode;
    void (c as any).bubbles?.radiusMin;
    void (c as any).bubbles?.radiusMax;
    void (c as any).bubbles?.softness;
    void (c as any).bubbles?.wallThickness;
    void (c as any).bubbles?.seedOffset;
    void (c as any).bubbles?.interior?.enabled;
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
    if (c.type === 'bands2d') {
      void c.bands.mode;
      void c.bands.seedOffset;
      void c.bands.angleDeg;
      void c.bands.bandWidthPx;
      void c.bands.gapPx;
      void c.bands.offsetPx;
      void c.bands.jitterPx;
      void c.bands.fill.enabled;
      void c.bands.fill.opacity;
      void c.bands.stroke.enabled;
      void c.bands.stroke.widthPx;
      void c.bands.stroke.color;
      void c.bands.stroke.opacity;
      void c.bands.waves.amplitudePx;
      void c.bands.waves.wavelengthPx;
      void c.bands.waves.noiseAmount;
      void c.bands.waves.noiseScale;
      void c.bands.chevron.amplitudePx;
      void c.bands.chevron.wavelengthPx;
      void c.bands.chevron.sharpness;
      void c.bands.chevron.sharedPhase;
      void c.bands.paletteMode;
      void c.bands.colorWeights.join(',');
    }
    if (c.type === 'flowlines2d') {
      void c.flowlines.seedOffset;
      void c.flowlines.frequency;
      void c.flowlines.octaves;
      void c.flowlines.warpAmount;
      void c.flowlines.warpFrequency;
      void c.flowlines.strength;
      void c.flowlines.epsilonPx;
      void c.flowlines.spawn;
      void c.flowlines.density;
      void c.flowlines.spacingPx;
      void c.flowlines.marginPx;
      void c.flowlines.stepPx;
      void c.flowlines.maxSteps;
      void c.flowlines.maxLines;
      void c.flowlines.minLengthPx;
      void c.flowlines.jitter;
      void c.flowlines.stroke.widthPx;
      void c.flowlines.stroke.opacity;
      void c.flowlines.stroke.taper;
      void c.flowlines.paletteMode;
      void c.flowlines.colorWeights.join(',');
      void c.flowlines.colorJitter;
    }
    if (c.type === 'diamondgrid2d') {
      void c.diamondgrid.tileWidthPx;
      void c.diamondgrid.tileHeightPx;
      void c.diamondgrid.marginPx;
      void c.diamondgrid.originPx.x;
      void c.diamondgrid.originPx.y;
      void c.diamondgrid.overscanPx;
      void c.diamondgrid.fillOpacity;
      void c.diamondgrid.stroke.enabled;
      void c.diamondgrid.stroke.widthPx;
      void c.diamondgrid.stroke.color;
      void c.diamondgrid.stroke.opacity;
      void c.diamondgrid.stroke.join;
      void c.diamondgrid.coloring.paletteMode;
      void c.diamondgrid.coloring.colorWeights.join(',');
      void c.diamondgrid.bevel.enabled;
      void c.diamondgrid.bevel.amount;
      void c.diamondgrid.bevel.lightDeg;
      void c.diamondgrid.bevel.variation;
      void c.diamondgrid.sparkles.enabled;
      void c.diamondgrid.sparkles.density;
      void c.diamondgrid.sparkles.countMax;
      void c.diamondgrid.sparkles.sizeMinPx;
      void c.diamondgrid.sparkles.sizeMaxPx;
      void c.diamondgrid.sparkles.opacity;
      void c.diamondgrid.sparkles.color;
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
      void c.polygons.mode;
      void c.polygons.shape;
      void c.polygons.count;
      void c.polygons.edges;
      void c.polygons.rMinPx;
      void c.polygons.rMaxPx;
      void c.polygons.jitter;
      void c.polygons.rotateJitterDeg;
      void c.polygons.grid.kind;
      void c.polygons.grid.cellPx;
      void c.polygons.grid.jitter;
      void c.polygons.star.innerScale;
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
      void (c as any).svg?.renderMode;
      void (c as any).svg?.colorMode;
      void (c as any).svg?.maxTones;
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
      void (c as any).svg?.renderMode;
      void (c as any).svg?.colorMode;
      void (c as any).svg?.maxTones;
      void (c as any).svg?.count;
      void (c as any).svg?.spread;
      void (c as any).svg?.depth;
      void (c as any).svg?.sizeMin;
      void (c as any).svg?.sizeMax;
      void (c as any).svg?.extrudeDepth;
      void (c as any).svg?.stroke?.enabled;
      void (c as any).svg?.stroke?.radius;
      void (c as any).svg?.stroke?.segments;
      void (c as any).svg?.stroke?.opacity;
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
    const supportsPath =
      config.type === 'popsicle' ||
      config.type === 'spheres3d' ||
      config.type === 'triangles3d' ||
      config.type === 'svg3d';
    if (!supportsPath && renderMode === 'path') {
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

    if (config.type === 'hexgrid2d' || config.type === 'ridges2d' || config.type === 'bands2d' || config.type === 'flowlines2d' || config.type === 'diamondgrid2d') {
      if (config.emission.enabled) config.emission.enabled = false;
      if (config.bloom.enabled) config.bloom.enabled = false;
    }
  });

  $effect(() => {
    if (!previewRefs.preview) return;
    if (config.type !== 'popsicle') return;
    previewRefs.preview.setMode(renderMode);
    schedulePreviewRender();
  });

  $effect(() => {
    if (!previewRefs.basic3dPreview) return;
    if (config.type !== 'spheres3d' && config.type !== 'triangles3d' && config.type !== 'svg3d') return;
    previewRefs.basic3dPreview.setMode(renderMode);
    schedulePreviewRender();
  });
  
  onMount(() => {
    const hasUrlParams = window.location.search.length > 0;
    
    try {
      if (hasUrlParams) {
        const cfg = getCfgParamFromSearch(window.location.search);
        if (cfg) {
          const state = decodeCfgParam(cfg);
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

    previewRefs.preview?.dispose();
    previewRefs.preview = null;
    disposeBasic3DPreview();
    previewRefs.fallbackCanvas = null;
    if (canvasHost) canvasHost.innerHTML = '';

    if (config.type === 'popsicle') {
      if (canvasHost) {
        previewRefs.preview = new PopsiclePreview(canvasHost);
        previewRefs.preview.setMode(renderMode);
      }
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
      previewScheduler.dispose();
      previewRefs.preview?.dispose();
      previewRefs.preview = null;
      disposeBasic3DPreview();
      previewRefs.fallbackCanvas = null;
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
      <RandomizeSection {generateRandomGeneratedColors} {generateRandomIncludingType} />

      <TypeSection {config} {switchType} />

      <ColorsSection
        {config}
        {is3DType}
        {supportsEmission}
        {isLocked}
        {toggleLock}
        {colorPresetGroups}
        {selectedColorPreset}
        {cycleColorPreset}
        {applySelectedColorPreset}
        {updateColor}
        {removeColor}
        {addColor}
        {togglePaletteOverride}
        {updatePaletteOverride}
        {togglePaletteBlock}
        bind:selectedColorPresetId
      />

      <AppearanceSection {config} {is3DType} {isLocked} {toggleLock} />

      <EmissionSection {config} {showEmissionSection} {isLocked} {toggleLock} />

      <GeneratorSection
        {config}
        {isLocked}
        {toggleLock}
        {renderError}
        {schedulePreviewRender}
        {setEqualWeights}
        {setRandomWeights}
        {updateWeight}
      />

      <CameraSection {config} {is3DType} {isLocked} {toggleLock} />

      <LightingSection {config} {is3DType} {isLocked} {toggleLock} />

      <RenderSection {config} {is3DType} {supportsBloom} {isLocked} {toggleLock} bind:renderMode />

      <CollisionsSection
        {config}
        {is3DType}
        {supportsCollisions}
        {isLocked}
        {toggleLock}
        {clearPreviewSettleTimer}
        {schedulePreviewRender}
        bind:collisionDragActive
      />

      <CliSection {cliCommand} {copyCliCommand} bind:cliViewMode />

      <ResolutionSection
        {config}
        {RESOLUTION_PRESETS}
        applyResolutionPreset={(preset) => applyResolutionPreset(preset as any)}
      />

      <ExportSection bind:exportFormat {isExporting} {handleExport} />
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
