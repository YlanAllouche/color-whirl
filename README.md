# ColorWhirl

ColorWhirl generates wallpaper images from structured recipes.

You can use it in three ways:

- Web editor (standalone SvelteKit shell)
- Reusable editor component (`@wallpaper-maker/editor-core`)
- CLI (`colorwhirl`) for scripted generation

## Quickstart

### One-time CLI usage (no install)

```bash
npx colorwhirl --config '{"type":"popsicle","width":1920,"height":1080,"colors":["#111827","#2563eb","#22d3ee"]}' --output wallpaper.png
```

### Global CLI install

```bash
npm i -g colorwhirl
colorwhirl --config @config.json --output wallpaper.png
```

### From this repository

```bash
pnpm install
pnpm -F @wallpaper-maker/core build
pnpm -F @wallpaper-maker/editor-core build
pnpm -F @wallpaper-maker/cli build
pnpm -F @wallpaper-maker/web dev
```

## CLI Config Input Modes

`--config` supports:

- Base64url app state payload (`?cfg=` compatible)
- Inline JSON object (recipe or full app state)
- JSON file path
- Forced file mode with `@` prefix

Examples:

```bash
colorwhirl --config @wallpaper.json --output out.png
colorwhirl --config '{"v":1,"c":{"type":"svg2d"},"f":"png","m":"raster"}'
colorwhirl generate --config @wallpaper.json
```

## Shareable Web Links (`?cfg=`)

The standalone web shell stores editor state in the `cfg` URL parameter.

- Copy a URL from the web app to share a specific recipe
- Pass the same payload to CLI with `--config`

## Practical Pipeline Example (pywal/matugen style)

```bash
colorwhirl --config @recipe.json --output "$HOME/.cache/current-wallpaper.png"
wal -i "$HOME/.cache/current-wallpaper.png"
```

For Ansible/template automation, render with CLI first, then use your existing template role to propagate palette values.

## Docs

- LLM usage guide: `docs/llm_consumer.md`
- Editor embedding API: `docs/embedding.md`
- Config schema: `packages/core/schema/wallpaper-config.v1.schema.json`
