<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';

  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

  type Props = {
    exportFormat: ExportFormat;
    isExporting: boolean;
    handleExport: () => void | Promise<void>;
  };

  let { exportFormat = $bindable(), isExporting, handleExport }: Props = $props();
</script>

<CollapsiblePanel id="export" title="Export" icon="download" defaultOpen={true}>
  <div class="export-controls">
    <select bind:value={exportFormat}>
      <option value="png">PNG</option>
      <option value="jpg">JPG</option>
      <option value="webp">WebP</option>
      <option value="svg">SVG</option>
    </select>
    <button type="button" onclick={handleExport} disabled={isExporting}>{isExporting ? 'Exporting...' : 'Export'}</button>
  </div>
</CollapsiblePanel>
