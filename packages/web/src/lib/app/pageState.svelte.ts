import { onMount } from 'svelte';
import { readLocalStorageBool, writeLocalStorageBool } from '$lib/ui/prefs/storage';
import {
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
  createPopsicleScene,
  createSpheres3DScene,
  createTriangles3DScene,
  createSvg3DScene,
  type WallpaperAppStateV1
} from '@wallpaper-maker/core';

import { PopsiclePreview, type PreviewRenderMode } from '$lib/popsicle/preview';

import { COLOR_PRESETS, COLOR_PRESET_GROUPS, type ColorPreset } from '$lib/color-presets';

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
  moveColor as moveColorImpl,
  removeColor as removeColorImpl,
  replaceColors as replaceColorsImpl,
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

type WeightTarget = 'spheres' | 'circles' | 'polygons' | 'triangles2d' | 'prisms' | 'hexgrid' | 'ridges' | 'svg' | 'bands' | 'flowlines' | 'diamondgrid';
type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

const RENDER_SETTLE_MS = 280;
const SETTINGS_MAXIMIZED_KEY = 'ui.layout.settingsMaximized';

export type PageState = ReturnType<typeof createPageState>;

export function createPageState() {
  const state = $state({
    config: cloneDefaultConfig() as WallpaperConfig,
    inspectorSearch: '',
    lookColumns: 2 as 1 | 2,
    canvasContainer: null as HTMLDivElement | null,
    canvasHost: null as HTMLDivElement | null,
    renderMode: 'raster' as PreviewRenderMode,
    renderError: null as string | null,
    collisionDragActive: false,
    cameraDragActive: false,
    settingsMaximized: false,
    settingsOverlayVisible: false,
    settingsMaximizedReady: false,
    exportFormat: 'png' as ExportFormat,
    isExporting: false,
    urlSyncEnabled: false,
    cliCommand: '',
    cliViewMode: 'bash' as 'bash' | 'json',
    locks: {} as LockMap,
    selectedColorPresetId: COLOR_PRESETS[0]?.id ?? ''
  });

  let camDragPointerId = -1;

  const previewRefs: PreviewRefs = {
    preview: null,
    basic3dPreview: null,
    fallbackCanvas: null
  };

  const colorPresetGroups: Array<{ group: string; presets: ColorPreset[] }> = COLOR_PRESET_GROUPS
    .map((group) => ({ group, presets: COLOR_PRESETS.filter((p) => p.group === group) }))
    .filter((g) => g.presets.length > 0);

  const selectedColorPreset = $derived(COLOR_PRESETS.find((p) => p.id === state.selectedColorPresetId) ?? null);

  const aspectRatio = $derived(state.config.width / state.config.height);
  const is3DType = $derived(state.config.type === 'popsicle' || state.config.type === 'spheres3d' || state.config.type === 'triangles3d' || state.config.type === 'svg3d');
  const supportsOutlineOnly = $derived(state.config.type === 'spheres3d' || state.config.type === 'triangles3d' || state.config.type === 'svg3d');
  const supportsBloom = $derived(
    state.config.type !== 'hexgrid2d' &&
      state.config.type !== 'ridges2d' &&
      state.config.type !== 'bands2d' &&
      state.config.type !== 'flowlines2d' &&
      state.config.type !== 'diamondgrid2d'
  );
  const supportsCollisions = $derived(
    state.config.type === 'popsicle' ||
      state.config.type === 'circles2d' ||
      state.config.type === 'polygon2d' ||
      state.config.type === 'triangles2d' ||
      state.config.type === 'spheres3d' ||
      state.config.type === 'triangles3d'
  );
  const supportsEmission = $derived(
    state.config.type === 'popsicle' ||
      state.config.type === 'spheres3d' ||
      state.config.type === 'triangles3d' ||
      state.config.type === 'svg3d' ||
      state.config.type === 'circles2d' ||
      state.config.type === 'polygon2d' ||
      state.config.type === 'triangles2d' ||
      state.config.type === 'svg2d'
  );
  const showEmissionSection = $derived(
    supportsEmission && (state.config.type === 'circles2d' || state.config.type === 'polygon2d' || state.config.type === 'triangles2d' || state.config.type === 'svg2d' ? state.config.bloom.enabled : true)
  );

  const previewRendererCtx: PreviewRendererCtx = {
    getConfig: () => state.config,
    getRenderMode: () => state.renderMode,
    setRenderError: (msg) => {
      state.renderError = msg;
    },
    canvasContainer: () => state.canvasContainer,
    canvasHost: () => state.canvasHost,
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
    getCollisionDragActive: () => state.collisionDragActive,
    getCameraDragActive: () => state.cameraDragActive,
    settleMs: RENDER_SETTLE_MS
  });

  function schedulePreviewRender() {
    previewScheduler.schedulePreviewRender();
  }

  function clearPreviewSettleTimer() {
    previewScheduler.clearSettleTimer();
  }

  function randomSeedU32(): number {
    try {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return (a[0] >>> 0) || 1;
    } catch {
      return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    }
  }

  function isLocked(path: string): boolean {
    return isLockedImpl(state.locks, path);
  }

  function toggleLock(path: string) {
    state.locks = toggleLockImpl(state.locks, path);
  }

  function applyColorPreset(preset: ColorPreset) {
    if (preset.colors.length === 0) return;
    const nextColors = [...preset.colors];
    const pAny: any = (state.config as any).palette;
    const curOverrides: any[] = Array.isArray(pAny?.overrides) ? pAny.overrides.slice() : [];
    const nextOverrides = curOverrides.slice(0, nextColors.length);
    while (nextOverrides.length < nextColors.length) nextOverrides.push(null);

    state.config = {
      ...state.config,
      colors: nextColors,
      palette: { ...(pAny && typeof pAny === 'object' ? pAny : {}), overrides: nextOverrides },
      backgroundColor: preset.backgroundColor
    };

    schedulePreviewRender();
  }

  function applySelectedColorPreset() {
    const preset = COLOR_PRESETS.find((p) => p.id === state.selectedColorPresetId);
    if (!preset) return;
    applyColorPreset(preset);
  }

  function cycleColorPreset(delta: number) {
    if (COLOR_PRESETS.length === 0) return;

    const currentIndex = COLOR_PRESETS.findIndex((p) => p.id === state.selectedColorPresetId);
    const base = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (base + delta + COLOR_PRESETS.length) % COLOR_PRESETS.length;
    const next = COLOR_PRESETS[nextIndex];

    state.selectedColorPresetId = next.id;
    applyColorPreset(next);
  }

  async function handleExport() {
    state.isExporting = true;

    try {
      if (state.exportFormat === 'svg') {
        const result = await exportToSVG(state.config);
        const filename = `wallpaper-${Date.now()}.svg`;
        downloadFile(result.data, filename, result.mimeType);
        return;
      }

      const canvas = renderWallpaperToCanvas(state.config);
      let result;

      switch (state.exportFormat) {
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

      const filename = `wallpaper-${Date.now()}.${state.exportFormat}`;
      downloadFile(result.data, filename, result.mimeType);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      state.isExporting = false;
    }
  }

  function applyResolutionPreset(preset: keyof typeof RESOLUTION_PRESETS) {
    const { width, height } = RESOLUTION_PRESETS[preset];
    state.config = { ...state.config, width, height };
    schedulePreviewRender();
  }

  function addColor() {
    state.config = addColorImpl(state.config);
    schedulePreviewRender();
  }

  function removeColor(index: number) {
    state.config = removeColorImpl(state.config, index);
    schedulePreviewRender();
  }

  function moveColor(fromIndex: number, toIndex: number) {
    state.config = moveColorImpl(state.config, fromIndex, toIndex);
    schedulePreviewRender();
  }

  function updateColor(index: number, color: string) {
    state.config = updateColorImpl(state.config, index, color);
  }

  function replaceColors(colors: string[]) {
    state.config = replaceColorsImpl(state.config, colors);
    schedulePreviewRender();
  }

  function updatePaletteOverride(paletteIndex: number, fn: (cur: any | null) => any | null) {
    state.config = updatePaletteOverrideImpl(state.config, paletteIndex, fn);
  }

  function togglePaletteOverride(paletteIndex: number) {
    state.config = togglePaletteOverrideImpl(state.config, paletteIndex);
  }

  function togglePaletteBlock(paletteIndex: number, block: 'emission' | 'texture' | 'grazing' | 'side' | 'outline' | 'edge' | 'geometry' | 'bubbles' | 'voronoi') {
    state.config = togglePaletteBlockImpl(state.config, paletteIndex, block);
  }

  function mergeWithLocks(next: WallpaperConfig): WallpaperConfig {
    return mergeWithLocksImpl(state.config, next, state.locks);
  }

  function switchType(nextType: WallpaperType) {
    if (nextType === state.config.type) return;

    const current = state.config;
    const next = cloneConfigDeep(DEFAULT_CONFIG_BY_TYPE[nextType]);

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

    if ((current as any)?.svg?.source && (next as any)?.svg) {
      try {
        (next as any).svg = { ...(next as any).svg, source: (current as any).svg.source };
      } catch {
        // Ignore.
      }
    }

    state.config = next;
    schedulePreviewRender();
  }

  function setEqualWeights(target: WeightTarget) {
    const n = Math.max(0, state.config.colors.length);
    const w = Array.from({ length: n }, () => 1);

    if (target === 'spheres' && state.config.type === 'spheres3d') state.config.spheres.colorWeights = w;
    if (target === 'circles' && state.config.type === 'circles2d') state.config.circles.colorWeights = w;
    if (target === 'polygons' && state.config.type === 'polygon2d') state.config.polygons.colorWeights = w;
    if (target === 'triangles2d' && state.config.type === 'triangles2d') state.config.triangles.colorWeights = w;
    if (target === 'prisms' && state.config.type === 'triangles3d') state.config.prisms.colorWeights = w;
    if (target === 'hexgrid' && state.config.type === 'hexgrid2d') state.config.hexgrid.coloring.weights = w;
    if (target === 'ridges' && state.config.type === 'ridges2d') state.config.ridges.colorWeights = w;
    if (target === 'svg' && (state.config.type === 'svg2d' || state.config.type === 'svg3d')) state.config.svg.colorWeights = w;
    if (target === 'bands' && state.config.type === 'bands2d') state.config.bands.colorWeights = w;
    if (target === 'flowlines' && state.config.type === 'flowlines2d') state.config.flowlines.colorWeights = w;
    if (target === 'diamondgrid' && state.config.type === 'diamondgrid2d') state.config.diamondgrid.coloring.colorWeights = w;
  }

  function setRandomWeights(target: WeightTarget) {
    const n = Math.max(0, state.config.colors.length);
    const seed = (state.config.seed >>> 0) || 1;
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

    if (target === 'spheres' && state.config.type === 'spheres3d') state.config.spheres.colorWeights = w;
    if (target === 'circles' && state.config.type === 'circles2d') state.config.circles.colorWeights = w;
    if (target === 'polygons' && state.config.type === 'polygon2d') state.config.polygons.colorWeights = w;
    if (target === 'triangles2d' && state.config.type === 'triangles2d') state.config.triangles.colorWeights = w;
    if (target === 'prisms' && state.config.type === 'triangles3d') state.config.prisms.colorWeights = w;
    if (target === 'hexgrid' && state.config.type === 'hexgrid2d') state.config.hexgrid.coloring.weights = w;
    if (target === 'ridges' && state.config.type === 'ridges2d') state.config.ridges.colorWeights = w;
    if (target === 'svg' && (state.config.type === 'svg2d' || state.config.type === 'svg3d')) state.config.svg.colorWeights = w;
    if (target === 'bands' && state.config.type === 'bands2d') state.config.bands.colorWeights = w;
    if (target === 'flowlines' && state.config.type === 'flowlines2d') state.config.flowlines.colorWeights = w;
    if (target === 'diamondgrid' && state.config.type === 'diamondgrid2d') state.config.diamondgrid.coloring.colorWeights = w;
  }

  function updateWeight(target: WeightTarget, index: number, value: number) {
    const i = Math.max(0, Math.floor(index));
    const v = Number.isFinite(value) ? value : 0;

    if (target === 'spheres' && state.config.type === 'spheres3d') {
      const a = [...(state.config.spheres.colorWeights ?? [])];
      a[i] = v;
      state.config.spheres.colorWeights = a;
    }

    if (target === 'circles' && state.config.type === 'circles2d') {
      const a = [...(state.config.circles.colorWeights ?? [])];
      a[i] = v;
      state.config.circles.colorWeights = a;
    }

    if (target === 'polygons' && state.config.type === 'polygon2d') {
      const a = [...(state.config.polygons.colorWeights ?? [])];
      a[i] = v;
      state.config.polygons.colorWeights = a;
    }

    if (target === 'triangles2d' && state.config.type === 'triangles2d') {
      const a = [...(state.config.triangles.colorWeights ?? [])];
      a[i] = v;
      state.config.triangles.colorWeights = a;
    }

    if (target === 'prisms' && state.config.type === 'triangles3d') {
      const a = [...(state.config.prisms.colorWeights ?? [])];
      a[i] = v;
      state.config.prisms.colorWeights = a;
    }

    if (target === 'hexgrid' && state.config.type === 'hexgrid2d') {
      const a = [...(state.config.hexgrid.coloring.weights ?? [])];
      a[i] = v;
      state.config.hexgrid.coloring.weights = a;
    }

    if (target === 'ridges' && state.config.type === 'ridges2d') {
      const a = [...(state.config.ridges.colorWeights ?? [])];
      a[i] = v;
      state.config.ridges.colorWeights = a;
    }

    if (target === 'svg' && (state.config.type === 'svg2d' || state.config.type === 'svg3d')) {
      const a = [...(state.config.svg.colorWeights ?? [])];
      a[i] = v;
      state.config.svg.colorWeights = a;
    }

    if (target === 'bands' && state.config.type === 'bands2d') {
      const a = [...(state.config.bands.colorWeights ?? [])];
      a[i] = v;
      state.config.bands.colorWeights = a;
    }

    if (target === 'flowlines' && state.config.type === 'flowlines2d') {
      const a = [...(state.config.flowlines.colorWeights ?? [])];
      a[i] = v;
      state.config.flowlines.colorWeights = a;
    }

    if (target === 'diamondgrid' && state.config.type === 'diamondgrid2d') {
      const a = [...(state.config.diamondgrid.coloring.colorWeights ?? [])];
      a[i] = v;
      state.config.diamondgrid.coloring.colorWeights = a;
    }
  }

  function generateRandomGeneratedColors() {
    const seed = randomSeedU32();
    state.config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, state.config.type));
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
    const currentType = state.config.type;
    let nextType = types[seed % types.length] ?? 'popsicle';
    if (types.length > 1 && nextType === currentType) {
      nextType = types[(types.indexOf(nextType) + 1) % types.length] ?? nextType;
    }
    state.config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, nextType));
    schedulePreviewRender();
  }

  function getAppState(): WallpaperAppStateV1 {
    return buildAppState({ config: state.config, exportFormat: state.exportFormat, renderMode: state.renderMode });
  }

  function quoteCliArg(value: string): string {
    if (/^[A-Za-z0-9_\-.,#/:]+$/.test(value)) return value;
    return JSON.stringify(value);
  }

  function buildCliCommandString(): string {
    const parts: string[] = [];
    parts.push('pnpm', 'cli', 'generate');
    parts.push('--config', quoteCliArg(JSON.stringify(state.config)));
    return parts.join(' ');
  }

  function buildCliJsonString(): string {
    return JSON.stringify(state.config, null, 2);
  }

  function buildCliWidgetText(): string {
    return state.cliViewMode === 'json' ? buildCliJsonString() : buildCliCommandString();
  }

  async function copyCliCommand() {
    try {
      await navigator.clipboard.writeText(state.cliCommand);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = state.cliCommand;
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

  function toggleLookColumns() {
    state.lookColumns = state.lookColumns === 2 ? 1 : 2;
  }

  function fitManualCamera() {
    const current = state.config;
    if (current.type !== 'popsicle' && current.type !== 'spheres3d' && current.type !== 'triangles3d' && current.type !== 'svg3d') return;

    const source = cloneConfigDeep(current as any) as any;
    source.camera = {
      ...source.camera,
      mode: 'auto',
      panX: 0,
      panY: 0
    };

    let built: { scene: any; camera: any; renderer: any } | null = null;
    try {
      if (current.type === 'popsicle') {
        built = createPopsicleScene(source, { preserveDrawingBuffer: false, pixelRatio: 1 });
      } else if (current.type === 'spheres3d') {
        built = createSpheres3DScene(source, { preserveDrawingBuffer: false, pixelRatio: 1 });
      } else if (current.type === 'triangles3d') {
        built = createTriangles3DScene(source, { preserveDrawingBuffer: false, pixelRatio: 1 });
      } else if (current.type === 'svg3d') {
        built = createSvg3DScene(source, { preserveDrawingBuffer: false, pixelRatio: 1 });
      }
      if (!built) return;

      const fittedDistance = Math.max(0.01, Number(built.camera.position.length()) || 0.01);
      const fittedZoom = Math.max(0.01, Number(built.camera.zoom) || 1);
      const fittedNear = Math.max(0.001, Number(built.camera.near) || 0.001);
      const fittedFar = Math.max(fittedNear + 0.001, Number(built.camera.far) || fittedNear + 1000);

      state.config.camera.mode = 'manual';
      state.config.camera.distance = fittedDistance;
      state.config.camera.zoom = fittedZoom;
      state.config.camera.panX = 0;
      state.config.camera.panY = 0;
      state.config.camera.near = fittedNear;
      state.config.camera.far = fittedFar;

      schedulePreviewRender();
    } catch (err) {
      console.error('Manual fit failed:', err);
    } finally {
      try {
        built?.scene?.userData?.__wmDisposeCollisionMasking?.();
      } catch {
        // Ignore.
      }
      try {
        built?.scene?.userData?.__wmDisposeProceduralEnvironment?.();
      } catch {
        // Ignore.
      }
      try {
        if (built?.scene?.userData) delete built.scene.userData.__wmDisposeProceduralEnvironment;
      } catch {
        // Ignore.
      }
      try {
        built?.renderer?.dispose?.();
      } catch {
        // Ignore.
      }
    }
  }

  $effect(() => {
    void state.cliViewMode;
    state.cliCommand = buildCliWidgetText();
  });

  $effect(() => {
    if (!state.urlSyncEnabled) return;
    if (typeof window === 'undefined') return;

    const cfg = encodeCfgParam(getAppState());
    const url = new URL(window.location.href);
    if (shouldSkipUrlUpdate(url, cfg)) return;

    return scheduleReplaceCfgInUrl(cfg, { debounceMs: 120 });
  });

  $effect(() => {
    if (!state.urlSyncEnabled) return;
    if (!state.canvasContainer) return;
    if (!state.canvasHost) return;
    void state.config.type;

    if (state.config.type === 'popsicle') {
      if (!previewRefs.preview) {
        disposeBasic3DPreview();
        previewRefs.fallbackCanvas = null;
        state.canvasHost.innerHTML = '';
        previewRefs.preview = new PopsiclePreview(state.canvasHost);
        previewRefs.preview.setMode(state.renderMode);
      }
      return;
    }

    if (previewRefs.preview) {
      previewRefs.preview.dispose();
      previewRefs.preview = null;
    }
    previewRefs.fallbackCanvas = null;
    state.renderMode = 'raster';
    renderCurrentOnce('final');
  });

  $effect(() => {
    if (!state.canvasContainer) return;
    touchPreviewDeps(state.config, state.renderMode, state.exportFormat);
    schedulePreviewRender();
  });

  $effect(() => {
    const supportsPath =
      state.config.type === 'popsicle' ||
      state.config.type === 'spheres3d' ||
      state.config.type === 'triangles3d' ||
      state.config.type === 'svg3d';
    if (!supportsPath && state.renderMode === 'path') {
      state.renderMode = 'raster';
    }
  });

  $effect(() => {
    const maxIndex = Math.max(0, state.config.colors.length - 1);
    const next = Math.max(0, Math.min(maxIndex, Math.round(Number(state.config.emission.paletteIndex) || 0)));
    if (state.config.emission.paletteIndex !== next) {
      state.config.emission.paletteIndex = next;
    }
  });

  $effect(() => {
    if (state.config.type === 'circles2d' || state.config.type === 'polygon2d' || state.config.type === 'triangles2d') {
      if (state.config.emission.enabled && !state.config.bloom.enabled) {
        state.config.bloom.enabled = true;
      }
    }

    if (state.config.type === 'hexgrid2d' || state.config.type === 'ridges2d' || state.config.type === 'bands2d' || state.config.type === 'flowlines2d' || state.config.type === 'diamondgrid2d') {
      if (state.config.emission.enabled) state.config.emission.enabled = false;
      if (state.config.bloom.enabled) state.config.bloom.enabled = false;
    }
  });

  $effect(() => {
    if (!previewRefs.preview) return;
    if (state.config.type !== 'popsicle') return;
    previewRefs.preview.setMode(state.renderMode);
    schedulePreviewRender();
  });

  $effect(() => {
    if (!previewRefs.basic3dPreview) return;
    if (state.config.type !== 'spheres3d' && state.config.type !== 'triangles3d' && state.config.type !== 'svg3d') return;
    previewRefs.basic3dPreview.setMode(state.renderMode);
    schedulePreviewRender();
  });

  $effect(() => {
    if (!state.settingsMaximizedReady) return;
    writeLocalStorageBool(SETTINGS_MAXIMIZED_KEY, state.settingsMaximized);
  });

  onMount(() => {
    const storedSettingsMaximized = readLocalStorageBool(SETTINGS_MAXIMIZED_KEY);
    if (storedSettingsMaximized !== null) state.settingsMaximized = storedSettingsMaximized;
    state.settingsMaximizedReady = true;
    const hasUrlParams = window.location.search.length > 0;

    try {
      if (hasUrlParams) {
        const cfg = getCfgParamFromSearch(window.location.search);
        if (cfg) {
          const stateFromUrl = decodeCfgParam(cfg);
          state.config = normalizeWallpaperConfig(stateFromUrl.c as any);
          state.exportFormat = stateFromUrl.f;
          state.renderMode = stateFromUrl.m;
        } else {
          state.config = generateRandomConfigNoPresets();
        }
      } else {
        state.config = generateRandomConfigNoPresets();
      }
    } catch {
      state.config = generateRandomConfigNoPresets();
    }

    state.urlSyncEnabled = true;

    previewRefs.preview?.dispose();
    previewRefs.preview = null;
    disposeBasic3DPreview();
    previewRefs.fallbackCanvas = null;
    if (state.canvasHost) state.canvasHost.innerHTML = '';

    if (state.config.type === 'popsicle') {
      if (state.canvasHost) {
        previewRefs.preview = new PopsiclePreview(state.canvasHost);
        previewRefs.preview.setMode(state.renderMode);
      }
    } else {
      state.renderMode = 'raster';
      renderCurrentOnce('final');
    }

    schedulePreviewRender();

    const resizeObserver = new ResizeObserver(() => {
      schedulePreviewRender();
    });

    const handleGlobalPointerUp = () => {
      let changed = false;

      if (state.cameraDragActive) {
        state.cameraDragActive = false;
        camDragPointerId = -1;
        changed = true;
      }

      if (state.collisionDragActive) {
        state.collisionDragActive = false;
        changed = true;
      }

      if (changed) schedulePreviewRender();
    };

    const handleGlobalBlur = () => {
      handleGlobalPointerUp();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { passive: true });
    window.addEventListener('blur', handleGlobalBlur);

    if (state.canvasContainer) {
      resizeObserver.observe(state.canvasContainer);
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
      if (state.canvasHost) state.canvasHost.innerHTML = '';
    };
  });

  return {
    state,
    colorPresetGroups,
    get selectedColorPreset() {
      return selectedColorPreset;
    },
    derived: {
      get aspectRatio() {
        return aspectRatio;
      },
      get is3DType() {
        return is3DType;
      },
      get supportsOutlineOnly() {
        return supportsOutlineOnly;
      },
      get supportsBloom() {
        return supportsBloom;
      },
      get supportsCollisions() {
        return supportsCollisions;
      },
      get supportsEmission() {
        return supportsEmission;
      },
      get showEmissionSection() {
        return showEmissionSection;
      }
    },
    resolutionPresets: RESOLUTION_PRESETS,
    actions: {
      schedulePreviewRender,
      clearPreviewSettleTimer,
      handleExport,
      applyResolutionPreset,
      addColor,
      moveColor,
      removeColor,
      updateColor,
      replaceColors,
      updatePaletteOverride,
      togglePaletteOverride,
      togglePaletteBlock,
      switchType,
      generateRandomGeneratedColors,
      generateRandomIncludingType,
      isLocked,
      toggleLock,
      copyCliCommand,
      cycleColorPreset,
      applySelectedColorPreset,
      setEqualWeights,
      setRandomWeights,
      updateWeight,
      toggleLookColumns,
      fitManualCamera
    }
  };
}
