export type PerfActionId = 'randomizeCurrent' | 'randomizeAll' | 'randomizeWidget' | 'export' | 'fitCamera';

export type PerfActionStats = {
  count: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
  lastMs: number;
};

export type PerfBenchmarkState = {
  running: boolean;
  presetLabel: string;
  totalIterations: number;
  completedIterations: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
};

export type PerfState = {
  hudVisible: boolean;
  frameTimeAvgMs: number;
  frameTimeP95Ms: number;
  fpsAvg: number;
  fpsP95: number;
  renderTimeAvgMs: number;
  renderTimeP95Ms: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskSupported: boolean;
  memorySupported: boolean;
  memoryUsedMB: number | null;
  memoryLimitMB: number | null;
  actions: Record<PerfActionId, PerfActionStats>;
  benchmark: PerfBenchmarkState;
};

const DEFAULT_ACTION_STATS: PerfActionStats = {
  count: 0,
  totalMs: 0,
  avgMs: 0,
  p95Ms: 0,
  lastMs: 0
};

export function createDefaultPerfState(hudVisible: boolean): PerfState {
  return {
    hudVisible,
    frameTimeAvgMs: 0,
    frameTimeP95Ms: 0,
    fpsAvg: 0,
    fpsP95: 0,
    renderTimeAvgMs: 0,
    renderTimeP95Ms: 0,
    longTaskCount: 0,
    longTaskTotalMs: 0,
    longTaskSupported: false,
    memorySupported: false,
    memoryUsedMB: null,
    memoryLimitMB: null,
    actions: {
      randomizeCurrent: { ...DEFAULT_ACTION_STATS },
      randomizeAll: { ...DEFAULT_ACTION_STATS },
      randomizeWidget: { ...DEFAULT_ACTION_STATS },
      export: { ...DEFAULT_ACTION_STATS },
      fitCamera: { ...DEFAULT_ACTION_STATS }
    },
    benchmark: {
      running: false,
      presetLabel: '50 iterations',
      totalIterations: 0,
      completedIterations: 0,
      totalMs: 0,
      avgMs: 0,
      p95Ms: 0
    }
  };
}

export function pushSample(samples: number[], value: number, maxSamples: number): void {
  if (!Number.isFinite(value)) return;
  samples.push(value);
  if (samples.length > maxSamples) {
    samples.splice(0, samples.length - maxSamples);
  }
}

export function average(samples: number[]): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (const sample of samples) total += sample;
  return total / samples.length;
}

export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export function sampleStats(samples: number[]): { avg: number; p95: number } {
  return {
    avg: average(samples),
    p95: percentile(samples, 95)
  };
}

export function formatPerfNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}
