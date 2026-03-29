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

  import EditorShell from '$lib/ui/layout/EditorShell.svelte';
  import GlobalInspector from '$lib/ui/inspector/GlobalInspector.svelte';
  import LookInspector from '$lib/ui/inspector/LookInspector.svelte';

  import { cloneDefaultConfig } from '$lib/app/config/config';
  import {
    mergeWithLocks as mergeWithLocksImpl,
    isLocked as isLockedImpl,
    toggleLock as toggleLockImpl,
    type LockMap
  } from '$lib/app/config/locks';
  import { buildAppState, decodeCfgParam, encodeCfgParam, getCfgParamFromSearch, scheduleReplaceCfgInUrl, shouldSkipUrlUpdate } from '$lib/app/url/cfg';
  import { createPreviewScheduler } from '$lib/app/preview/scheduler';
  import { cloneConfigDeep } from '$lib/app/editor/cloneConfigDeep';
  import { touchPreviewDeps } from '$lib/app/editor/touchPreviewDeps';
  import {
    addColor as addColorImpl,
    removeColor as removeColorImpl,
    updateColor as updateColorImpl,
    updatePaletteOverride as updatePaletteOverrideImpl,
    togglePaletteOverride as togglePaletteOverrideImpl,
    togglePaletteBlock as togglePaletteBlockImpl
  } from '$lib/app/editor/paletteActions';
  import {
    disposeBasic3DPreview as disposeBasic3DPreviewImpl,
    renderCurrentOnce as renderCurrentOnceImpl,
    type FallbackQuality,
    type PreviewRefs,
    type PreviewRendererCtx
  } from '$lib/app/preview/renderers';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>(cloneDefaultConfig());

  // UI-only: shared search/filter for both inspector columns.
  let inspectorSearch = $state('');
  
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
    config = addColorImpl(config);
    schedulePreviewRender();
  }
  
  function removeColor(index: number) {
    config = removeColorImpl(config, index);
    schedulePreviewRender();
  }
  
  function updateColor(index: number, color: string) {
    config = updateColorImpl(config, index, color);
  }

  function updatePaletteOverride(paletteIndex: number, fn: (cur: any | null) => any | null) {
    config = updatePaletteOverrideImpl(config, paletteIndex, fn);
  }

  function togglePaletteOverride(paletteIndex: number) {
    config = togglePaletteOverrideImpl(config, paletteIndex);
  }

  function togglePaletteBlock(paletteIndex: number, block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi') {
    config = togglePaletteBlockImpl(config, paletteIndex, block);
  }

  function mergeWithLocks(next: WallpaperConfig): WallpaperConfig {
    return mergeWithLocksImpl(config, next, locks);
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
    touchPreviewDeps(config, renderMode, exportFormat);
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

<EditorShell appTitle="ColorWhirl" quickRandomize={generateRandomGeneratedColors} quickExport={handleExport} bind:searchQuery={inspectorSearch}>
  <svelte:fragment slot="left">
    <GlobalInspector
      {config}
      {is3DType}
      {supportsBloom}
      bind:searchQuery={inspectorSearch}
      {schedulePreviewRender}
      {generateRandomGeneratedColors}
      {generateRandomIncludingType}
      {switchType}
      {isLocked}
      {toggleLock}
      {RESOLUTION_PRESETS}
      {applyResolutionPreset}
      {isExporting}
      {handleExport}
      {cliCommand}
      {copyCliCommand}
      bind:cliViewMode
      bind:exportFormat
      bind:renderMode
    />
  </svelte:fragment>

  <svelte:fragment slot="center">
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
  </svelte:fragment>

  <svelte:fragment slot="right">
    <LookInspector
      {config}
      {is3DType}
      {supportsEmission}
      {showEmissionSection}
      {supportsCollisions}
      bind:searchQuery={inspectorSearch}
      {schedulePreviewRender}
      {clearPreviewSettleTimer}
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
      {renderError}
      {setEqualWeights}
      {setRandomWeights}
      {updateWeight}
      bind:selectedColorPresetId
      bind:collisionDragActive
    />
  </svelte:fragment>
</EditorShell>
