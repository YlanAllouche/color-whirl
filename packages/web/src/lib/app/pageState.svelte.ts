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
  type WallpaperAppStateV1,
  applyRandomizedWidgetPaths,
  isRandomizeWidgetSupported,
  type RandomizeWidgetId
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
import {
  buildAppState,
  decodeCfgParam,
  encodeCfgParam,
  getCfgParamFromSearch,
  scheduleWriteCfgInUrl,
  shouldSkipUrlUpdate,
  type UrlWriteMode
} from '$lib/app/url/cfg';
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
import {
  createDefaultPerfState,
  pushSample,
  sampleStats,
  type PerfActionId,
  type PerfState
} from '$lib/app/perf/metrics';

type WeightTarget = 'spheres' | 'circles' | 'polygons' | 'triangles2d' | 'prisms' | 'hexgrid' | 'ridges' | 'svg' | 'bands' | 'flowlines' | 'diamondgrid';
type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
type RandomizationProfile = 'safe' | 'exploratory';
type PaletteRandomizeScheme = 'auto' | 'analogous' | 'triadic' | 'complementary' | 'split-complementary' | 'hue-between';

const RENDER_SETTLE_MS = 280;
const SETTINGS_MAXIMIZED_KEY = 'ui.layout.settingsMaximized';
const PERFORMANCE_HUD_VISIBLE_KEY = 'ui.perf.hudVisible';
const PERF_SAMPLE_WINDOW = 180;

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
    locks: {
      'bubbles.enabled': true
    } as LockMap,
    selectedColorPresetId: COLOR_PRESETS[0]?.id ?? '',
    randomizationProfile: 'safe' as RandomizationProfile,
    paletteRandomizeScheme: 'auto' as PaletteRandomizeScheme,
    paletteRandomizeHueBetweenSteps: null as number | null,
    performance: createDefaultPerfState(false) as PerfState
  });

  let camDragPointerId = -1;
  let pendingUrlWriteMode: UrlWriteMode = 'replace';

  const previewRefs: PreviewRefs = {
    preview: null,
    basic3dPreview: null,
    fallbackCanvas: null
  };

  const frameTimeSamples: number[] = [];
  const fpsSamples: number[] = [];
  const renderTimeSamples: number[] = [];
  const actionSamples: Record<PerfActionId, number[]> = {
    randomizeCurrent: [],
    randomizeAll: [],
    randomizeWidget: [],
    export: [],
    fitCamera: []
  };

  function updateFrameMetrics(frameMs: number) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    pushSample(frameTimeSamples, frameMs, PERF_SAMPLE_WINDOW);
    pushSample(fpsSamples, 1000 / frameMs, PERF_SAMPLE_WINDOW);

    const frameStats = sampleStats(frameTimeSamples);
    const fpsStats = sampleStats(fpsSamples);
    state.performance.frameTimeAvgMs = frameStats.avg;
    state.performance.frameTimeP95Ms = frameStats.p95;
    state.performance.fpsAvg = fpsStats.avg;
    state.performance.fpsP95 = fpsStats.p95;
  }

  function updateRenderMetrics(renderMs: number) {
    if (!Number.isFinite(renderMs) || renderMs < 0) return;
    pushSample(renderTimeSamples, renderMs, PERF_SAMPLE_WINDOW);
    const stats = sampleStats(renderTimeSamples);
    state.performance.renderTimeAvgMs = stats.avg;
    state.performance.renderTimeP95Ms = stats.p95;
  }

  function updateActionMetrics(actionId: PerfActionId, durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const samples = actionSamples[actionId];
    pushSample(samples, durationMs, PERF_SAMPLE_WINDOW);

    const stats = sampleStats(samples);
    const next = state.performance.actions[actionId];
    next.count += 1;
    next.totalMs += durationMs;
    next.lastMs = durationMs;
    next.avgMs = stats.avg;
    next.p95Ms = stats.p95;
  }

  function updateMemoryMetrics() {
    const perfAny = performance as any;
    const memory = perfAny?.memory;
    if (!memory) {
      state.performance.memorySupported = false;
      state.performance.memoryUsedMB = null;
      state.performance.memoryLimitMB = null;
      return;
    }

    state.performance.memorySupported = true;
    const used = Number(memory.usedJSHeapSize);
    const limit = Number(memory.jsHeapSizeLimit);
    state.performance.memoryUsedMB = Number.isFinite(used) ? used / (1024 * 1024) : null;
    state.performance.memoryLimitMB = Number.isFinite(limit) ? limit / (1024 * 1024) : null;
  }

  function setHudVisible(next: boolean) {
    state.performance.hudVisible = !!next;
  }

  function togglePerformanceHud() {
    setHudVisible(!state.performance.hudVisible);
  }

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
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    renderCurrentOnceImpl(previewRendererCtx, quality, opts);
    const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    updateRenderMetrics(endedAt - startedAt);
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

  function getPaletteRandomizeOptions() {
    const anchors = state.config.colors.length > 0
      ? [state.config.colors[0], state.config.colors[state.config.colors.length - 1]]
      : [];

    return {
      profile: state.randomizationProfile,
      paletteScheme: state.paletteRandomizeScheme,
      paletteSchemeSteps:
        state.paletteRandomizeScheme === 'hue-between' && Number.isFinite(state.paletteRandomizeHueBetweenSteps)
          ? Math.max(2, Math.round(Number(state.paletteRandomizeHueBetweenSteps)))
          : undefined,
      paletteSchemeAnchors: anchors
    };
  }

  function markNextUrlWriteAsPush() {
    pendingUrlWriteMode = 'push';
  }

  function restoreStateFromCfgParam(cfg: string): boolean {
    try {
      const stateFromUrl = decodeCfgParam(cfg);
      state.config = normalizeWallpaperConfig(stateFromUrl.c as any) as WallpaperConfig;
      state.exportFormat = stateFromUrl.f;
      state.renderMode = stateFromUrl.m;
      return true;
    } catch {
      return false;
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
    const startedAt = performance.now();
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
      updateActionMetrics('export', performance.now() - startedAt);
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
    const beforeLen = state.config.colors.length;
    state.config = removeColorImpl(state.config, index);
    if (state.config.colors.length < beforeLen) {
      const nextLocks: LockMap = {};
      for (const [path, value] of Object.entries(state.locks)) {
        const match = /^colors\.(\d+)$/.exec(path);
        if (!match) {
          nextLocks[path] = value;
          continue;
        }
        const swatchIndex = Number.parseInt(match[1], 10);
        if (!Number.isFinite(swatchIndex)) {
          nextLocks[path] = value;
          continue;
        }
        if (swatchIndex === index) continue;
        if (swatchIndex > index) {
          nextLocks[`colors.${swatchIndex - 1}`] = value;
          continue;
        }
        nextLocks[path] = value;
      }
      state.locks = nextLocks;
    }
    schedulePreviewRender();
  }

  function moveColor(fromIndex: number, toIndex: number) {
    const len = state.config.colors.length;
    const from = Math.max(0, Math.min(len - 1, Math.trunc(fromIndex)));
    const to = Math.max(0, Math.min(len - 1, Math.trunc(toIndex)));
    state.config = moveColorImpl(state.config, from, to);
    if (from !== to) {
      const nextLocks: LockMap = {};
      for (const [path, value] of Object.entries(state.locks)) {
        const match = /^colors\.(\d+)$/.exec(path);
        if (!match) {
          nextLocks[path] = value;
          continue;
        }
        const swatchIndex = Number.parseInt(match[1], 10);
        if (!Number.isFinite(swatchIndex)) {
          nextLocks[path] = value;
          continue;
        }

        let mapped = swatchIndex;
        if (swatchIndex === from) mapped = to;
        else if (from < to && swatchIndex > from && swatchIndex <= to) mapped = swatchIndex - 1;
        else if (from > to && swatchIndex >= to && swatchIndex < from) mapped = swatchIndex + 1;

        nextLocks[`colors.${mapped}`] = value;
      }
      state.locks = nextLocks;
    }
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

  function applyRandomCurrentConfig() {
    const seed = randomSeedU32();
    markNextUrlWriteAsPush();
    state.config = mergeWithLocks(
      (generateRandomConfigNoPresetsFromSeed as any)(seed, state.config.type, getPaletteRandomizeOptions()) as any
    ) as WallpaperConfig;
    schedulePreviewRender();
  }

  function generateRandomGeneratedColors() {
    const startedAt = performance.now();
    applyRandomCurrentConfig();
    updateActionMetrics('randomizeCurrent', performance.now() - startedAt);
  }

  function generateRandomColorsOnly() {
    const seed = randomSeedU32();
    const randomized = (generateRandomConfigNoPresetsFromSeed as any)(seed, state.config.type, getPaletteRandomizeOptions()) as WallpaperConfig;
    const targeted = applyRandomizedWidgetPaths({
      currentConfig: state.config,
      randomizedConfig: randomized,
      widgetId: 'colors'
    });

    markNextUrlWriteAsPush();
    state.config = mergeWithLocks(targeted) as WallpaperConfig;
    schedulePreviewRender();
  }

  function generateRandomIncludingType() {
    const startedAt = performance.now();
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
    markNextUrlWriteAsPush();
    state.config = mergeWithLocks(
      (generateRandomConfigNoPresetsFromSeed as any)(seed, nextType, getPaletteRandomizeOptions()) as any
    ) as WallpaperConfig;
    schedulePreviewRender();
    updateActionMetrics('randomizeAll', performance.now() - startedAt);
  }

  function canRandomizeWidget(widgetId: string): boolean {
    return isRandomizeWidgetSupported(widgetId, state.config.type);
  }

  function randomizeWidget(widgetId: string) {
    if (!canRandomizeWidget(widgetId)) return;
    const startedAt = performance.now();

    const seed = randomSeedU32();
    const randomized = (generateRandomConfigNoPresetsFromSeed as any)(seed, state.config.type, getPaletteRandomizeOptions()) as WallpaperConfig;

    const targeted = applyRandomizedWidgetPaths({
      currentConfig: state.config,
      randomizedConfig: randomized,
      widgetId: widgetId as RandomizeWidgetId
    });

    markNextUrlWriteAsPush();
    state.config = mergeWithLocks(targeted) as WallpaperConfig;
    schedulePreviewRender();
    updateActionMetrics('randomizeWidget', performance.now() - startedAt);
  }

  async function runBenchmarkIterations(iterations = 50) {
    const total = Math.max(1, Math.round(Number(iterations) || 50));
    if (state.performance.benchmark.running) return;

    state.performance.benchmark.running = true;
    state.performance.benchmark.presetLabel = `${total} iterations`;
    state.performance.benchmark.totalIterations = total;
    state.performance.benchmark.completedIterations = 0;
    state.performance.benchmark.totalMs = 0;
    state.performance.benchmark.avgMs = 0;
    state.performance.benchmark.p95Ms = 0;

    const iterationSamples: number[] = [];
    const startedAt = performance.now();

    try {
      for (let i = 0; i < total; i += 1) {
        const iterationStart = performance.now();
        applyRandomCurrentConfig();

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

        if ((i + 1) % 5 === 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 0);
          });
        }

        const iterationMs = performance.now() - iterationStart;
        pushSample(iterationSamples, iterationMs, total);
        const stats = sampleStats(iterationSamples);

        state.performance.benchmark.completedIterations = i + 1;
        state.performance.benchmark.totalMs = performance.now() - startedAt;
        state.performance.benchmark.avgMs = stats.avg;
        state.performance.benchmark.p95Ms = stats.p95;
      }
    } finally {
      state.performance.benchmark.running = false;
      state.performance.benchmark.totalMs = performance.now() - startedAt;
    }
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
    const startedAt = performance.now();
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
      updateActionMetrics('fitCamera', performance.now() - startedAt);
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
    const mode = pendingUrlWriteMode;
    pendingUrlWriteMode = 'replace';
    if (shouldSkipUrlUpdate(url, cfg)) return;

    return scheduleWriteCfgInUrl(cfg, { debounceMs: mode === 'push' ? 0 : 120, mode });
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

  $effect(() => {
    if (!state.settingsMaximizedReady) return;
    writeLocalStorageBool(PERFORMANCE_HUD_VISIBLE_KEY, state.performance.hudVisible);
  });

  onMount(() => {
    const storedSettingsMaximized = readLocalStorageBool(SETTINGS_MAXIMIZED_KEY);
    if (storedSettingsMaximized !== null) state.settingsMaximized = storedSettingsMaximized;
    const storedHudVisible = readLocalStorageBool(PERFORMANCE_HUD_VISIBLE_KEY);
    if (storedHudVisible !== null) setHudVisible(storedHudVisible);
    state.settingsMaximizedReady = true;
    const hasUrlParams = window.location.search.length > 0;

    try {
      if (hasUrlParams) {
        const cfg = getCfgParamFromSearch(window.location.search);
        if (cfg) {
          if (!restoreStateFromCfgParam(cfg)) {
            state.config = (generateRandomConfigNoPresets as any)({ profile: state.randomizationProfile }) as WallpaperConfig;
          }
        } else {
          state.config = (generateRandomConfigNoPresets as any)({ profile: state.randomizationProfile }) as WallpaperConfig;
        }
      } else {
        state.config = (generateRandomConfigNoPresets as any)({ profile: state.randomizationProfile }) as WallpaperConfig;
      }
    } catch {
      state.config = (generateRandomConfigNoPresets as any)({ profile: state.randomizationProfile }) as WallpaperConfig;
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

    let frameLoopId = 0;
    let lastFrameAt = 0;
    const frameLoop = (now: number) => {
      if (lastFrameAt > 0) {
        updateFrameMetrics(now - lastFrameAt);
      }
      lastFrameAt = now;
      frameLoopId = window.requestAnimationFrame(frameLoop);
    };
    frameLoopId = window.requestAnimationFrame(frameLoop);

    updateMemoryMetrics();
    const memoryIntervalId = window.setInterval(() => {
      updateMemoryMetrics();
    }, 1000);

    let longTaskObserver: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      state.performance.longTaskSupported = true;
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = Number(entry.duration) || 0;
          if (duration > 50) {
            state.performance.longTaskCount += 1;
            state.performance.longTaskTotalMs += duration;
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } else {
      state.performance.longTaskSupported = false;
    }

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

    const handlePopState = () => {
      const cfg = getCfgParamFromSearch(window.location.search);
      if (!cfg) return;
      if (!restoreStateFromCfgParam(cfg)) return;
      schedulePreviewRender();
    };

    window.addEventListener('popstate', handlePopState);

    if (state.canvasContainer) {
      resizeObserver.observe(state.canvasContainer);
    }

    return () => {
      if (frameLoopId) window.cancelAnimationFrame(frameLoopId);
      window.clearInterval(memoryIntervalId);
      longTaskObserver?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleGlobalBlur);
      window.removeEventListener('popstate', handlePopState);
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
      generateRandomColorsOnly,
      generateRandomIncludingType,
      canRandomizeWidget,
      randomizeWidget,
      isLocked,
      toggleLock,
      copyCliCommand,
      cycleColorPreset,
      applySelectedColorPreset,
      setEqualWeights,
      setRandomWeights,
      updateWeight,
      toggleLookColumns,
      fitManualCamera,
      togglePerformanceHud,
      runBenchmarkIterations
    }
  };
}
