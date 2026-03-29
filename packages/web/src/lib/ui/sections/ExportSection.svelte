<script lang="ts">
  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

  type Props = {
    exportFormat: ExportFormat;
    isExporting: boolean;
    handleExport: () => void | Promise<void>;
  };

  let { exportFormat = $bindable(), isExporting, handleExport }: Props = $props();
</script>

<!-- Export Section -->
<section class="control-section">
  <h3>Export</h3>
  <div class="export-controls">
    <select bind:value={exportFormat}>
      <option value="png">PNG</option>
      <option value="jpg">JPG</option>
      <option value="webp">WebP</option>
      <option value="svg">SVG</option>
    </select>
    <button onclick={handleExport} disabled={isExporting}>{isExporting ? 'Exporting...' : 'Export'}</button>
  </div>
</section>
