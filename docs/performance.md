# Performance Baseline Scenarios

This document defines repeatable runs for the in-app performance HUD and benchmark mode.

## How To Open Metrics

1. Open the app.
2. In the Global inspector, open the `Performance` panel.
3. Click `Show HUD` to display live metrics over the preview canvas.
4. Optional: run `Run benchmark (50)` to execute the default benchmark preset.

## Baseline Scenarios

Run each scenario for at least 30 seconds, or one `Run benchmark (50)` pass when applicable.

### 1) Default config (sanity baseline)

- Start from a fresh app load.
- Keep render mode on `Raster`.
- Capture:
  - FPS avg / p95
  - Frame ms avg / p95
  - Render ms avg / p95
  - Long task count and total ms

### 2) Heavy generator baseline (flowlines)

- Switch type to `flowlines2d`.
- Push `maxLines`, `maxSteps`, and `octaves` near upper ranges.
- Scrub controls for 10-15 seconds, then let the preview settle.
- Capture the same metrics, then run benchmark mode once.

### 3) 3D path tracing off/on comparison

- Switch type to `svg3d` (or another supported 3D type).
- First run in `Raster` mode and note metrics for 30 seconds.
- Then switch to `Path traced` mode and note metrics for 30 seconds.
- Compare render ms and long-task spikes between both modes.

## Notes

- `performance.memory` is browser-dependent. If unavailable, the HUD and panel display a fallback label.
- Long task tracking requires `PerformanceObserver` long task support.
- Benchmark mode currently uses `50 iterations` as the default preset.
