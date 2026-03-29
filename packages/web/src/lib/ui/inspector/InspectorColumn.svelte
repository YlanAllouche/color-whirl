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
    searchPlaceholder?: string;
  };

  let { id, title, icon, defaultColumns = 1, searchPlaceholder = 'Search settings…' }: Props = $props();

  let search = $state('');
  const colsKey = $derived(`ui.inspector.${id}.columns`);
  let columns = $state<1 | 2>(defaultColumns);

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
      <label class="inspector-search">
        <LucideIcon name="search" size={16} class="inspector-search-icon" />
        <input
          type="search"
          bind:value={search}
          placeholder={searchPlaceholder}
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
        />
      </label>

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
    </div>
  </div>

  <div class="inspector-scroll" use:filterDom={search}>
    <div class="inspector-content" class:cols2={columns === 2}>
      <slot />
    </div>
  </div>
</aside>
