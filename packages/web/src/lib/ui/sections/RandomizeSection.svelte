<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type RandomizationProfile = 'safe' | 'exploratory';

  type Props = {
    generateRandomGeneratedColors: () => void;
    generateRandomIncludingType: () => void;
    randomizationProfile: RandomizationProfile;
  };

  let {
    generateRandomGeneratedColors,
    generateRandomIncludingType,
    randomizationProfile = $bindable('safe')
  }: Props = $props();

  const profileOptions = [
    { value: 'safe', label: 'Safe' },
    { value: 'exploratory', label: 'Exploratory' }
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

  <div class="randomize-buttons">
    <button
      type="button"
      onclick={generateRandomGeneratedColors}
      title="Randomize all settings, generate a new non-preset color theme using the selected camera profile"
    >
      current
    </button>
    <button
      type="button"
      onclick={generateRandomIncludingType}
      title="Randomize all settings and generator type (keeps resolution/geometry quality) using the selected camera profile"
    >
      all
    </button>
  </div>
</CollapsiblePanel>
