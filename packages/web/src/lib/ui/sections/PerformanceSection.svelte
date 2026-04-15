<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import type { PerfState } from '$lib/app/perf/metrics';

  type Props = {
    performance: PerfState;
    togglePerformanceHud: () => void;
    runBenchmarkIterations: (iterations?: number) => void | Promise<void>;
  };

  let { performance, togglePerformanceHud, runBenchmarkIterations }: Props = $props();
</script>

<CollapsiblePanel id="performance" title="Performance" icon="gauge" defaultOpen={false} searchKeys="performance fps benchmark memory long task">
  <div class="performance-grid">
    <div class="performance-card">
      <div class="performance-label">FPS avg / p95</div>
      <div class="performance-value">{performance.fpsAvg.toFixed(1)} / {performance.fpsP95.toFixed(1)}</div>
    </div>
    <div class="performance-card">
      <div class="performance-label">Frame ms avg / p95</div>
      <div class="performance-value">{performance.frameTimeAvgMs.toFixed(1)} / {performance.frameTimeP95Ms.toFixed(1)}</div>
    </div>
    <div class="performance-card">
      <div class="performance-label">Render ms avg / p95</div>
      <div class="performance-value">{performance.renderTimeAvgMs.toFixed(1)} / {performance.renderTimeP95Ms.toFixed(1)}</div>
    </div>
    <div class="performance-card">
      <div class="performance-label">Long tasks (&gt;50ms)</div>
      <div class="performance-value">
        {#if performance.longTaskSupported}
          {performance.longTaskCount} ({performance.longTaskTotalMs.toFixed(1)}ms)
        {:else}
          Unavailable
        {/if}
      </div>
    </div>
    <div class="performance-card performance-card-wide">
      <div class="performance-label">Memory</div>
      <div class="performance-value">
        {#if performance.memorySupported && performance.memoryUsedMB !== null}
          {performance.memoryUsedMB.toFixed(1)} MB
          {#if performance.memoryLimitMB !== null}
            / {performance.memoryLimitMB.toFixed(1)} MB
          {/if}
        {:else}
          Unavailable in this browser
        {/if}
      </div>
    </div>
  </div>

  <div class="performance-actions">
    <button type="button" onclick={togglePerformanceHud}>{performance.hudVisible ? 'Hide HUD' : 'Show HUD'}</button>
    <button
      type="button"
      disabled={performance.benchmark.running}
      onclick={() => {
        void runBenchmarkIterations(50);
      }}
      title="Run 50 randomize-current iterations"
    >
      {performance.benchmark.running ? `Running (${performance.benchmark.completedIterations}/${performance.benchmark.totalIterations})` : 'Run benchmark (50)'}
    </button>
  </div>

  <div class="performance-benchmark">
    <div class="setting-hint">Benchmark summary</div>
    <div class="performance-inline">
      <span>Total: {performance.benchmark.totalMs.toFixed(1)}ms</span>
      <span>Avg: {performance.benchmark.avgMs.toFixed(1)}ms</span>
      <span>P95: {performance.benchmark.p95Ms.toFixed(1)}ms</span>
    </div>
  </div>

  <details class="control-details">
    <summary class="control-details-summary">Action timings</summary>
    <div class="performance-table">
      <div class="performance-row performance-head">
        <span>Action</span><span>Count</span><span>Avg</span><span>P95</span><span>Last</span>
      </div>
      <div class="performance-row">
        <span>Randomize current</span><span>{performance.actions.randomizeCurrent.count}</span><span>{performance.actions.randomizeCurrent.avgMs.toFixed(1)}</span><span>{performance.actions.randomizeCurrent.p95Ms.toFixed(1)}</span><span>{performance.actions.randomizeCurrent.lastMs.toFixed(1)}</span>
      </div>
      <div class="performance-row">
        <span>Randomize all</span><span>{performance.actions.randomizeAll.count}</span><span>{performance.actions.randomizeAll.avgMs.toFixed(1)}</span><span>{performance.actions.randomizeAll.p95Ms.toFixed(1)}</span><span>{performance.actions.randomizeAll.lastMs.toFixed(1)}</span>
      </div>
      <div class="performance-row">
        <span>Randomize widget</span><span>{performance.actions.randomizeWidget.count}</span><span>{performance.actions.randomizeWidget.avgMs.toFixed(1)}</span><span>{performance.actions.randomizeWidget.p95Ms.toFixed(1)}</span><span>{performance.actions.randomizeWidget.lastMs.toFixed(1)}</span>
      </div>
      <div class="performance-row">
        <span>Export</span><span>{performance.actions.export.count}</span><span>{performance.actions.export.avgMs.toFixed(1)}</span><span>{performance.actions.export.p95Ms.toFixed(1)}</span><span>{performance.actions.export.lastMs.toFixed(1)}</span>
      </div>
      <div class="performance-row">
        <span>Fit camera</span><span>{performance.actions.fitCamera.count}</span><span>{performance.actions.fitCamera.avgMs.toFixed(1)}</span><span>{performance.actions.fitCamera.p95Ms.toFixed(1)}</span><span>{performance.actions.fitCamera.lastMs.toFixed(1)}</span>
      </div>
    </div>
  </details>
</CollapsiblePanel>
