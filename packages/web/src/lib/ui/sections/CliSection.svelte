<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type Props = {
    cliCommand: string;
    copyCliCommand: () => void;
    cliViewMode: 'bash' | 'json';
  };

  let { cliCommand, copyCliCommand, cliViewMode = $bindable() }: Props = $props();
</script>

<CollapsiblePanel id="share" title="Share / CLI" icon="terminal" defaultOpen={false}>
  <div class="cli-controls">
    <textarea class="cli-text" readonly rows={cliViewMode === 'json' ? 10 : 4}>{cliCommand}</textarea>
    <div class="cli-buttons">
      <button
        class="cli-toggle"
        onclick={() => {
          cliViewMode = cliViewMode === 'bash' ? 'json' : 'bash';
        }}
        title={cliViewMode === 'bash' ? 'Show raw JSON' : 'Show bash command'}
        type="button"
      >
        {cliViewMode === 'bash' ? 'JSON' : 'Bash'}
      </button>
      <button class="cli-copy" onclick={copyCliCommand} type="button">Copy</button>
    </div>
  </div>
</CollapsiblePanel>
