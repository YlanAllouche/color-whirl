<script lang="ts">
  import { onMount } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';
  import { readLocalStorageNumber, writeLocalStorageNumber } from '$lib/ui/prefs/storage';

  type Props = {
    appTitle?: string;
    quickRandomize?: () => void;
    quickExport?: () => void;
  };

  let { appTitle = 'ColorWhirl', quickRandomize, quickExport }: Props = $props();

  const leftKey = 'ui.layout.leftWidth';
  const rightKey = 'ui.layout.rightWidth';

  let leftW = $state(320);
  let rightW = $state(360);

  let mobileOpen = $state(false);
  let mobileTab = $state<'global' | 'look'>('global');

  let resizing = $state<null | 'left' | 'right'>(null);

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  onMount(() => {
    const l = readLocalStorageNumber(leftKey);
    const r = readLocalStorageNumber(rightKey);
    if (l !== null) leftW = clamp(l, 240, 520);
    if (r !== null) rightW = clamp(r, 280, 620);
  });

  $effect(() => {
    writeLocalStorageNumber(leftKey, leftW);
  });
  $effect(() => {
    writeLocalStorageNumber(rightKey, rightW);
  });

  function startResize(which: 'left' | 'right', e: PointerEvent) {
    resizing = which;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizing) return;
    const viewportW = window.innerWidth;
    if (resizing === 'left') {
      const next = clamp(e.clientX, 240, Math.min(520, viewportW - 360));
      leftW = next;
      return;
    }

    const next = clamp(viewportW - e.clientX, 280, Math.min(620, viewportW - 280));
    rightW = next;
  }

  function stopResize() {
    resizing = null;
  }
</script>

<div
  class="editor-shell"
  style={`--left-w:${leftW}px;--right-w:${rightW}px`}
  onpointermove={onResizeMove}
  onpointerup={stopResize}
  onpointercancel={stopResize}
>
  <header class="mobile-topbar">
    <div class="mobile-brand">
      <span class="mobile-dot" aria-hidden="true"></span>
      <span class="mobile-title">{appTitle}</span>
    </div>

    <div class="mobile-actions">
      <button type="button" class="mobile-btn" onclick={quickRandomize} disabled={!quickRandomize} title="Randomize">
        <LucideIcon name="dice-5" size={18} />
      </button>
      <button type="button" class="mobile-btn" onclick={quickExport} disabled={!quickExport} title="Export">
        <LucideIcon name="download" size={18} />
      </button>
      <button
        type="button"
        class="mobile-btn mobile-btn-primary"
        onclick={() => {
          mobileOpen = !mobileOpen;
        }}
        aria-expanded={mobileOpen}
        title="Settings"
      >
        <LucideIcon name={mobileOpen ? 'x' : 'sliders-horizontal'} size={18} />
      </button>
    </div>
  </header>

  <div class="desktop-grid">
    <div class="panel-left">
      <slot name="left" />
    </div>

    <div class="panel-handle" data-handle="left" onpointerdown={(e) => startResize('left', e)} aria-hidden="true"></div>

    <main class="panel-center">
      <slot name="center" />
    </main>

    <div class="panel-handle" data-handle="right" onpointerdown={(e) => startResize('right', e)} aria-hidden="true"></div>

    <div class="panel-right">
      <slot name="right" />
    </div>
  </div>

  <div class="mobile-drawer" class:open={mobileOpen} aria-hidden={!mobileOpen}>
    <div class="mobile-drawer-tabs">
      <button
        type="button"
        class="mobile-tab"
        class:active={mobileTab === 'global'}
        onclick={() => (mobileTab = 'global')}
      >
        <LucideIcon name="wand" size={16} />
        Global
      </button>
      <button type="button" class="mobile-tab" class:active={mobileTab === 'look'} onclick={() => (mobileTab = 'look')}>
        <LucideIcon name="palette" size={16} />
        Look
      </button>
    </div>

    <div class="mobile-drawer-body">
      {#if mobileTab === 'global'}
        <slot name="left" />
      {:else}
        <slot name="right" />
      {/if}
    </div>
  </div>
</div>
