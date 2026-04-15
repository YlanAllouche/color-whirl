export const RANDOMIZE_TUNING = {
  stickOpacity: {
    mostlyOpaqueThreshold: 0.9,
    slightTranslucencyThreshold: 0.995,
    noticeableTranslucencyThreshold: 0.9995,
    slight: { min: 0.92, max: 1.0, mode: 0.992 },
    noticeable: { min: 0.5, max: 0.92, mode: 0.85 },
    transparent: { min: 0.15, max: 0.5, mode: 0.35 }
  },
  global: {
    fallbackEmissionChance: 0.08,
    bloomEnabledChance: 0.35,
    bubblesEnabledChance: 0.035,
    collisionsCarveChance: 0.12,
    collisionsSoftEdgeChance: 0.28,
    collisionsTwoWayChance: 0.18,
    manualCameraChanceSafe: 0.08,
    manualCameraChanceExploratory: 0.35,
    paletteOverridesChance: 0.06,
    envEnabledChance: 0.85,
    shadowsEnabledChance: 0.75,
    shadowTypeVsmChance: 0.2,
    toneMappingAcesChance: 0.88,
    lightingEnabledChance: 0.8
  },
  voronoi: {
    enabledChance3D: 0.22,
    edgesKindChance: 0.78,
    materialCellsEdgesChance: 0.62,
    materialCellsMatchChance: 0.75,
    materialEdgesMatchChance: 0.78,
    materialEdgesEdgesChance: 0.85,
    crackleChance: 0.22,
    nucleusCellsChance: 0.65,
    nucleusEdgesChance: 0.25,
    spaceWorldChance: 0.72,
    colorModeDarkenChance: 0.6,
    glassNormalChance: 0.72,
    glassBothChance: 0.8,
    glassRoughnessChance: 0.9,
    matteRoughnessChance: 0.7,
    matteBothChance: 0.75,
    matteNormalChance: 0.9,
    mirrorNormalChance: 0.66,
    mirrorBothChance: 0.72,
    mirrorRoughnessChance: 0.9,
    perColorDisableChance3D: 0.12,
    perColorEnableChance3D: 0.16,
    perColorCrackleChance: 0.22,
    perColorNucleusChance: 0.25,
    perColorColorModeDarkenChance: 0.6,
    perColorMaterialNoneChance: 0.2,
    perColorMaterialRoughnessChance: 0.5,
    perColorMaterialNormalChance: 0.75
  },
  facades: {
    tintEnabledChance: 0.18,
    materialEnabledChance: 0.18,
    wearEnabledChance: 0.12,
    rimEnabledChance: 0.25,
    grazingModeAddChance: 0.5,
    outlineEnabledChance: 0.1
  },
  texture: {
    celHalftoneChance: 0.25,
    perColorTextureChance3D: 0.12,
    perColorTextureGlassChance: 0.55,
    perColorTextureMirrorChance: 0.6,
    perColorTextureMetallicChance: 0.5
  },
  environment: {
    styleStudioChance: 0.7,
    styleOvercastChance: 0.65
  },
  paletteOverrides: {
    firstEmissionTargetChance: 0.55,
    secondEmissionTargetChance: 0.22,
    thirdEmissionTargetChance: 0.08,
    perColorGeometryChance: 0.18
  }
} as const;
