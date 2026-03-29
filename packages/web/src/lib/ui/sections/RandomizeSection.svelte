<script lang="ts">
  type Props = {
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
  };

  let { generateRandomGeneratedColors, generateRandomIncludingType }: Props = $props();
</script>

<section class="control-section">
  <h3>Randomize</h3>
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
</section>
