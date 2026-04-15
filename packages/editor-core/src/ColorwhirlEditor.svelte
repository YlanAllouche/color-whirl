<script lang="ts">
  import '@fontsource/geist-sans/latin.css';
  import '@fontsource/geist-mono/latin.css';
  import '$lib/ui/styles/app.css';

  import { createEventDispatcher } from 'svelte';
  import { normalizeWallpaperConfig, type WallpaperConfig } from '@wallpaper-maker/core';

  import EditorShell from '$lib/ui/layout/EditorShell.svelte';
  import EditorLeftSection from '$lib/ui/sections/EditorLeftSection.svelte';
  import EditorCenterSection from '$lib/ui/sections/EditorCenterSection.svelte';
  import EditorRightSection from '$lib/ui/sections/EditorRightSection.svelte';

  import { createPageState, type EditorCoreMode } from '$lib/app/pageState.svelte';

  type RecipeMeta = Record<string, unknown>;

  type SubmitPayload = {
    recipe: WallpaperConfig;
    meta: RecipeMeta;
  };

  type ChangePayload = {
    recipe: WallpaperConfig;
    mode: EditorCoreMode;
  };

  type ErrorPayload = {
    message: string;
  };

  type Props = {
    recipe?: WallpaperConfig | null;
    mode?: EditorCoreMode;
    readonly?: boolean;
    initialMeta?: RecipeMeta;
  };

  let {
    recipe = null,
    mode = 'standalone',
    readonly = false,
    initialMeta = {}
  }: Props = $props();

  const pageState = createPageState({
    mode,
    initialRecipe: recipe
  });
  const { state, derived, colorPresetGroups, resolutionPresets, actions } = pageState;

  const dispatch = createEventDispatcher<{
    submit: SubmitPayload;
    change: ChangePayload;
    error: ErrorPayload;
  }>();

  let lastAppliedSig = '';
  let lastChangeSig = '';
  let isApplyingExternalRecipe = false;

  function safeRecipeClone(input: WallpaperConfig): WallpaperConfig {
    return normalizeWallpaperConfig(JSON.parse(JSON.stringify(input)) as any) as WallpaperConfig;
  }

  export function submit() {
    dispatch('submit', {
      recipe: safeRecipeClone(state.config),
      meta: { ...initialMeta }
    });
  }

  export function getRecipe() {
    return safeRecipeClone(state.config);
  }

  $effect(() => {
    if (!recipe) return;
    const sig = JSON.stringify(recipe);
    if (sig === lastAppliedSig) return;
    lastAppliedSig = sig;

    isApplyingExternalRecipe = true;
    state.config = safeRecipeClone(recipe);
    actions.schedulePreviewRender();
    queueMicrotask(() => {
      isApplyingExternalRecipe = false;
    });
  });

  $effect(() => {
    if (isApplyingExternalRecipe) return;
    const sig = JSON.stringify(state.config);
    if (sig === lastChangeSig) return;
    lastChangeSig = sig;
    dispatch('change', {
      recipe: safeRecipeClone(state.config),
      mode
    });
  });

  $effect(() => {
    const message = state.renderError;
    if (!message) return;
    dispatch('error', { message });
  });
</script>

<div class="editor-core-root" class:readonly>
  <EditorShell
    appTitle="ColorWhirl"
    quickRandomize={readonly ? undefined : actions.generateRandomGeneratedColors}
    quickExport={actions.handleExport}
    lookColumns={state.lookColumns}
    toggleLookColumns={readonly ? undefined : actions.toggleLookColumns}
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
        generateRandomColorsOnly={actions.generateRandomColorsOnly}
        generateRandomGeneratedColors={actions.generateRandomGeneratedColors}
        generateRandomIncludingType={actions.generateRandomIncludingType}
        bind:randomizationProfile={state.randomizationProfile}
        bind:paletteRandomizeScheme={state.paletteRandomizeScheme}
        bind:paletteRandomizeHueBetweenSteps={state.paletteRandomizeHueBetweenSteps}
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
        performance={state.performance}
        togglePerformanceHud={actions.togglePerformanceHud}
        runBenchmarkIterations={actions.runBenchmarkIterations}
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
        performance={state.performance}
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
        canRandomizeWidget={actions.canRandomizeWidget}
        randomizeWidget={actions.randomizeWidget}
        onFitCamera={actions.fitManualCamera}
        bind:selectedColorPresetId={state.selectedColorPresetId}
        bind:collisionDragActive={state.collisionDragActive}
      />
    </svelte:fragment>
  </EditorShell>
</div>

<style>
  .editor-core-root {
    width: 100%;
    height: 100%;
  }

  .readonly {
    user-select: none;
  }

  .readonly :global(input),
  .readonly :global(select),
  .readonly :global(textarea),
  .readonly :global(button) {
    pointer-events: none;
  }
</style>
