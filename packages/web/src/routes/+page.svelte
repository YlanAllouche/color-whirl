<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
    createWallpaperScene,
    renderWallpaperToCanvas
  } from '@wallpaper-maker/core';

  import { PopsiclePreview, type PreviewRenderMode } from '$lib/popsicle/preview';

  type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

  import { COLOR_PRESETS, COLOR_PRESET_GROUPS, type ColorPreset } from '$lib/color-presets';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>(cloneDefaultConfig());
  
  let canvasContainer: HTMLDivElement;
  let preview: PopsiclePreview | null = null;
  let fallbackCanvas: HTMLCanvasElement | null = null;
  let fallbackRenderer: THREE.WebGLRenderer | null = null;
  let fallbackComposer: EffectComposer | null = null;
  let fallbackScene: THREE.Scene | null = null;
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

  let is3DType = $derived(config.type === 'popsicle' || config.type === 'spheres3d' || config.type === 'triangles3d');
  let supportsOutlineOnly = $derived(config.type === 'spheres3d' || config.type === 'triangles3d');
  let supportsBloom = $derived(config.type !== 'hexgrid2d');
  let supportsEmission = $derived(
    config.type === 'popsicle' ||
      config.type === 'spheres3d' ||
      config.type === 'triangles3d' ||
      config.type === 'circles2d' ||
      config.type === 'polygon2d' ||
      config.type === 'triangles2d'
  );
  let showEmissionSection = $derived(
    supportsEmission && (config.type === 'circles2d' || config.type === 'polygon2d' || config.type === 'triangles2d' ? config.bloom.enabled : true)
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

  function disposeFallback3D() {
    if (fallbackComposer) {
      fallbackComposer.dispose();
      fallbackComposer = null;
    }

    if (fallbackScene) {
      try {
        (fallbackScene.userData as any).__wmDisposeCollisionMasking?.();
        (fallbackScene.userData as any).__wmDisposeProceduralEnvironment?.();
      } catch {
        // Ignore
      }
      fallbackScene.traverse((obj) => {
        const mesh = obj as any;
        if (mesh.geometry?.dispose) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m: any) => m?.dispose?.());
          else mesh.material?.dispose?.();
        }
      });
      fallbackScene = null;
    }

    if (fallbackRenderer) {
      try {
        (fallbackRenderer as any).forceContextLoss?.();
      } catch {
        // Ignore
      }
      fallbackRenderer.dispose();
      fallbackRenderer = null;
    }
  }

  function renderNonPopsicleOnce(quality: FallbackQuality) {
    if (!canvasContainer) return;

    const aspect = config.width / config.height;
    const { previewWidth, previewHeight, cssWidth, cssHeight } = getFallbackPreviewSize(aspect, quality);

    const effective: WallpaperConfig = { ...config, width: previewWidth, height: previewHeight } as any;

    if (effective.type === 'spheres3d' || effective.type === 'triangles3d') {
      disposeFallback3D();
      fallbackCanvas = null;

      const { scene, camera, renderer } = createWallpaperScene(effective, {
        preserveDrawingBuffer: true,
        pixelRatio: 1
      });

      renderer.domElement.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
      renderer.domElement.style.height = `${Math.max(1, Math.round(cssHeight))}px`;

      if (effective.bloom.enabled) {
        const composer = new EffectComposer(renderer);
        composer.setSize(previewWidth, previewHeight);
        composer.addPass(new RenderPass(scene, camera as any));
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(previewWidth, previewHeight),
          effective.bloom.strength,
          effective.bloom.radius,
          effective.bloom.threshold
        );
        composer.addPass(bloom);
        composer.render();
        fallbackComposer = composer;
      } else {
        renderer.render(scene, camera);
      }

      fallbackRenderer = renderer;
      fallbackScene = scene;

      const next = renderer.domElement;
      if (!next.parentElement) {
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(next);
      }
      return;
    }

    // 2D types (and any non-popsicle that can be drawn to a 2D canvas)
    disposeFallback3D();

    const next = renderWallpaperToCanvas(effective, fallbackCanvas ?? undefined);
    next.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
    next.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
    fallbackCanvas = next;
    if (!next.parentElement) {
      canvasContainer.innerHTML = '';
      canvasContainer.appendChild(next);
    }
  }

  function schedulePreviewRender() {
    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(() => {
      if (config.type === 'popsicle') {
        preview?.renderOnce(config as PopsicleConfig, 'interactive');
      } else {
        renderNonPopsicleOnce('interactive');
      }
    });

    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
    renderSettleTimer = window.setTimeout(() => {
      if (config.type === 'popsicle') {
        preview?.renderOnce(config as PopsicleConfig, 'final');
      } else {
        renderNonPopsicleOnce('final');
      }
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
          textureParams: {
            drywall: { ...DEFAULT_CONFIG.textureParams.drywall },
            glass: { ...DEFAULT_CONFIG.textureParams.glass },
            cel: { ...DEFAULT_CONFIG.textureParams.cel }
          },
          edges: {
            tint: { ...DEFAULT_CONFIG.edges.tint },
            material: { ...DEFAULT_CONFIG.edges.material },
            wear: { ...DEFAULT_CONFIG.edges.wear },
            rimLight: { ...DEFAULT_CONFIG.edges.rimLight },
            outline: { ...DEFAULT_CONFIG.edges.outline }
          },
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
    const merged: WallpaperConfig = {
      ...next,
      colors: [...next.colors],
      textureParams: {
        drywall: { ...next.textureParams.drywall },
        glass: { ...next.textureParams.glass },
        cel: { ...next.textureParams.cel }
      },
      edges: {
        tint: { ...next.edges.tint },
        material: { ...next.edges.material },
        wear: { ...next.edges.wear },
        rimLight: { ...next.edges.rimLight },
        outline: { ...next.edges.outline }
      },
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

     if (locks.colors) merged.colors = [...current.colors];
     if (locks.backgroundColor) merged.backgroundColor = current.backgroundColor;

     if (locks.texture) merged.texture = current.texture;

    if (current.type === 'popsicle' && merged.type === 'popsicle') {
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
    }

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

  function cloneConfigDeep(src: WallpaperConfig): WallpaperConfig {
    switch (src.type) {
      case 'popsicle':
        return {
          ...src,
          colors: [...src.colors],
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          spheres: { ...src.spheres, colorWeights: [...src.spheres.colorWeights] }
        };
      case 'circles2d':
        return {
          ...src,
          colors: [...src.colors],
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
          textureParams: {
            drywall: { ...src.textureParams.drywall },
            glass: { ...src.textureParams.glass },
            cel: { ...src.textureParams.cel }
          },
          edges: {
            tint: { ...src.edges.tint },
            material: { ...src.edges.material },
            wear: { ...src.edges.wear },
            rimLight: { ...src.edges.rimLight },
            outline: { ...src.edges.outline }
          },
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
    next.backgroundColor = current.backgroundColor;
    next.texture = current.texture;
    next.textureParams = {
      drywall: { ...current.textureParams.drywall },
      glass: { ...current.textureParams.glass },
      cel: { ...current.textureParams.cel }
    };
    next.edges = {
      tint: { ...current.edges.tint },
      material: { ...current.edges.material },
      wear: { ...current.edges.wear },
      rimLight: { ...current.edges.rimLight },
      outline: { ...current.edges.outline }
    };
    next.emission = { ...current.emission };
    next.bloom = { ...current.bloom };
    next.collisions = { ...current.collisions, carve: { ...current.collisions.carve } };
    next.lighting = { ...current.lighting, position: { ...current.lighting.position } };
    next.camera = { ...current.camera };
    next.environment = { ...current.environment };
    next.shadows = { ...current.shadows };
    next.rendering = { ...current.rendering };
    next.geometry = { ...current.geometry };

    config = next;
    schedulePreviewRender();
  }

  type WeightTarget = 'spheres' | 'circles' | 'polygons' | 'triangles2d' | 'prisms' | 'hexgrid';

  function setEqualWeights(target: WeightTarget) {
    const n = Math.max(0, config.colors.length);
    const w = Array.from({ length: n }, () => 1);

    if (target === 'spheres' && config.type === 'spheres3d') config.spheres.colorWeights = w;
    if (target === 'circles' && config.type === 'circles2d') config.circles.colorWeights = w;
    if (target === 'polygons' && config.type === 'polygon2d') config.polygons.colorWeights = w;
    if (target === 'triangles2d' && config.type === 'triangles2d') config.triangles.colorWeights = w;
    if (target === 'prisms' && config.type === 'triangles3d') config.prisms.colorWeights = w;
    if (target === 'hexgrid' && config.type === 'hexgrid2d') config.hexgrid.coloring.weights = w;
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
  }

  function generateRandomGeneratedColors() {
    // Randomize everything, including a non-preset generated color theme.
    const seed = randomSeedU32();
    config = mergeWithLocks(generateRandomConfigNoPresetsFromSeed(seed, config.type));
    schedulePreviewRender();
  }

  function generateRandomIncludingType() {
    const seed = randomSeedU32();
    const types: WallpaperType[] = ['popsicle', 'spheres3d', 'circles2d', 'polygon2d', 'triangles2d', 'triangles3d', 'hexgrid2d'];
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
    if (!urlSyncEnabled) return;
    if (!canvasContainer) return;
    void config.type;

    if (config.type === 'popsicle') {
      if (!preview) {
        disposeFallback3D();
        fallbackCanvas = null;
        canvasContainer.innerHTML = '';
        preview = new PopsiclePreview(canvasContainer);
        preview.setMode(renderMode);
      }
      return;
    }

    if (preview) {
      preview.dispose();
      preview = null;
    }
    fallbackCanvas = null;
    disposeFallback3D();
    renderMode = 'raster';
    renderNonPopsicleOnce('final');
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
    void c.texture;
    void c.textureParams.drywall.grainAmount;
    void c.textureParams.drywall.grainScale;
    void c.textureParams.glass.style;
    void c.textureParams.cel.bands;
    void c.textureParams.cel.halftone;
    void c.backgroundColor;
    void c.edges.tint.enabled;
    void c.edges.tint.color;
    void c.edges.tint.amount;
    void c.edges.material.enabled;
    void c.edges.material.roughness;
    void c.edges.material.metalness;
    void c.edges.material.clearcoat;
    void c.edges.material.envIntensityMult;
    void c.edges.wear.enabled;
    void c.edges.wear.intensity;
    void c.edges.wear.width;
    void c.edges.wear.noise;
    void c.edges.wear.colorShift;
    void c.edges.rimLight.enabled;
    void c.edges.rimLight.color;
    void c.edges.rimLight.intensity;
    void c.edges.rimLight.power;
    void c.edges.outline.enabled;
    void c.edges.outline.color;
    void c.edges.outline.thickness;
    void c.edges.outline.opacity;
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
    if (c.type === 'popsicle') {
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
      void c.prisms.radius;
      void c.prisms.height;
      void c.prisms.wallBulge;
      void c.prisms.spread;
      void c.prisms.jitter;
      void c.prisms.paletteMode;
      void c.prisms.colorWeights.join(',');
      void c.prisms.opacity;
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

    if ((config.texture === 'cel' || config.edges.outline.enabled || config.bloom.enabled) && renderMode === 'path') {
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

    if (config.type === 'hexgrid2d') {
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
    fallbackCanvas = null;
    disposeFallback3D();

    if (config.type === 'popsicle') {
      preview = new PopsiclePreview(canvasContainer);
      preview.setMode(renderMode);
    } else {
      renderMode = 'raster';
      renderNonPopsicleOnce('final');
    }

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
      disposeFallback3D();
      fallbackCanvas = null;
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
             <button type="button" onclick={generateRandomIncludingType} title="Randomize all settings and generator type (keeps resolution/geometry quality)">
               Randomize (incl type)
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
              <option value="triangles2d">Triangles (2D)</option>
              <option value="triangles3d">Triangles (3D)</option>
              <option value="hexgrid2d">Hex Grid (2D)</option>
            </select>
          </label>
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
        {#if is3DType}
          <label class="control-row">
            <button type="button" class="setting-title" class:locked={locks.texture} onclick={() => toggleLock('texture')} title="Click to lock/unlock for randomize">Texture</button>
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
              <span class="setting-title">Grain: {config.textureParams.drywall.grainAmount.toFixed(2)}</span>
              <input type="range" bind:value={config.textureParams.drywall.grainAmount} min="0" max="1" step="0.01" />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Grain Scale: {config.textureParams.drywall.grainScale.toFixed(2)}</span>
              <input type="range" bind:value={config.textureParams.drywall.grainScale} min="0.5" max="8" step="0.05" />
            </label>
          {/if}

          {#if config.texture === 'glass'}
            <label class="control-row">
              <span class="setting-title">Glass Style</span>
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
              <span class="setting-title">Bands: {Math.round(config.textureParams.cel.bands)}</span>
              <input type="range" bind:value={config.textureParams.cel.bands} min="2" max="8" step="1" />
            </label>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.textureParams.cel.halftone} />
              <span class="setting-title">Halftone</span>
            </label>
          {/if}
        {/if}
         <label class="control-row">
           <button type="button" class="setting-title" class:locked={locks.backgroundColor} onclick={() => toggleLock('backgroundColor')} title="Click to lock/unlock for randomize">Background</button>
           <input type="color" bind:value={config.backgroundColor} />
         </label>
       </section>

      <!-- Emission -->
      {#if showEmissionSection}
        <section class="control-section">
          <h3>Emission</h3>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.emission.enabled} />
            <span class="setting-title">Enable</span>
          </label>

          <label class="control-row">
            <span class="setting-title">Palette Index</span>
            <select bind:value={config.emission.paletteIndex} disabled={!config.emission.enabled}>
              {#each config.colors as c, i}
                <option value={i}>{i}: {c}</option>
              {/each}
            </select>
          </label>

          <label class="control-row slider">
            <span class="setting-title">Intensity: {config.emission.intensity.toFixed(2)}</span>
            <input type="range" bind:value={config.emission.intensity} min="0" max="20" step="0.05" disabled={!config.emission.enabled} />
          </label>
        </section>
      {/if}

      <!-- Edges -->
      {#if config.type === 'popsicle'}
      <section class="control-section">
        <h3>Edges</h3>

        <details class="control-details">
          <summary class="control-details-summary">Rim light</summary>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.rimLight.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Color</span>
            <input type="color" bind:value={config.edges.rimLight.color} disabled={!config.edges.rimLight.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Intensity: {config.edges.rimLight.intensity.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.rimLight.intensity} min="0" max="5" step="0.01" disabled={!config.edges.rimLight.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Power: {config.edges.rimLight.power.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.rimLight.power} min="0.5" max="8" step="0.05" disabled={!config.edges.rimLight.enabled} />
          </label>
        </details>

        <details class="control-details">
          <summary class="control-details-summary">Edge tint</summary>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.tint.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Tint</span>
            <input type="color" bind:value={config.edges.tint.color} disabled={!config.edges.tint.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Amount: {config.edges.tint.amount.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.tint.amount} min="0" max="1" step="0.01" disabled={!config.edges.tint.enabled} />
          </label>
        </details>

        <details class="control-details">
          <summary class="control-details-summary">Edge material</summary>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.material.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row slider">
            <span class="setting-title">Roughness: {config.edges.material.roughness.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.material.roughness} min="0" max="1" step="0.01" disabled={!config.edges.material.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Metalness: {config.edges.material.metalness.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.material.metalness} min="0" max="1" step="0.01" disabled={!config.edges.material.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Clearcoat: {config.edges.material.clearcoat.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.material.clearcoat} min="0" max="1" step="0.01" disabled={!config.edges.material.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Env mult: {config.edges.material.envIntensityMult.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.material.envIntensityMult} min="0" max="3" step="0.01" disabled={!config.edges.material.enabled} />
          </label>
        </details>

        <details class="control-details">
          <summary class="control-details-summary">Edge wear</summary>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.wear.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Shift</span>
            <input type="color" bind:value={config.edges.wear.colorShift} disabled={!config.edges.wear.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Intensity: {config.edges.wear.intensity.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.wear.intensity} min="0" max="1" step="0.01" disabled={!config.edges.wear.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Width: {config.edges.wear.width.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.wear.width} min="0" max="1" step="0.01" disabled={!config.edges.wear.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Noise: {config.edges.wear.noise.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.wear.noise} min="0" max="1" step="0.01" disabled={!config.edges.wear.enabled} />
          </label>
        </details>

        <details class="control-details">
          <summary class="control-details-summary">Outline</summary>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.outline.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Color</span>
            <input type="color" bind:value={config.edges.outline.color} disabled={!config.edges.outline.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Thickness: {config.edges.outline.thickness.toFixed(3)}</span>
            <input type="range" bind:value={config.edges.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.edges.outline.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Opacity: {config.edges.outline.opacity.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.outline.opacity} min="0" max="1" step="0.01" disabled={!config.edges.outline.enabled} />
          </label>
        </details>
      </section>
      {:else if supportsOutlineOnly}
        <section class="control-section">
          <h3>Outline</h3>
          <label class="control-row checkbox">
            <input type="checkbox" bind:checked={config.edges.outline.enabled} />
            <span class="setting-title">Enable</span>
          </label>
          <label class="control-row">
            <span class="setting-title">Color</span>
            <input type="color" bind:value={config.edges.outline.color} disabled={!config.edges.outline.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Thickness: {config.edges.outline.thickness.toFixed(3)}</span>
            <input type="range" bind:value={config.edges.outline.thickness} min="0" max="0.12" step="0.001" disabled={!config.edges.outline.enabled} />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Opacity: {config.edges.outline.opacity.toFixed(2)}</span>
            <input type="range" bind:value={config.edges.outline.opacity} min="0" max="1" step="0.01" disabled={!config.edges.outline.enabled} />
          </label>
        </section>
      {/if}
       
       {#if config.type === 'popsicle'}
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
       {:else if config.type === 'spheres3d'}
        <section class="control-section">
          <h3>Spheres (3D)</h3>

          <label class="control-row slider">
            <span class="setting-title">Count: {config.spheres.count}</span>
            <input type="range" bind:value={config.spheres.count} min="1" max="800" step="1" />
          </label>

          <label class="control-row">
            <span class="setting-title">Distribution</span>
            <select bind:value={config.spheres.distribution}>
              <option value="jitteredGrid">Jittered grid</option>
              <option value="scatter">Scatter</option>
              <option value="layeredDepth">Layered depth</option>
            </select>
          </label>

          <label class="control-row slider">
            <span class="setting-title">Radius min: {config.spheres.radiusMin.toFixed(2)}</span>
            <input type="range" bind:value={config.spheres.radiusMin} min="0.05" max="2.0" step="0.01" />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Radius max: {config.spheres.radiusMax.toFixed(2)}</span>
            <input type="range" bind:value={config.spheres.radiusMax} min="0.05" max="3.5" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Spread: {config.spheres.spread.toFixed(2)}</span>
            <input type="range" bind:value={config.spheres.spread} min="0.5" max="20" step="0.05" />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Depth: {config.spheres.depth.toFixed(2)}</span>
            <input type="range" bind:value={config.spheres.depth} min="0" max="20" step="0.05" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Layers: {config.spheres.layers}</span>
            <input type="range" bind:value={config.spheres.layers} min="1" max="16" step="1" disabled={config.spheres.distribution !== 'layeredDepth'} />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Opacity: {config.spheres.opacity.toFixed(2)}</span>
            <input type="range" bind:value={config.spheres.opacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <span class="setting-title">Mode</span>
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
                  <span class="setting-title">w{i + 1}: {(config.spheres.colorWeights[i] ?? 1).toFixed(2)} {c}</span>
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
            <span class="setting-title">Mode</span>
            <select bind:value={config.circles.mode}>
              <option value="scatter">Scatter</option>
              <option value="grid">Grid</option>
            </select>
          </label>

          <label class="control-row slider">
            <span class="setting-title">Count: {config.circles.count}</span>
            <input type="range" bind:value={config.circles.count} min="0" max="4000" step="10" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Radius min: {Math.round(config.circles.rMinPx)}px</span>
            <input type="range" bind:value={config.circles.rMinPx} min="1" max="240" step="1" />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Radius max: {Math.round(config.circles.rMaxPx)}px</span>
            <input type="range" bind:value={config.circles.rMaxPx} min="1" max="420" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Jitter: {config.circles.jitter.toFixed(2)}</span>
            <input type="range" bind:value={config.circles.jitter} min="0" max="1" step="0.01" />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Fill opacity: {config.circles.fillOpacity.toFixed(2)}</span>
            <input type="range" bind:value={config.circles.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.circles.stroke.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Math.round(config.circles.stroke.widthPx)}px</span>
              <input type="range" bind:value={config.circles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.circles.stroke.enabled} />
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input type="color" bind:value={config.circles.stroke.color} disabled={!config.circles.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {config.circles.stroke.opacity.toFixed(2)}</span>
              <input type="range" bind:value={config.circles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.circles.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Croissant</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.circles.croissant.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Inner scale: {config.circles.croissant.innerScale.toFixed(2)}</span>
              <input type="range" bind:value={config.circles.croissant.innerScale} min="0.05" max="0.98" step="0.01" disabled={!config.circles.croissant.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Offset: {config.circles.croissant.offset.toFixed(2)}</span>
              <input type="range" bind:value={config.circles.croissant.offset} min="0" max="1" step="0.01" disabled={!config.circles.croissant.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Angle jitter: {Math.round(config.circles.croissant.angleJitterDeg)}deg</span>
              <input type="range" bind:value={config.circles.croissant.angleJitterDeg} min="0" max="180" step="1" disabled={!config.circles.croissant.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <span class="setting-title">Mode</span>
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
                  <span class="setting-title">w{i + 1}: {(config.circles.colorWeights[i] ?? 1).toFixed(2)} {c}</span>
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
            <span class="setting-title">Count: {config.polygons.count}</span>
            <input type="range" bind:value={config.polygons.count} min="0" max="4000" step="10" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Edges: {Math.round(config.polygons.edges)}</span>
            <input type="range" bind:value={config.polygons.edges} min="3" max="16" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Radius min: {Math.round(config.polygons.rMinPx)}px</span>
            <input type="range" bind:value={config.polygons.rMinPx} min="1" max="240" step="1" />
          </label>
          <label class="control-row slider">
            <span class="setting-title">Radius max: {Math.round(config.polygons.rMaxPx)}px</span>
            <input type="range" bind:value={config.polygons.rMaxPx} min="1" max="420" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Jitter: {config.polygons.jitter.toFixed(2)}</span>
            <input type="range" bind:value={config.polygons.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Rotate jitter: {Math.round(config.polygons.rotateJitterDeg)}deg</span>
            <input type="range" bind:value={config.polygons.rotateJitterDeg} min="0" max="360" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Fill opacity: {config.polygons.fillOpacity.toFixed(2)}</span>
            <input type="range" bind:value={config.polygons.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.polygons.stroke.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Math.round(config.polygons.stroke.widthPx)}px</span>
              <input type="range" bind:value={config.polygons.stroke.widthPx} min="0" max="24" step="1" disabled={!config.polygons.stroke.enabled} />
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input type="color" bind:value={config.polygons.stroke.color} disabled={!config.polygons.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {config.polygons.stroke.opacity.toFixed(2)}</span>
              <input type="range" bind:value={config.polygons.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.polygons.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <span class="setting-title">Mode</span>
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
                  <span class="setting-title">w{i + 1}: {(config.polygons.colorWeights[i] ?? 1).toFixed(2)} {c}</span>
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
       {:else if config.type === 'triangles2d'}
        <section class="control-section">
          <h3>Triangles (2D)</h3>

          <label class="control-row">
            <span class="setting-title">Mode</span>
            <select bind:value={config.triangles.mode}>
              <option value="tessellation">Tessellation</option>
              <option value="scatter">Scatter</option>
              <option value="lowpoly">Low poly</option>
            </select>
          </label>

          <label class="control-row slider">
            <span class="setting-title">Density: {config.triangles.density.toFixed(2)}</span>
            <input type="range" bind:value={config.triangles.density} min="0.1" max="3.5" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Scale: {Math.round(config.triangles.scalePx)}px</span>
            <input type="range" bind:value={config.triangles.scalePx} min="6" max="320" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Jitter: {config.triangles.jitter.toFixed(2)}</span>
            <input type="range" bind:value={config.triangles.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Rotate jitter: {Math.round(config.triangles.rotateJitterDeg)}deg</span>
            <input type="range" bind:value={config.triangles.rotateJitterDeg} min="0" max="180" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Inset: {Math.round(config.triangles.insetPx)}px</span>
            <input type="range" bind:value={config.triangles.insetPx} min="0" max="120" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Fill opacity: {config.triangles.fillOpacity.toFixed(2)}</span>
            <input type="range" bind:value={config.triangles.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.triangles.stroke.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Math.round(config.triangles.stroke.widthPx)}px</span>
              <input type="range" bind:value={config.triangles.stroke.widthPx} min="0" max="24" step="1" disabled={!config.triangles.stroke.enabled} />
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input type="color" bind:value={config.triangles.stroke.color} disabled={!config.triangles.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {config.triangles.stroke.opacity.toFixed(2)}</span>
              <input type="range" bind:value={config.triangles.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.triangles.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Shading</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.triangles.shading.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Light: {Math.round(config.triangles.shading.lightDeg)}deg</span>
              <input type="range" bind:value={config.triangles.shading.lightDeg} min="0" max="360" step="1" disabled={!config.triangles.shading.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Strength: {config.triangles.shading.strength.toFixed(2)}</span>
              <input type="range" bind:value={config.triangles.shading.strength} min="0" max="1" step="0.01" disabled={!config.triangles.shading.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <span class="setting-title">Mode</span>
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
                  <span class="setting-title">w{i + 1}: {(config.triangles.colorWeights[i] ?? 1).toFixed(2)} {c}</span>
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
       {:else if config.type === 'triangles3d'}
        <section class="control-section">
          <h3>Triangles (3D)</h3>

          <label class="control-row">
            <span class="setting-title">Mode</span>
            <select bind:value={config.prisms.mode}>
              <option value="tessellation">Tessellation</option>
              <option value="scatter">Scatter</option>
              <option value="stackedPrisms">Stacked prisms</option>
            </select>
          </label>

          <label class="control-row slider">
            <span class="setting-title">Count: {config.prisms.count}</span>
            <input type="range" bind:value={config.prisms.count} min="0" max="2500" step="10" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Radius: {config.prisms.radius.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.radius} min="0.05" max="2.0" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Height: {config.prisms.height.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.height} min="0.02" max="3.0" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Wall bulge: {config.prisms.wallBulge.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.wallBulge} min="-1" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Spread: {config.prisms.spread.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.spread} min="0" max="20" step="0.05" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Jitter: {config.prisms.jitter.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.jitter} min="0" max="1" step="0.01" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Opacity: {config.prisms.opacity.toFixed(2)}</span>
            <input type="range" bind:value={config.prisms.opacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Palette</summary>
            <label class="control-row">
              <span class="setting-title">Mode</span>
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
                  <span class="setting-title">w{i + 1}: {(config.prisms.colorWeights[i] ?? 1).toFixed(2)} {c}</span>
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
       {:else if config.type === 'hexgrid2d'}
        <section class="control-section">
          <h3>Hex Grid (2D)</h3>

          <label class="control-row slider">
            <span class="setting-title">Radius: {Math.round(config.hexgrid.radiusPx)}px</span>
            <input type="range" bind:value={config.hexgrid.radiusPx} min="3" max="140" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Margin: {Math.round(config.hexgrid.marginPx)}px</span>
            <input type="range" bind:value={config.hexgrid.marginPx} min="0" max="60" step="1" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Overscan: {Math.round(config.hexgrid.overscanPx)}px</span>
            <input type="range" bind:value={config.hexgrid.overscanPx} min="0" max="400" step="5" />
          </label>

          <label class="control-row slider">
            <span class="setting-title">Fill opacity: {config.hexgrid.fillOpacity.toFixed(2)}</span>
            <input type="range" bind:value={config.hexgrid.fillOpacity} min="0" max="1" step="0.01" />
          </label>

          <details class="control-details">
            <summary class="control-details-summary">Origin</summary>
            <label class="control-row slider">
              <span class="setting-title">X: {Math.round(config.hexgrid.originPx.x)}px</span>
              <input type="range" bind:value={config.hexgrid.originPx.x} min="-500" max="500" step="1" />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Y: {Math.round(config.hexgrid.originPx.y)}px</span>
              <input type="range" bind:value={config.hexgrid.originPx.y} min="-500" max="500" step="1" />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Stroke</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.hexgrid.stroke.enabled} />
              <span class="setting-title">Enable</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Width: {Math.round(config.hexgrid.stroke.widthPx)}px</span>
              <input type="range" bind:value={config.hexgrid.stroke.widthPx} min="0" max="24" step="1" disabled={!config.hexgrid.stroke.enabled} />
            </label>
            <label class="control-row">
              <span class="setting-title">Join</span>
              <select bind:value={config.hexgrid.stroke.join} disabled={!config.hexgrid.stroke.enabled}>
                <option value="round">Round</option>
                <option value="miter">Miter</option>
                <option value="bevel">Bevel</option>
              </select>
            </label>
            <label class="control-row">
              <span class="setting-title">Color</span>
              <input type="color" bind:value={config.hexgrid.stroke.color} disabled={!config.hexgrid.stroke.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Opacity: {config.hexgrid.stroke.opacity.toFixed(2)}</span>
              <input type="range" bind:value={config.hexgrid.stroke.opacity} min="0" max="1" step="0.01" disabled={!config.hexgrid.stroke.enabled} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Coloring</summary>
            <label class="control-row">
              <span class="setting-title">Palette mode</span>
              <select bind:value={config.hexgrid.coloring.paletteMode}>
                <option value="cycle">Cycle</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>

            <label class="control-row">
              <span class="setting-title">Weights</span>
              <select bind:value={config.hexgrid.coloring.weightsMode}>
                <option value="auto">Auto</option>
                <option value="preset">Preset</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label class="control-row">
              <span class="setting-title">Preset</span>
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
                  <span class="setting-title">w{i + 1}: {(config.hexgrid.coloring.weights[i] ?? 1).toFixed(2)} {c}</span>
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
              <span class="setting-title">Mode</span>
              <select bind:value={config.hexgrid.grouping.mode}>
                <option value="none">None</option>
                <option value="voronoi">Voronoi</option>
                <option value="noise">Noise</option>
                <option value="random-walk">Random walk</option>
              </select>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Strength: {config.hexgrid.grouping.strength.toFixed(2)}</span>
              <input type="range" bind:value={config.hexgrid.grouping.strength} min="0" max="1" step="0.01" disabled={config.hexgrid.grouping.mode === 'none'} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Target groups: {config.hexgrid.grouping.targetGroupCount}</span>
              <input type="range" bind:value={config.hexgrid.grouping.targetGroupCount} min="1" max="250" step="1" disabled={config.hexgrid.grouping.mode === 'none'} />
            </label>
          </details>

          <details class="control-details">
            <summary class="control-details-summary">Effect</summary>
            <label class="control-row">
              <span class="setting-title">Kind</span>
              <select bind:value={config.hexgrid.effect.kind}>
                <option value="none">None</option>
                <option value="bevel">Bevel</option>
                <option value="grain">Grain</option>
                <option value="gradient">Gradient</option>
              </select>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Amount: {config.hexgrid.effect.amount.toFixed(2)}</span>
              <input type="range" bind:value={config.hexgrid.effect.amount} min="0" max="1" step="0.01" disabled={config.hexgrid.effect.kind === 'none'} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Frequency: {config.hexgrid.effect.frequency.toFixed(2)}</span>
              <input type="range" bind:value={config.hexgrid.effect.frequency} min="0.1" max="10" step="0.05" disabled={config.hexgrid.effect.kind === 'none'} />
            </label>
          </details>
        </section>
       {/if}
       
      {#if is3DType}
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
      {/if}

      <!-- Render -->
      <section class="control-section">
        <h3>Render</h3>

        {#if is3DType}
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
              <option value="path" disabled={config.type !== 'popsicle' || config.texture === 'cel' || config.edges.outline.enabled || config.bloom.enabled}>Path traced</option>
            </select>
          </label>
        {/if}

        {#if supportsBloom}
          <details class="control-details">
            <summary class="control-details-summary">Bloom</summary>
            <label class="control-row checkbox">
              <input type="checkbox" bind:checked={config.bloom.enabled} />
              <span class="setting-title">Enable bloom</span>
            </label>
            <label class="control-row slider">
              <span class="setting-title">Strength: {config.bloom.strength.toFixed(2)}</span>
              <input type="range" bind:value={config.bloom.strength} min="0" max="3" step="0.01" disabled={!config.bloom.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Radius: {config.bloom.radius.toFixed(2)}</span>
              <input type="range" bind:value={config.bloom.radius} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
            </label>
            <label class="control-row slider">
              <span class="setting-title">Threshold: {config.bloom.threshold.toFixed(2)}</span>
              <input type="range" bind:value={config.bloom.threshold} min="0" max="1" step="0.01" disabled={!config.bloom.enabled} />
            </label>
          </details>
        {/if}

        {#if is3DType}
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

        {/if}
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
