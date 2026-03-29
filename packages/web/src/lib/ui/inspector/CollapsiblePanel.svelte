<script lang="ts">
  import { onMount } from 'svelte';
  import LucideIcon from '$lib/ui/icons/LucideIcon.svelte';
  import { readLocalStorageBool, writeLocalStorageBool } from '$lib/ui/prefs/storage';

  type Props = {
    id: string;
    title: string;
    icon?: string;
    defaultOpen?: boolean;
  };

  let { id, title, icon, defaultOpen = true }: Props = $props();

  const storageKey = $derived(`ui.panel.${id}.open`);
  let open = $state(defaultOpen);

  onMount(() => {
    const stored = readLocalStorageBool(storageKey);
    if (stored !== null) open = stored;
  });

  $effect(() => {
    writeLocalStorageBool(storageKey, open);
  });
</script>

<section class="control-section panel" class:open data-panel-title={title} data-panel-id={id}>
  <button
    type="button"
    class="panel-header"
    aria-expanded={open}
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
    <LucideIcon name="chevron-down" size={16} class="panel-chevron" />
  </button>

  <div class="panel-body">
    <div class="panel-body-inner">
      <slot />
    </div>
  </div>
</section>
