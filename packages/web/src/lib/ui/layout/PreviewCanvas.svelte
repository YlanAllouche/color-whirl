<script lang="ts">
  import { DEFAULT_CONFIG, type WallpaperConfig } from '@wallpaper-maker/core';
  import { onDestroy } from 'svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    schedulePreviewRender: () => void;
    clearPreviewSettleTimer: () => void;
    canvasContainer?: HTMLDivElement | null;
    canvasHost?: HTMLDivElement | null;
    cameraDragActive?: boolean;
    settingsMaximized?: boolean;
    overlayVisible?: boolean;
  };

  let {
    config,
    is3DType,
    schedulePreviewRender,
    clearPreviewSettleTimer,
    canvasContainer = $bindable(null),
    canvasHost = $bindable(null),
    cameraDragActive = $bindable(false),
    settingsMaximized = $bindable(false),
    overlayVisible = $bindable(false)
  }: Props = $props();

  const CAMERA_DISTANCE_MIN = 5;
  const CAMERA_DISTANCE_MAX = 50;
  const CAMERA_ELEVATION_MIN = -80;
  const CAMERA_ELEVATION_MAX = 80;
  const OVERLAY_IDLE_MS = 800;

  let camDragPointerId = -1;
  let camDragStartX = 0;
  let camDragStartY = 0;
  let camDragStartAzimuth = 0;
  let camDragStartElevation = 0;
  let overlayTimer: ReturnType<typeof setTimeout> | null = null;

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function wrapDeg360(deg: number): number {
    const d = deg % 360;
    return d < 0 ? d + 360 : d;
  }

  function bumpOverlay() {
    overlayVisible = true;
    if (overlayTimer) window.clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(() => {
      if (!cameraDragActive) overlayVisible = false;
    }, OVERLAY_IDLE_MS);
  }

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
    bumpOverlay();
    if (!is3DType) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.preview-overlay') || target?.closest?.('[data-settings-overlay]')) return;

    cameraDragActive = true;
    camDragPointerId = e.pointerId;
    camDragStartX = e.clientX;
    camDragStartY = e.clientY;
    camDragStartAzimuth = config.camera.azimuth;
    camDragStartElevation = config.camera.elevation;

    clearPreviewSettleTimer();

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore.
    }
    e.preventDefault();
  }

  function handleCanvasPointerMove(e: PointerEvent) {
    bumpOverlay();
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
    bumpOverlay();
    if (!is3DType) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.preview-overlay') || target?.closest?.('[data-settings-overlay]')) return;

    // Smooth, multiplicative zoom.
    const factor = Math.pow(1.0015, e.deltaY);
    const next = clamp(config.camera.distance * factor, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
    config.camera.distance = next;
    e.preventDefault();
  }

  $effect(() => {
    if (!settingsMaximized) return;
    const handleMove = () => bumpOverlay();
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  });

  $effect(() => {
    if (!cameraDragActive) return;
    overlayVisible = true;
  });

  onDestroy(() => {
    if (overlayTimer) window.clearTimeout(overlayTimer);
  });
</script>

<main class="preview-area">
  <div
    bind:this={canvasContainer}
    class="canvas-container"
    role="application"
    aria-label="Preview canvas"
    style={`background: ${config.backgroundColor}`}
    onpointerdown={handleCanvasPointerDown}
    onpointermove={handleCanvasPointerMove}
    onpointerup={handleCanvasPointerUp}
    onpointercancel={handleCanvasPointerUp}
    onwheel={handleCanvasWheel}
  >
    <div bind:this={canvasHost} class="canvas-host"></div>

    <div class="preview-overlay fullscreen-toggle" class:visible={overlayVisible} aria-hidden={!overlayVisible}>
      <button
        type="button"
        class="fullscreen-btn"
        onclick={() => {
          settingsMaximized = !settingsMaximized;
        }}
        title={settingsMaximized ? 'Minimize settings' : 'Maximize settings'}
        aria-pressed={settingsMaximized}
      >
        {#if settingsMaximized}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m14 10 7-7" />
            <path d="M20 10h-6V4" />
            <path d="m3 21 7-7" />
            <path d="M4 14h6v6" />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 3h6v6" />
            <path d="m21 3-7 7" />
            <path d="m3 21 7-7" />
            <path d="M9 21H3v-6" />
          </svg>
        {/if}
      </button>
    </div>

    {#if is3DType}
      <div
        class="preview-overlay camera-overlay"
        class:visible={overlayVisible || cameraDragActive}
        aria-hidden={!(overlayVisible || cameraDragActive)}
      >
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
