<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';
  import { readLocalStorageBool, writeLocalStorageBool } from '$lib/ui/prefs/storage';

  type PanelRandomizeContext = {
    canRandomizeWidget: (widgetId: string) => boolean;
    randomizeWidget: (widgetId: string) => void;
  };

  type Props = {
    id: string;
    title: string;
    icon?: string;
    defaultOpen?: boolean;
    searchKeys?: string;
  };

  let { id, title, icon, defaultOpen = true, searchKeys }: Props = $props();

  const randomizeCtx = getContext<PanelRandomizeContext | undefined>('wm.panelRandomize');

  const storageKey = $derived(`ui.panel.${id}.open`);
  let open = $state(defaultOpen);
  let searchForcedOpen = $state(false);
  let effectiveOpen = $derived(open || searchForcedOpen);
  let showRandomizeButton = $derived(!!randomizeCtx?.canRandomizeWidget(id));

  function searchForcedOpenAction(node: HTMLElement) {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      searchForcedOpen = !!detail;
    };

    node.addEventListener('searchforcedopen', handle);
    return {
      destroy() {
        node.removeEventListener('searchforcedopen', handle);
      }
    };
  }

  onMount(() => {
    const stored = readLocalStorageBool(storageKey);
    if (stored !== null) open = stored;
  });

  $effect(() => {
    writeLocalStorageBool(storageKey, open);
  });
</script>

<section
  class="control-section panel"
  class:open={effectiveOpen}
  data-panel-title={title}
  data-panel-id={id}
  data-panel-open={open}
  data-search-keys={searchKeys}
  use:searchForcedOpenAction
>
  <button
    type="button"
    class="panel-header"
    aria-expanded={effectiveOpen}
    onclick={() => {
      open = !open;
    }}
  >
    {#if icon}
      <LucideIcon name={icon} size={16} class="panel-icon" title={title} />
    {:else}
      <span class="panel-icon panel-icon-empty" aria-hidden="true"></span>
    {/if}
    <span class="panel-title">{title}</span>
    <span class="panel-spacer"></span>
    {#if showRandomizeButton}
      <span
        class="panel-randomize"
        title={`Randomize ${title}`}
        aria-label={`Randomize ${title}`}
        role="button"
        tabindex="0"
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          randomizeCtx?.randomizeWidget(id);
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          randomizeCtx?.randomizeWidget(id);
        }}
      >
        <LucideIcon name="dice-5" size={14} />
      </span>
    {/if}
    <LucideIcon name="chevron-down" size={16} class="panel-chevron" />
  </button>

  {#if effectiveOpen}
    <div class="panel-body">
      <div class="panel-body-inner">
        <slot />
      </div>
    </div>
  {/if}
</section>
