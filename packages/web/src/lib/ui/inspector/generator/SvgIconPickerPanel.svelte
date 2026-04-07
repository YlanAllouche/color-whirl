<script lang="ts">
  import IconPicker from '$lib/icons/IconPicker.svelte';
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    config: any;
    schedulePreviewRender: () => void;
  };

  let { config, schedulePreviewRender }: Props = $props();
</script>

<CollapsiblePanel id="svg-icons" title="Icon Picker" icon="stamp" defaultOpen={false} searchKeys="symbols">
  <IconPicker
    onPick={(svg) => {
      config.svg = { ...config.svg, source: svg, renderMode: 'auto' };
      schedulePreviewRender();
    }}
  />
</CollapsiblePanel>
