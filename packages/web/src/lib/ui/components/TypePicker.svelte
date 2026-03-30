<script lang="ts">
  import type { WallpaperType } from '@wallpaper-maker/core';
  import { onDestroy } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';

  type Option = { value: WallpaperType; label: string };

  type Props = {
    value: WallpaperType;
    options: Option[];
    onChange: (next: WallpaperType) => void;
  };

  let { value, options, onChange }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | null = $state(null);

  function close() {
    open = false;
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (root && root.contains(t)) return;
    close();
  }

  function onDocKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown);
    onDestroy(() => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onDocKeyDown);
    });
  }

  const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? String(value));
</script>

<div class="type-picker" bind:this={root}>
  <button
    type="button"
    class="type-picker-btn"
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={() => {
      open = !open;
    }}
  >
    <span class="type-picker-label">{selectedLabel}</span>
    <span class="chev" class:open={open} aria-hidden="true">
      <LucideIcon name="chevron-down" size={16} />
    </span>
  </button>

  {#if open}
    <div class="type-picker-pop" role="listbox" aria-label="Wallpaper type">
      {#each options as opt}
        <button
          type="button"
          class="type-picker-item"
          class:active={opt.value === value}
          role="option"
          aria-selected={opt.value === value}
          onclick={() => {
            onChange(opt.value);
            close();
          }}
        >
          <span>{opt.label}</span>
          {#if opt.value === value}
            <LucideIcon name="check" size={16} />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .type-picker {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .type-picker-btn {
    width: 100%;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--stroke0);
    background: rgba(20, 20, 22, 0.4);
    color: var(--text0);
    cursor: pointer;
    outline: none;
  }

  .type-picker-btn:hover {
    border-color: var(--stroke1);
  }

  .type-picker-btn:focus-visible {
    border-color: var(--accent-stroke);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.16);
  }

  .type-picker-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .chev {
    opacity: 0.8;
    transition: transform 140ms ease;
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .type-picker-pop {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 50;
    border-radius: var(--radius-sm);
    border: 1px solid var(--stroke0);
    background: rgba(12, 12, 14, 0.96);
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
    padding: 0.25rem;
    max-height: min(56vh, 520px);
    overflow: auto;
  }

  .type-picker-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text0);
    cursor: pointer;
  }

  .type-picker-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .type-picker-item.active {
    border-color: var(--accent-stroke);
    background: var(--accent-soft);
  }
</style>
