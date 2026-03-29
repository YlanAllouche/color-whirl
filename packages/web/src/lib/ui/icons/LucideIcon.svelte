<script lang="ts">
  import { onMount } from 'svelte';
  import { getProviderIconPreviewSvg } from '$lib/icons/iconify';

  type Props = {
    name: string;
    size?: number;
    class?: string;
    title?: string;
  };

  let { name, size = 18, class: className, title }: Props = $props();

  let svg = $state<string>('');

  onMount(() => {
    let cancelled = false;
    void getProviderIconPreviewSvg('lucide', name, size)
      .then((markup) => {
        if (cancelled) return;
        svg = markup;
      })
      .catch(() => {
        if (cancelled) return;
        svg = '';
      });

    return () => {
      cancelled = true;
    };
  });
</script>

<span class={className} aria-hidden={title ? undefined : 'true'} title={title}>
  {@html svg}
</span>
