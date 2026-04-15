# Embedding the Editor Core

`@wallpaper-maker/editor-core` exposes a reusable editor component and a custom-element registration helper.

## Component API

### Props

- `recipe: WallpaperConfig | null`
- `mode: 'standalone' | 'embedded'`
- `readonly: boolean`
- `initialMeta: Record<string, unknown>`

### Events

- `change`: emits `{ recipe, mode }` when recipe changes
- `submit`: emits `{ recipe, meta }` when `submit()` is called
- `error`: emits `{ message }` on render failures

### Methods

- `submit()`
- `getRecipe()`

## Svelte Host Example

```svelte
<script lang="ts">
  import { ColorwhirlEditor } from '@wallpaper-maker/editor-core';
  let recipe = null;

  function onChange(event) {
    recipe = event.detail.recipe;
  }

  function onSubmit(event) {
    fetch('/api/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event.detail)
    });
  }
</script>

<ColorwhirlEditor mode="embedded" {recipe} on:change={onChange} on:submit={onSubmit} />
```

## Custom Element Host Example

```ts
import { registerColorwhirlEditorElement } from '@wallpaper-maker/editor-core';

registerColorwhirlEditorElement();

const el = document.createElement('colorwhirl-editor');
el.setAttribute('mode', 'embedded');
el.recipe = {
  type: 'popsicle',
  width: 1920,
  height: 1080,
  colors: ['#111827', '#2563eb', '#22d3ee']
};

el.addEventListener('change', (e) => {
  console.log('recipe changed', e.detail.recipe);
});

document.body.appendChild(el);
```

## Recipe Payload Shape

- Use `WallpaperConfig` from `@wallpaper-maker/core`
- Keep unknown fields allowed for forward compatibility
- Prefer schema validation: `packages/core/schema/wallpaper-config.v1.schema.json`
