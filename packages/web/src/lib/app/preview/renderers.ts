import type { WallpaperConfig } from '@wallpaper-maker/core';
import { renderWallpaperToCanvas } from '@wallpaper-maker/core';

import type { PopsiclePreview, PreviewRenderMode } from '$lib/popsicle/preview';
import { Basic3DPreview, type Basic3DType } from '$lib/basic3d/preview';

export type FallbackQuality = 'interactive' | 'final';

export type RenderOnceOpts = { cameraOnly?: boolean };

export type PreviewRefs = {
  preview: PopsiclePreview | null;
  basic3dPreview: Basic3DPreview | null;
  fallbackCanvas: HTMLCanvasElement | null;
};

export type PreviewRendererCtx = {
  getConfig: () => WallpaperConfig;
  getRenderMode: () => PreviewRenderMode;
  setRenderError: (msg: string | null) => void;
  canvasContainer: () => HTMLDivElement | null;
  canvasHost: () => HTMLDivElement | null;
  refs: PreviewRefs;
};

export function disposeBasic3DPreview(refs: PreviewRefs): void {
  refs.basic3dPreview?.dispose();
  refs.basic3dPreview = null;
}

function getFallbackPreviewSize(
  canvasContainer: HTMLDivElement | null,
  aspect: number,
  quality: FallbackQuality
): {
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

function ensureBasic3DPreview(refs: PreviewRefs, canvasHost: HTMLDivElement | null, type: Basic3DType): Basic3DPreview {
  if (!canvasHost) {
    // Should not happen; render calls are guarded.
    throw new Error('canvasHost not ready');
  }
  if (!refs.basic3dPreview) {
    refs.basic3dPreview = new Basic3DPreview(canvasHost, type);
    return refs.basic3dPreview;
  }
  refs.basic3dPreview.setType(type);
  return refs.basic3dPreview;
}

function renderBasic3DOnce(
  ctx: PreviewRendererCtx,
  quality: FallbackQuality,
  opts?: RenderOnceOpts
): void {
  const canvasContainer = ctx.canvasContainer();
  const canvasHost = ctx.canvasHost();
  if (!canvasContainer || !canvasHost) return;

  const config = ctx.getConfig();
  const aspect = config.width / config.height;
  const { previewWidth, previewHeight, cssWidth, cssHeight } = getFallbackPreviewSize(canvasContainer, aspect, quality);

  let effective: WallpaperConfig = { ...config } as any;

  // 3D collision masking is expensive; keep interactive renders snappy by previewing without collisions.
  if (quality === 'interactive' && (effective as any).collisions?.mode === 'carve') {
    effective = {
      ...(effective as any),
      collisions: { ...(effective as any).collisions, mode: 'none', carve: { ...(effective as any).collisions.carve } }
    } as any;
  }

  try {
    const type = effective.type as Basic3DType;
    const p = ensureBasic3DPreview(ctx.refs, canvasHost, type);
    p.setMode(ctx.getRenderMode());
    p.renderOnce(effective as any, quality, {
      cameraOnly: !!opts?.cameraOnly,
      renderSize: { width: previewWidth, height: previewHeight }
    });

    const el = p.getDomElement();
    if (el) {
      el.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
      el.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
    }

    ctx.setRenderError(null);
  } catch (err: any) {
    ctx.setRenderError(String(err?.message || err));
    console.error('Render failed:', err);
  }
}

function render2DOnce(ctx: PreviewRendererCtx, quality: FallbackQuality): void {
  const canvasContainer = ctx.canvasContainer();
  const canvasHost = ctx.canvasHost();
  if (!canvasContainer || !canvasHost) return;

  const config = ctx.getConfig();
  const aspect = config.width / config.height;
  const { previewWidth, previewHeight, cssWidth, cssHeight } = getFallbackPreviewSize(canvasContainer, aspect, quality);
  let effective: WallpaperConfig = { ...(config as any), width: previewWidth, height: previewHeight } as any;

  // Performance knobs for heavy 2D generators.
  // We intentionally bias the interactive preview toward responsiveness.
  if (quality === 'interactive' && effective.type === 'flowlines2d') {
    const f: any = (effective as any).flowlines ?? {};
    effective = {
      ...(effective as any),
      flowlines: {
        ...f,
        // Reduce work per frame; final render runs shortly after.
        octaves: Math.max(1, Math.min(2, Math.round(Number(f.octaves) || 1))),
        maxLines: Math.max(0, Math.min(700, Math.round(Number(f.maxLines) || 0))),
        maxSteps: Math.max(1, Math.min(220, Math.round(Number(f.maxSteps) || 0))),
        // Favor fewer streamlines.
        spacingPx: Math.max(Number(f.spacingPx) || 2, 8),
        stepPx: Math.max(Number(f.stepPx) || 0.05, 1.2)
      }
    } as any;
  }

  try {
    const next = renderWallpaperToCanvas(effective, ctx.refs.fallbackCanvas ?? undefined);
    next.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
    next.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
    ctx.refs.fallbackCanvas = next;
    if (!next.parentElement) {
      canvasHost.innerHTML = '';
      canvasHost.appendChild(next);
    }
    ctx.setRenderError(null);
  } catch (err: any) {
    ctx.setRenderError(String(err?.message || err));
    console.error('Render failed:', err);
  }
}

type PopsicleConfig = Extract<WallpaperConfig, { type: 'popsicle' }>;

export function renderCurrentOnce(ctx: PreviewRendererCtx, quality: FallbackQuality, opts?: RenderOnceOpts): void {
  const config = ctx.getConfig();

  if (config.type === 'popsicle') {
    // Popsicle has its own persistent preview.
    if (quality === 'interactive') {
      if ((config as any).collisions?.mode === 'carve' && config.colors.length <= 8) {
        const c = {
          ...(config as any),
          collisions: { ...(config as any).collisions, mode: 'none', carve: { ...(config as any).collisions.carve } }
        } as PopsicleConfig;
        ctx.refs.preview?.setMode(ctx.getRenderMode());
        ctx.refs.preview?.renderOnce(c, 'interactive');
      } else {
        ctx.refs.preview?.setMode(ctx.getRenderMode());
        ctx.refs.preview?.renderOnce(config as PopsicleConfig, 'interactive');
      }
    } else {
      ctx.refs.preview?.setMode(ctx.getRenderMode());
      ctx.refs.preview?.renderOnce(config as PopsicleConfig, 'final');
    }
    return;
  }

  if (config.type === 'spheres3d' || config.type === 'triangles3d' || config.type === 'svg3d') {
    ctx.refs.fallbackCanvas = null;
    renderBasic3DOnce(ctx, quality, opts);
    return;
  }

  // 2D types
  disposeBasic3DPreview(ctx.refs);
  render2DOnce(ctx, quality);
}
