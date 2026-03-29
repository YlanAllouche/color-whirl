import type { FallbackQuality } from './renderers.js';

export type PreviewScheduler = {
  schedulePreviewRender: () => void;
  clearSettleTimer: () => void;
  dispose: () => void;
};

export function createPreviewScheduler(input: {
  renderCurrentOnce: (quality: FallbackQuality, opts?: { cameraOnly?: boolean }) => void;
  getCollisionDragActive: () => boolean;
  getCameraDragActive: () => boolean;
  settleMs?: number;
}): PreviewScheduler {
  let renderRaf = 0;
  let renderSettleTimer = 0;

  const settleMs = Math.max(0, Math.round(input.settleMs ?? 280));

  const clearSettleTimer = () => {
    if (typeof window === 'undefined') return;
    if (renderSettleTimer) window.clearTimeout(renderSettleTimer);
    renderSettleTimer = 0;
  };

  const schedulePreviewRender = () => {
    if (typeof window === 'undefined') return;

    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(() => {
      input.renderCurrentOnce('interactive', { cameraOnly: input.getCameraDragActive() });
    });

    clearSettleTimer();

    if (!input.getCollisionDragActive() && !input.getCameraDragActive()) {
      renderSettleTimer = window.setTimeout(() => {
        input.renderCurrentOnce('final');
      }, settleMs);
    }
  };

  const dispose = () => {
    if (typeof window === 'undefined') return;
    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = 0;
    clearSettleTimer();
  };

  return { schedulePreviewRender, clearSettleTimer, dispose };
}
