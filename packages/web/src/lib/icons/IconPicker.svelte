<script lang="ts">
  import { onMount, tick } from 'svelte';

  import {
    ICON_PROVIDER_IDS,
    getIconProviderMeta,
    getProviderIconPreviewSvg,
    getProviderIconSvg,
    listProviderIcons,
    type IconProviderId
  } from '$lib/icons/iconify';

  type IconEntry = { providerId: IconProviderId; name: string };
  type ProviderEnabledMap = Record<IconProviderId, boolean>;

  const INLINE_LIMIT = 200;
  const EXPANDED_LIMIT = 1000;

  const ALL_ENABLED = ICON_PROVIDER_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as ProviderEnabledMap);

  let { onPick } = $props<{ onPick: (svg: string) => void }>();

  let search = $state('');
  let enabledProviders = $state<ProviderEnabledMap>({ ...ALL_ENABLED });

  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let loadFailures = $state<Array<{ providerId: IconProviderId; message: string }>>([]);

  let allIcons = $state<IconEntry[]>([]);

  let pickError = $state<string | null>(null);
  let previewCache = $state<Record<string, string>>({});
  let previewLoading = $state<Record<string, boolean>>({});

  const entryByNode = new WeakMap<Element, IconEntry>();
  const observerByRoot = new WeakMap<Element, IntersectionObserver>();
  let viewportObserver: IntersectionObserver | null = null;

  let expanded = $state(false);
  let dialogEl: HTMLDialogElement | null = null;
  let expandedSearchEl: HTMLInputElement | null = null;

  function cacheKey(entry: IconEntry): string {
    return `${entry.providerId}:${entry.name}`;
  }

  async function loadAllProviders(): Promise<void> {
    loading = true;
    loadError = null;
    loadFailures = [];

    try {
      const results = await Promise.allSettled(ICON_PROVIDER_IDS.map((providerId) => listProviderIcons(providerId)));

      const merged: IconEntry[] = [];
      const failures: Array<{ providerId: IconProviderId; message: string }> = [];

      results.forEach((r, idx) => {
        const providerId = ICON_PROVIDER_IDS[idx];
        if (r.status === 'fulfilled') {
          for (const name of r.value) merged.push({ providerId, name });
          return;
        }

        const reason: any = r.reason;
        failures.push({ providerId, message: String(reason?.message || reason) });
      });

      merged.sort((a, b) => {
        const n = a.name.localeCompare(b.name);
        if (n !== 0) return n;
        return a.providerId.localeCompare(b.providerId);
      });

      allIcons = merged;
      loadFailures = failures;
    } catch (err: any) {
      loadError = String(err?.message || err);
      allIcons = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadAllProviders();
  });

  function toggleProvider(providerId: IconProviderId) {
    enabledProviders = { ...enabledProviders, [providerId]: !enabledProviders[providerId] };
  }

  function setAllProviders(enabled: boolean) {
    enabledProviders = ICON_PROVIDER_IDS.reduce((acc, id) => {
      acc[id] = enabled;
      return acc;
    }, {} as ProviderEnabledMap);
  }

  let effectiveLimit = $derived(expanded ? EXPANDED_LIMIT : INLINE_LIMIT);

  let filteredIconsInline = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const out: IconEntry[] = [];
    for (const entry of allIcons) {
      if (!enabledProviders[entry.providerId]) continue;
      if (q && !entry.name.toLowerCase().includes(q)) continue;
      out.push(entry);
      if (out.length >= INLINE_LIMIT) break;
    }
    return out;
  });

  let filteredIconsExpanded = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const out: IconEntry[] = [];
    for (const entry of allIcons) {
      if (!enabledProviders[entry.providerId]) continue;
      if (q && !entry.name.toLowerCase().includes(q)) continue;
      out.push(entry);
      if (out.length >= EXPANDED_LIMIT) break;
    }
    return out;
  });

  let prefetchIcons = $derived(expanded ? filteredIconsExpanded : filteredIconsInline);

  let matchCount = $derived.by(() => {
    const q = search.trim().toLowerCase();
    let n = 0;
    for (const entry of allIcons) {
      if (!enabledProviders[entry.providerId]) continue;
      if (q && !entry.name.toLowerCase().includes(q)) continue;
      n++;
    }
    return n;
  });

  $effect(() => {
    // Cheap eager prefetch for the top of the list.
    const first = prefetchIcons.slice(0, 48);
    for (const entry of first) maybeLoadPreview(entry);
  });

  function maybeLoadPreview(entry: IconEntry): void {
    const key = cacheKey(entry);
    if (previewCache[key] || previewLoading[key]) return;

    previewLoading = { ...previewLoading, [key]: true };
    void getProviderIconPreviewSvg(entry.providerId, entry.name, 18)
      .then((svg) => {
        previewCache = { ...previewCache, [key]: svg };
      })
      .catch(() => {
        // Ignore preview failures; picking uses full SVG.
      })
      .finally(() => {
        const next = { ...previewLoading };
        delete next[key];
        previewLoading = next;
      });
  }

  function getObserver(root: Element | null): IntersectionObserver {
    const cb: IntersectionObserverCallback = (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const entry = entryByNode.get(e.target);
        if (!entry) continue;
        maybeLoadPreview(entry);
      }
    };

    if (!root) {
      if (!viewportObserver) {
        viewportObserver = new IntersectionObserver(cb, { root: null, rootMargin: '280px 0px' });
      }
      return viewportObserver;
    }

    const existing = observerByRoot.get(root);
    if (existing) return existing;
    const next = new IntersectionObserver(cb, { root, rootMargin: '280px 0px' });
    observerByRoot.set(root, next);
    return next;
  }

  function observePreview(node: HTMLElement, entry: IconEntry) {
    entryByNode.set(node, entry);
    const root = node.closest('.icon-picker-results');
    const observer = getObserver(root);
    observer.observe(node);

    return {
      destroy() {
        try {
          observer.unobserve(node);
        } catch {
          // Ignore.
        }
        entryByNode.delete(node);
      }
    };
  }

  function getPreviewMarkup(entry: IconEntry): string | null {
    return previewCache[cacheKey(entry)] ?? null;
  }

  async function pick(entry: IconEntry) {
    pickError = null;
    try {
      const svg = await getProviderIconSvg(entry.providerId, entry.name);
      onPick(svg);
      if (expanded) closeExpanded();
    } catch (err: any) {
      pickError = String(err?.message || err);
    }
  }

  function openExpanded() {
    expanded = true;
    if (!dialogEl) return;
    if (!dialogEl.open) dialogEl.showModal();
    void (async () => {
      await tick();
      expandedSearchEl?.focus();
      expandedSearchEl?.select();
    })();
  }

  function closeExpanded() {
    expanded = false;
    if (dialogEl?.open) dialogEl.close();
  }

  function handleDialogCancel(e: Event) {
    // Prevent implicit close so we can keep state in sync.
    e.preventDefault();
    closeExpanded();
  }

  function handleDialogClick(e: MouseEvent) {
    // Backdrop click: event target is the dialog element.
    if (e.target === dialogEl) closeExpanded();
  }

  const providerMeta = $derived(
    ICON_PROVIDER_IDS.map((id) => getIconProviderMeta(id))
  );

  let anyProviderEnabled = $derived.by(() => ICON_PROVIDER_IDS.some((id) => enabledProviders[id]));
</script>

<div class="icon-picker">
  <div class="icon-picker-top">
    <div class="icon-picker-toolbar">
      <label class="control-row icon-search-row">
        <span class="setting-title">Search</span>
        <input type="text" bind:value={search} placeholder="e.g. circle" />
      </label>
      <button type="button" class="icon-expand" onclick={openExpanded} title="Open larger icon picker">
        Expand
      </button>
    </div>

    <div class="icon-provider-filters" aria-label="Icon provider filters">
      <button type="button" class="provider-chip subtle" onclick={() => setAllProviders(true)}>
        All
      </button>
      <button type="button" class="provider-chip subtle" onclick={() => setAllProviders(false)}>
        None
      </button>

      {#each providerMeta as meta}
        <button
          type="button"
          class="provider-chip"
          class:is-on={enabledProviders[meta.id]}
          aria-pressed={enabledProviders[meta.id]}
          onclick={() => toggleProvider(meta.id)}
          title={meta.label}
        >
          <span class={`icon-provider-badge tone-${meta.badgeTone}`}>{meta.shortLabel}</span>
          <span class="provider-chip-label">{meta.label}</span>
        </button>
      {/each}
    </div>

    {#if !anyProviderEnabled}
      <div class="mono icon-picker-status">Enable at least one provider.</div>
    {/if}

    {#if loadError}
      <div class="error-box" style="margin-top:0.5rem;">{loadError}</div>
    {/if}
    {#if pickError}
      <div class="error-box" style="margin-top:0.5rem;">{pickError}</div>
    {/if}
  </div>

  <div
    class="icon-picker-results"
    aria-label="Icon gallery"
  >
    {#if loading}
      <div class="mono icon-picker-status">Loading icons...</div>
    {:else if anyProviderEnabled && filteredIconsInline.length === 0}
      <div class="mono icon-picker-status">No matches for "{search.trim()}".</div>
    {:else}
      {#each filteredIconsInline as entry}
        {@const meta = getIconProviderMeta(entry.providerId)}
        <button
          type="button"
          class="icon-picker-item"
          title={`${entry.name} (${meta.label})`}
          onclick={() => pick(entry)}
          use:observePreview={entry}
        >
          <span class="icon-picker-preview" aria-hidden="true">
            {@html getPreviewMarkup(entry) ?? '<span class="icon-picker-preview-fallback"></span>'}
          </span>
          <span class="icon-picker-copy">
            <span class="mono icon-picker-name">{entry.name}</span>
            <span class="icon-provider-badge tone-subtle">{meta.shortLabel}</span>
          </span>
        </button>
      {/each}
    {/if}
  </div>

  <div class="mono icon-picker-meta">
    Showing {filteredIconsInline.length} / {matchCount} (capped at {INLINE_LIMIT})
  </div>

  <dialog
    bind:this={dialogEl}
    class="icon-picker-dialog"
    oncancel={handleDialogCancel}
    onclick={handleDialogClick}
    onclose={() => {
      expanded = false;
    }}
  >
    <div class="dialog-shell">
      <div class="dialog-head">
        <div class="dialog-title">Icon picker</div>
        <button type="button" class="dialog-close" onclick={closeExpanded} aria-label="Close">
          Close
        </button>
      </div>

      <div class="dialog-body">
        <label class="control-row icon-search-row">
          <span class="setting-title">Search</span>
          <input bind:this={expandedSearchEl} type="text" bind:value={search} placeholder="e.g. circle" />
        </label>

        <div class="icon-provider-filters" aria-label="Icon provider filters">
          <button type="button" class="provider-chip subtle" onclick={() => setAllProviders(true)}>
            All
          </button>
          <button type="button" class="provider-chip subtle" onclick={() => setAllProviders(false)}>
            None
          </button>

          {#each providerMeta as meta}
            <button
              type="button"
              class="provider-chip"
              class:is-on={enabledProviders[meta.id]}
              aria-pressed={enabledProviders[meta.id]}
              onclick={() => toggleProvider(meta.id)}
              title={meta.label}
            >
              <span class={`icon-provider-badge tone-${meta.badgeTone}`}>{meta.shortLabel}</span>
              <span class="provider-chip-label">{meta.label}</span>
            </button>
          {/each}
        </div>

        {#if loadFailures.length > 0}
          <div class="mono icon-picker-status" style="margin-top:0.5rem;">
            Some providers failed to load.
          </div>
        {/if}
        {#if pickError}
          <div class="error-box" style="margin-top:0.5rem;">{pickError}</div>
        {/if}

        <div
          class="icon-picker-results is-expanded"
          aria-label="Icon gallery"
        >
          {#if loading}
            <div class="mono icon-picker-status">Loading icons...</div>
          {:else if anyProviderEnabled && filteredIconsExpanded.length === 0}
            <div class="mono icon-picker-status">No matches for "{search.trim()}".</div>
          {:else}
            {#each filteredIconsExpanded as entry}
              {@const meta = getIconProviderMeta(entry.providerId)}
              <button
                type="button"
                class="icon-picker-item"
                title={`${entry.name} (${meta.label})`}
                onclick={() => pick(entry)}
                use:observePreview={entry}
              >
                <span class="icon-picker-preview" aria-hidden="true">
                  {@html getPreviewMarkup(entry) ?? '<span class="icon-picker-preview-fallback"></span>'}
                </span>
                <span class="icon-picker-copy">
                  <span class="mono icon-picker-name">{entry.name}</span>
                  <span class="icon-provider-badge tone-subtle">{meta.shortLabel}</span>
                </span>
              </button>
            {/each}
          {/if}
        </div>

        <div class="mono icon-picker-meta">
          Showing {filteredIconsExpanded.length} / {matchCount} (capped at {EXPANDED_LIMIT})
        </div>
      </div>
    </div>
  </dialog>
</div>

<style>
  .icon-picker {
    margin-top: 0.5rem;
  }

  .icon-picker-top {
    display: grid;
    gap: 0.5rem;
  }

  .icon-picker-toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: end;
  }

  .icon-search-row {
    margin-bottom: 0;
  }

  .icon-expand {
    height: 36px;
    padding: 0 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--stroke0);
    background: rgba(20, 20, 22, 0.55);
    color: var(--text0);
    cursor: pointer;
  }

  .icon-expand:hover {
    border-color: var(--stroke1);
    background: rgba(255, 255, 255, 0.06);
  }

  .icon-provider-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .provider-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.32rem 0.55rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--stroke0);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text1);
    cursor: pointer;
    user-select: none;
  }

  .provider-chip.subtle {
    padding: 0.32rem 0.6rem;
    color: var(--text2);
  }

  .provider-chip.is-on {
    border-color: var(--accent-stroke);
    background: var(--accent-soft);
    color: var(--text0);
  }

  .provider-chip-label {
    font-size: 0.82rem;
  }

  .icon-provider-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5rem;
    padding: 0.22rem 0.45rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1;
  }

  .icon-provider-badge.tone-blue {
    background: rgba(96, 165, 250, 0.14);
    border-color: rgba(96, 165, 250, 0.35);
    color: #bfdbfe;
  }

  .icon-provider-badge.tone-teal {
    background: rgba(45, 212, 191, 0.14);
    border-color: rgba(45, 212, 191, 0.35);
    color: #99f6e4;
  }

  .icon-provider-badge.tone-green {
    background: rgba(74, 222, 128, 0.14);
    border-color: rgba(74, 222, 128, 0.35);
    color: #bbf7d0;
  }

  .icon-provider-badge.tone-amber {
    background: rgba(251, 191, 36, 0.14);
    border-color: rgba(251, 191, 36, 0.35);
    color: #fde68a;
  }

  .icon-provider-badge.tone-rose {
    background: rgba(251, 113, 133, 0.14);
    border-color: rgba(251, 113, 133, 0.35);
    color: #fecdd3;
  }

  .icon-provider-badge.tone-subtle {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
    color: #a9a9b3;
    min-width: 2.2rem;
  }

  .icon-picker-results {
    margin-top: 0.5rem;
    max-height: 320px;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.55rem;
    padding: 0.1rem;
  }

  .icon-picker-results.is-expanded {
    max-height: min(62vh, 720px);
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }

  .icon-picker-status {
    opacity: 0.75;
    padding: 0.35rem 0.1rem;
  }

  .icon-picker-item {
    width: 100%;
    min-height: 88px;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.55rem;
    padding: 0.7rem 0.55rem 0.65rem;
    border-radius: 10px;
    border: 1px solid var(--stroke0);
    background: rgba(20, 20, 22, 0.55);
    color: var(--text0);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
  }

  .icon-picker-item:hover,
  .icon-picker-item:focus-visible {
    border-color: var(--stroke1);
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
    box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.12), 0 10px 18px rgba(0, 0, 0, 0.35);
    outline: none;
  }

  .icon-picker-preview {
    width: 2.65rem;
    height: 2.65rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text0);
  }

  .icon-picker-preview :global(svg) {
    width: 18px;
    height: 18px;
    display: block;
  }

  .icon-picker-preview-fallback {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
  }

  .icon-picker-copy {
    min-width: 0;
    width: 100%;
    display: grid;
    justify-items: center;
    gap: 0.4rem;
  }

  .icon-picker-name {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-picker-meta {
    margin-top: 0.5rem;
    opacity: 0.7;
    line-height: 1.45;
  }

  .icon-picker-dialog {
    padding: 0;
    border: 1px solid var(--stroke0);
    border-radius: 12px;
    background: rgba(12, 12, 14, 0.96);
    color: var(--text0);
    width: min(1080px, 92vw);
  }

  .icon-picker-dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }

  .dialog-shell {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem;
  }

  .dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .dialog-title {
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .dialog-close {
    height: 34px;
    padding: 0 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--stroke0);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text0);
    cursor: pointer;
  }

  .dialog-close:hover {
    border-color: var(--stroke1);
    background: rgba(255, 255, 255, 0.06);
  }

  .dialog-body {
    display: grid;
    gap: 0.6rem;
  }

  @media (max-width: 640px) {
    .icon-picker-toolbar {
      grid-template-columns: 1fr;
    }

    .icon-expand {
      width: 100%;
    }

    .icon-picker-results {
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      max-height: 280px;
    }

    .icon-picker-item {
      min-height: 82px;
      padding-inline: 0.45rem;
    }

    .provider-chip-label {
      display: none;
    }
  }
</style>
