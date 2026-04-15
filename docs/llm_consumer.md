# ColorWhirl LLM Consumer Guide

This guide is for LLM agents that produce ColorWhirl recipes.

## Objective

Generate visually strong wallpapers while avoiding brittle or overfit configurations.

## Type Selection Heuristics

- `popsicle`: iconic stacked 3D sticks, strong for bold color palettes
- `spheres3d`: soft clustered geometry, good for smooth gradients
- `triangles3d`: faceted geometric look
- `hexgrid2d` / `diamondgrid2d`: structured geometric backgrounds
- `flowlines2d` / `ridges2d`: organic line-heavy visuals
- `svg2d` / `svg3d`: icon/logo-driven compositions

## Safe Generation Defaults

- Keep color count between 3 and 7 for broad compatibility
- Avoid high simultaneous intensity across bloom + emission + heavy texture overrides
- Use palette overrides sparingly; start with 0-2 targeted overrides
- Prefer `camera.mode: auto` unless explicit framing is requested
- Clamp output resolution to practical ranges (1080p, 1440p, 4K)

## Recipe Construction Pattern

1. Choose `type`.
2. Set `width`, `height`, `colors`, `backgroundColor`.
3. Add one style axis at a time (geometry, then material, then effects).
4. Validate against schema.
5. Render once, then iterate with small deltas.

## Anti-patterns

- Turning on every effect block simultaneously
- Very high instance counts with path tracing for interactive preview
- Large random jumps in multiple nested subtrees at once
- Hardcoding old or removed fields when schema marks them unknown

## Minimal Example

```json
{
  "type": "popsicle",
  "seed": 42,
  "width": 1920,
  "height": 1080,
  "colors": ["#0f172a", "#2563eb", "#22d3ee", "#f97316"],
  "backgroundColor": "#020617",
  "stickCount": 12,
  "stickOverhang": 28
}
```

## CLI Roundtrip

```bash
colorwhirl --config @recipe.json --output out.png
```

The same recipe can be embedded in web links through the base64url `cfg` state payload.
