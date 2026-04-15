<script lang="ts">
  import '@fontsource/geist-sans/latin.css';
  import '@fontsource/geist-mono/latin.css';
  import '$lib/ui/styles/app.css';

  import EditorShell from '$lib/ui/layout/EditorShell.svelte';
  import EditorLeftSection from '$lib/ui/sections/EditorLeftSection.svelte';
  import EditorCenterSection from '$lib/ui/sections/EditorCenterSection.svelte';
  import EditorRightSection from '$lib/ui/sections/EditorRightSection.svelte';

  import { createPageState } from '$lib/app/pageState.svelte';

  const pageState = createPageState();
  const { state, derived, colorPresetGroups, resolutionPresets, actions } = pageState;
</script>

<svelte:head>
  <title>ColorWhirl</title>
</svelte:head>

<EditorShell
  appTitle="ColorWhirl"
  quickRandomize={actions.generateRandomGeneratedColors}
  quickExport={actions.handleExport}
  lookColumns={state.lookColumns}
  toggleLookColumns={actions.toggleLookColumns}
  bind:searchQuery={state.inspectorSearch}
  settingsMaximized={state.settingsMaximized}
  settingsOverlayVisible={state.settingsOverlayVisible}
>
  <svelte:fragment slot="left">
    <EditorLeftSection
      config={state.config}
      is3DType={derived.is3DType}
      supportsBloom={derived.supportsBloom}
      bind:searchQuery={state.inspectorSearch}
      schedulePreviewRender={actions.schedulePreviewRender}
      generateRandomGeneratedColors={actions.generateRandomGeneratedColors}
      generateRandomIncludingType={actions.generateRandomIncludingType}
      switchType={actions.switchType}
      isLocked={actions.isLocked}
      toggleLock={actions.toggleLock}
      RESOLUTION_PRESETS={resolutionPresets}
      applyResolutionPreset={actions.applyResolutionPreset}
      isExporting={state.isExporting}
      handleExport={actions.handleExport}
      cliCommand={state.cliCommand}
      copyCliCommand={actions.copyCliCommand}
      bind:cliViewMode={state.cliViewMode}
      bind:exportFormat={state.exportFormat}
      bind:renderMode={state.renderMode}
    />
  </svelte:fragment>

  <svelte:fragment slot="center">
    <EditorCenterSection
      config={state.config}
      is3DType={derived.is3DType}
      schedulePreviewRender={actions.schedulePreviewRender}
      clearPreviewSettleTimer={actions.clearPreviewSettleTimer}
      bind:canvasContainer={state.canvasContainer}
      bind:canvasHost={state.canvasHost}
      cameraDragActive={state.cameraDragActive}
      settingsMaximized={state.settingsMaximized}
      settingsOverlayVisible={state.settingsOverlayVisible}
      onCameraDragActiveChange={(next) => {
        state.cameraDragActive = next;
      }}
      onSettingsMaximizedChange={(next) => {
        state.settingsMaximized = next;
      }}
      onSettingsOverlayVisibleChange={(next) => {
        state.settingsOverlayVisible = next;
      }}
    />
  </svelte:fragment>

  <svelte:fragment slot="right">
    <EditorRightSection
      config={state.config}
      is3DType={derived.is3DType}
      supportsEmission={derived.supportsEmission}
      showEmissionSection={derived.showEmissionSection}
      supportsCollisions={derived.supportsCollisions}
      bind:columns={state.lookColumns}
      bind:searchQuery={state.inspectorSearch}
      schedulePreviewRender={actions.schedulePreviewRender}
      clearPreviewSettleTimer={actions.clearPreviewSettleTimer}
      isLocked={actions.isLocked}
      toggleLock={actions.toggleLock}
      colorPresetGroups={colorPresetGroups}
      selectedColorPreset={pageState.selectedColorPreset}
      cycleColorPreset={actions.cycleColorPreset}
      applySelectedColorPreset={actions.applySelectedColorPreset}
      updateColor={actions.updateColor}
      replaceColors={actions.replaceColors}
      moveColor={actions.moveColor}
      removeColor={actions.removeColor}
      addColor={actions.addColor}
      togglePaletteOverride={actions.togglePaletteOverride}
      updatePaletteOverride={actions.updatePaletteOverride}
      togglePaletteBlock={actions.togglePaletteBlock}
      renderError={state.renderError}
      setEqualWeights={actions.setEqualWeights}
      setRandomWeights={actions.setRandomWeights}
      updateWeight={actions.updateWeight}
      onFitCamera={actions.fitManualCamera}
      bind:selectedColorPresetId={state.selectedColorPresetId}
      bind:collisionDragActive={state.collisionDragActive}
    />
  </svelte:fragment>
</EditorShell>
