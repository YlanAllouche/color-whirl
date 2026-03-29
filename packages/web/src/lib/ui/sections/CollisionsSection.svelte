<script lang="ts">
  import type { WallpaperConfig } from '@wallpaper-maker/core';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: WallpaperConfig;
    is3DType: boolean;
    supportsCollisions: boolean;
    isLocked: (path: string) => boolean;
    toggleLock: (path: string) => void;
    clearPreviewSettleTimer: () => void;
    schedulePreviewRender: () => void;
    collisionDragActive: boolean;
  };

  let {
    config,
    is3DType,
    supportsCollisions,
    isLocked,
    toggleLock,
    clearPreviewSettleTimer,
    schedulePreviewRender,
    collisionDragActive = $bindable()
  }: Props = $props();
</script>

{#if supportsCollisions}
  <CollapsiblePanel id="collisions" title="Collisions" icon="scan" defaultOpen={false}>
    <label class="control-row">
      <button
        type="button"
        class="setting-title"
        class:locked={isLocked('collisions.mode')}
        onclick={() => toggleLock('collisions.mode')}
        title="Click to lock/unlock for randomize"
      >
        Mode
      </button>
      <select bind:value={config.collisions.mode} disabled={config.colors.length > 8}>
        <option value="none">None</option>
        <option value="carve">Carve</option>
      </select>
    </label>

    {#if config.colors.length > 8}
      <div style="font-size: 0.75rem; color: #a9a9b3; line-height: 1.2;">
        Collision masking is disabled when the palette has more than 8 colors.
      </div>
    {/if}

    {#if config.collisions.mode === 'carve' && config.colors.length <= 8}
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.direction')}
          onclick={() => toggleLock('collisions.carve.direction')}
          title="Click to lock/unlock for randomize"
        >
          Direction
        </button>
        <select bind:value={config.collisions.carve.direction}>
          <option value="oneWay">One-way</option>
          <option value="twoWay">Two-way</option>
        </select>
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.marginPx')}
          onclick={() => toggleLock('collisions.carve.marginPx')}
          title="Click to lock/unlock for randomize"
        >
          Margin: {Math.round(config.collisions.carve.marginPx)}px
        </button>
        <input
          type="range"
          bind:value={config.collisions.carve.marginPx}
          min="0"
          max="400"
          step="1"
          onpointerdown={() => {
            collisionDragActive = true;
            clearPreviewSettleTimer();
          }}
          onpointerup={() => {
            collisionDragActive = false;
            schedulePreviewRender();
          }}
          onpointercancel={() => {
            collisionDragActive = false;
            schedulePreviewRender();
          }}
        />
      </label>
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.marginPx')}
          onclick={() => toggleLock('collisions.carve.marginPx')}
          title="Click to lock/unlock for randomize"
        >
          Margin (exact)
        </button>
        <input type="number" bind:value={config.collisions.carve.marginPx} min="0" max="2000" step="1" />
      </label>
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.edge')}
          onclick={() => toggleLock('collisions.carve.edge')}
          title="Click to lock/unlock for randomize"
        >
          Edge
        </button>
        <select bind:value={config.collisions.carve.edge}>
          <option value="hard">Hard</option>
          <option value="soft">Soft</option>
        </select>
      </label>
      <label class="control-row slider">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.featherPx')}
          onclick={() => toggleLock('collisions.carve.featherPx')}
          title="Click to lock/unlock for randomize"
        >
          Feather: {Math.round(config.collisions.carve.featherPx)}px
        </button>
        <input
          type="range"
          bind:value={config.collisions.carve.featherPx}
          min="0"
          max="200"
          step="1"
          disabled={config.collisions.carve.edge !== 'soft'}
          onpointerdown={() => {
            collisionDragActive = true;
            clearPreviewSettleTimer();
          }}
          onpointerup={() => {
            collisionDragActive = false;
            schedulePreviewRender();
          }}
          onpointercancel={() => {
            collisionDragActive = false;
            schedulePreviewRender();
          }}
        />
      </label>
      <label class="control-row">
        <button
          type="button"
          class="setting-title"
          class:locked={isLocked('collisions.carve.featherPx')}
          onclick={() => toggleLock('collisions.carve.featherPx')}
          title="Click to lock/unlock for randomize"
        >
          Feather (exact)
        </button>
        <input type="number" bind:value={config.collisions.carve.featherPx} min="0" max="2000" step="1" disabled={config.collisions.carve.edge !== 'soft'} />
      </label>

      {#if is3DType}
        <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
          <label class="control-row">
            <button
              type="button"
              class="setting-title"
              class:locked={isLocked('collisions.carve.finish')}
              onclick={() => toggleLock('collisions.carve.finish')}
              title="Click to lock/unlock for randomize"
            >
              Finish Volume
            </button>
            <select bind:value={config.collisions.carve.finish}>
              <option value="none">None</option>
              <option value="wallsCap">Walls + Cap</option>
            </select>
          </label>

          {#if config.collisions.carve.finish === 'wallsCap'}
            <label class="control-row slider">
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('collisions.carve.finishAutoDepthMult')}
                onclick={() => toggleLock('collisions.carve.finishAutoDepthMult')}
                title="Click to lock/unlock for randomize"
              >
                Depth (auto): {config.collisions.carve.finishAutoDepthMult.toFixed(2)}x
              </button>
              <input type="range" bind:value={config.collisions.carve.finishAutoDepthMult} min="0" max="4" step="0.05" />
            </label>
            <label class="control-row">
              <button
                type="button"
                class="setting-title"
                class:locked={isLocked('collisions.carve.finishAutoDepthMult')}
                onclick={() => toggleLock('collisions.carve.finishAutoDepthMult')}
                title="Click to lock/unlock for randomize"
              >
                Depth (auto, exact)
              </button>
              <input type="number" bind:value={config.collisions.carve.finishAutoDepthMult} min="0" max="20" step="0.05" />
            </label>
          {/if}
        </div>
      {/if}
      <div style="font-size: 0.75rem; color: #a9a9b3; line-height: 1.2;">
        One-way priority is based on palette weights: higher weight carves lower.
      </div>
    {/if}
  </CollapsiblePanel>
{/if}
