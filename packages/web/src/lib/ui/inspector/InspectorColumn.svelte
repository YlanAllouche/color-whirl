<script lang="ts">
  import { onMount } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';
  import { readLocalStorageNumber, writeLocalStorageNumber } from '$lib/ui/prefs/storage';
  import { filterDom } from '$lib/ui/inspector/filterDom';

  type Props = {
    id: string;
    title: string;
    icon: string;
    defaultColumns?: 1 | 2;
    columns?: 1 | 2;
    searchPlaceholder?: string;
    searchQuery?: string;
    showSearch?: boolean;
    showColumnsToggle?: boolean;
  };

  let {
    id,
    title,
    icon,
    defaultColumns = 1,
    columns = $bindable(defaultColumns),
    searchPlaceholder = 'Search settings…',
    searchQuery = $bindable(''),
    showSearch = true,
    showColumnsToggle = true
  }: Props = $props();

  type SearchStats = {
    query: string;
    matches: number;
    panels: number;
    details: number;
    rows: number;
  };

  let searchStats = $state<SearchStats>({
    query: '',
    matches: 0,
    panels: 0,
    details: 0,
    rows: 0
  });

  let hasQuery = $derived(searchStats.query.length > 0);
  let hasResults = $derived(searchStats.matches > 0);

  const colsKey = $derived(`ui.inspector.${id}.columns`);

  onMount(() => {
    const stored = readLocalStorageNumber(colsKey);
    if (stored === 1 || stored === 2) columns = stored;
  });

  $effect(() => {
    writeLocalStorageNumber(colsKey, columns);
  });
</script>

<aside class="inspector" data-inspector={id}>
  <div class="inspector-top">
    <div class="inspector-title">
      <LucideIcon name={icon} size={18} class="inspector-title-icon" title={title} />
      <h2>{title}</h2>
    </div>

    <div class="inspector-tools">
      {#if showSearch}
        <label class="inspector-search">
          <LucideIcon name="search" size={16} class="inspector-search-icon" />
          <input
            type="search"
            bind:value={searchQuery}
            placeholder={searchPlaceholder}
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
      {:else}
        <div class="inspector-search" aria-hidden="true"></div>
      {/if}

      {#if hasQuery}
        <div class="inspector-search-meta" aria-live="polite">
          {searchStats.matches} match{searchStats.matches === 1 ? '' : 'es'}
        </div>
      {/if}

      {#if showColumnsToggle}
        <button
          type="button"
          class="inspector-cols"
          title={columns === 2 ? 'Single column' : 'Two columns'}
          onclick={() => {
            columns = columns === 2 ? 1 : 2;
          }}
        >
          <LucideIcon name={columns === 2 ? 'columns-2' : 'columns'} size={16} />
        </button>
      {/if}
    </div>
  </div>

  <div
    class="inspector-scroll"
    use:filterDom={{
      query: searchQuery,
      onStats: (stats) => {
        searchStats = stats;
      }
    }}
  >
    <div class="inspector-content inspector-content-scroll" class:cols2={columns === 2}>
      {#if hasQuery && !hasResults}
        <div class="inspector-empty" role="status">No matching settings.</div>
      {/if}
      <slot />
    </div>
  </div>
</aside>
