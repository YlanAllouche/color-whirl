<script lang="ts">
  import CollapsiblePanel from '$lib/ui/inspector/CollapsiblePanel.svelte';
  import Dropdown from '$lib/ui/components/Dropdown.svelte';

  type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';

  type Props = {
    exportFormat: ExportFormat;
    isExporting: boolean;
    handleExport: () => void | Promise<void>;
  };

  let { exportFormat = $bindable(), isExporting, handleExport }: Props = $props();
</script>

<CollapsiblePanel id="export" title="Export" icon="download" defaultOpen={true} searchKeys="download save">
  <div class="export-controls">
    <Dropdown
      bind:value={exportFormat}
      ariaLabel="Export format"
      options={[
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPG' },
        { value: 'webp', label: 'WebP' },
        { value: 'svg', label: 'SVG' }
      ]}
    />
    <button type="button" onclick={handleExport} disabled={isExporting}>{isExporting ? 'Exporting...' : 'Export'}</button>
  </div>
</CollapsiblePanel>
