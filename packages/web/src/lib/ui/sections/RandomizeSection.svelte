<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type RandomizationProfile = 'safe' | 'exploratory';
  type PaletteRandomizeScheme = 'auto' | 'analogous' | 'triadic' | 'complementary' | 'split-complementary' | 'hue-between';

  type Props = {
    generateRandomColorsOnly: () => void;
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
    randomizationProfile: RandomizationProfile;
    paletteRandomizeScheme: PaletteRandomizeScheme;
    paletteRandomizeHueBetweenSteps: number | null;
  };

  let {
    generateRandomColorsOnly,
    generateRandomGeneratedColors,
    generateRandomIncludingType,
    randomizationProfile = $bindable('safe'),
    paletteRandomizeScheme = $bindable('auto'),
    paletteRandomizeHueBetweenSteps = $bindable(null)
  }: Props = $props();

  const profileOptions = [
    { value: 'safe', label: 'Safe' },
    { value: 'exploratory', label: 'Exploratory' }
  ];

  const paletteSchemeOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'analogous', label: 'Analogous' },
    { value: 'triadic', label: 'Triadic' },
    { value: 'complementary', label: 'Complementary' },
    { value: 'split-complementary', label: 'Split-complementary' },
    { value: 'hue-between', label: 'Hue-between' }
  ];
</script>

<CollapsiblePanel
  id="randomize"
  title="Randomize"
  icon="dice-5"
  defaultOpen={true}
  searchKeys="shuffle random exploratory safe"
>
  <label class="control-row">
    <span class="setting-title">Camera profile</span>
    <Dropdown bind:value={randomizationProfile} options={profileOptions} ariaLabel="Randomization camera profile" />
  </label>

  <label class="control-row">
    <span class="setting-title">Palette scheme</span>
    <Dropdown bind:value={paletteRandomizeScheme} options={paletteSchemeOptions} ariaLabel="Palette randomization scheme" />
  </label>

  {#if paletteRandomizeScheme === 'hue-between'}
    <label class="control-row">
      <span class="setting-title">Hue-between steps</span>
      <input
        type="number"
        min="2"
        max="24"
        value={paletteRandomizeHueBetweenSteps ?? ''}
        placeholder="Palette length"
        oninput={(event) => {
          const raw = Number((event.currentTarget as HTMLInputElement).value);
          paletteRandomizeHueBetweenSteps = Number.isFinite(raw) && raw >= 2 ? Math.round(raw) : null;
        }}
      />
    </label>
  {/if}

  <div class="randomize-buttons">
    <button
      type="button"
      onclick={generateRandomColorsOnly}
      title="Randomize only palette and background using the selected palette scheme"
    >
      colors
    </button>
    <button
      type="button"
      onclick={generateRandomGeneratedColors}
      title="Randomize current generator using selected camera profile and palette scheme"
    >
      current
    </button>
    <button
      type="button"
      onclick={generateRandomIncludingType}
      title="Randomize all settings and generator type using selected camera profile and palette scheme"
    >
      all
    </button>
  </div>
</CollapsiblePanel>
