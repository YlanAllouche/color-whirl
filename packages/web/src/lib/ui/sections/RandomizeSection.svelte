<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
  };

  let { generateRandomGeneratedColors, generateRandomIncludingType }: Props = $props();
</script>

<CollapsiblePanel
  id="randomize"
  title="Randomize"
  icon="dice-5"
  defaultOpen={true}
  searchKeys="shuffle random"
>
  <div class="randomize-buttons">
    <button
      type="button"
      onclick={generateRandomGeneratedColors}
      title="Randomize all settings, generate a new non-preset color theme"
    >
      current
    </button>
    <button
      type="button"
      onclick={generateRandomIncludingType}
      title="Randomize all settings and generator type (keeps resolution/geometry quality)"
    >
      all
    </button>
  </div>
</CollapsiblePanel>
