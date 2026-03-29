<script lang="ts">
  type Props = {
    cliCommand: string;
    copyCliCommand: () => void;
    cliViewMode: 'bash' | 'json';
  };

  let { cliCommand, copyCliCommand, cliViewMode = $bindable() }: Props = $props();
</script>

<section class="control-section">
  <h3>CLI</h3>
  <div class="cli-controls">
    <textarea class="cli-text" readonly rows={cliViewMode === 'json' ? 10 : 4}>{cliCommand}</textarea>
    <div class="cli-buttons">
      <button
        class="cli-toggle"
        onclick={() => {
          cliViewMode = cliViewMode === 'bash' ? 'json' : 'bash';
        }}
        title={cliViewMode === 'bash' ? 'Show raw JSON' : 'Show bash command'}
      >
        {cliViewMode === 'bash' ? 'JSON' : 'Bash'}
      </button>
      <button class="cli-copy" onclick={copyCliCommand}>Copy</button>
    </div>
  </div>
</section>
