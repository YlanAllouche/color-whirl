import type {
  Bands2DConfig,
  Circles2DConfig,
  DiamondGrid2DConfig,
  Flowlines2DConfig,
  HexGrid2DConfig,
  Polygon2DConfig,
  PopsicleConfig,
  Ridges2DConfig,
  Spheres3DConfig,
  Svg2DConfig,
  Svg3DConfig,
  Triangles2DConfig,
  Triangles3DConfig,
  WallpaperConfig,
  WallpaperType
} from './types/index.js';

export const DEFAULT_POPSICLE_CONFIG: PopsicleConfig = {
  type: 'popsicle',
  seed: 1,
  width: 1920,
  height: 1080,
  colors: ['#FF6B6B', '#FF8E53', '#FE6B8B', '#FF8E53', '#FFD93D'],
  palette: { overrides: [] },
  texture: 'glossy',
  textureParams: {
    drywall: { grainAmount: 0.65, grainScale: 2.5 },
    glass: { style: 'simple' },
    cel: { bands: 4, halftone: false }
  },
  voronoi: {
    enabled: false,
    space: 'world',
    kind: 'edges',
    scale: 4.8,
    seedOffset: 0,
    amount: 0.82,
    edgeWidth: 0.16,
    softness: 0.42,
    colorStrength: 0.25,
    colorMode: 'darken',
    tintColor: '#ffffff',
    materialMode: 'both',
    materialKind: 'match',
    roughnessStrength: 0.42,
    normalStrength: 0.34,
    normalScale: 0.52,
    crackleAmount: 0,
    crackleScale: 14,
    nucleus: {
      enabled: false,
      size: 0.09,
      softness: 0.28,
      strength: 0.7,
      color: '#ffffff'
    }
  },
  backgroundColor: '#1a1a2e',
  facades: {
    side: {
      enabled: false,
      tintColor: '#ffffff',
      tintAmount: 0.25,
      materialAmount: 1.0,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.0,
      envIntensityMult: 1.0
    },
    grazing: {
      enabled: false,
      mode: 'add',
      color: '#ffffff',
      strength: 0.6,
      power: 2.5,
      width: 0.5,
      noise: 0
    },
    outline: { enabled: false, color: '#0b0b10', thickness: 0.03, opacity: 1.0 }
  },
  edge: {
    hollow: false,
    seam: {
      enabled: false,
      color: '#0b0b10',
      opacity: 0.65,
      width: 0.02,
      noise: 0,
      emissiveIntensity: 0
    },
    band: {
      enabled: false,
      color: '#ffffff',
      opacity: 0.25,
      width: 0.06,
      noise: 0,
      emissiveIntensity: 0
    }
  },
  bubbles: {
    enabled: false,
    mode: 'through',
    interior: { enabled: true },
    frequency: 1.8,
    frequencyVariance: 0.22,
    count: 8,
    radiusMin: 0.12,
    radiusMax: 0.38,
    softness: 0.06,
    wallThickness: 0.08,
    seedOffset: 0
  },
  emission: {
    enabled: false,
    paletteIndex: 0,
    intensity: 2.5
  },
  bloom: {
    enabled: false,
    strength: 0.9,
    radius: 0.35,
    threshold: 0.85
  },
  collisions: {
    mode: 'none',
    carve: {
      direction: 'oneWay',
      marginPx: 0,
      edge: 'hard',
      featherPx: 0,
      finish: 'none',
      finishAutoDepthMult: 1
    }
  },
  stickCount: 12,
  stickOverhang: 30,
  rotationCenterOffsetX: 0,
  rotationCenterOffsetY: 0,
  stickGap: 0.05,
  stickSize: 1.0,
  stickRatio: 3.0,
  stickThickness: 1.0,
  stickEndProfile: 'rounded',
  stickRoundness: 0.15,
  stickChipAmount: 0.35,
  stickChipJaggedness: 0.55,
  stickBevel: 0.35,
  stickOpacity: 1.0,
  lighting: {
    enabled: true,
    intensity: 1.5,
    position: { x: 5, y: 5, z: 5 },
    ambientIntensity: 0.3
  },
  camera: {
    mode: 'auto',
    padding: 0.92,
    // Roughly matches the previous hard-coded (10, 10, 10) isometric camera.
    distance: 17.3,
    zoom: 1,
    panX: 0,
    panY: 0,
    azimuth: 45,
    elevation: 35.3,
    near: 0.001,
    far: 1000
  },
  environment: {
    enabled: true,
    intensity: 1.2,
    rotation: 0,
    style: 'studio'
  },
  shadows: {
    enabled: true,
    type: 'pcfsoft',
    mapSize: 2048,
    bias: -0.0005,
    normalBias: 0.02
  },
  rendering: {
    toneMapping: 'aces',
    exposure: 1.0
  },
  geometry: {
    quality: 0.6
  }
};

// Back-compat alias (historical name)
export const DEFAULT_CONFIG: PopsicleConfig = DEFAULT_POPSICLE_CONFIG;

export const DEFAULT_SPHERES3D_CONFIG: Spheres3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'spheres3d',
  spheres: {
    count: 160,
    distribution: 'jitteredGrid',
    radiusMin: 0.08,
    radiusMax: 0.26,
    spread: 4.2,
    depth: 4.0,
    layers: 3,
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0,
    shape: {
      kind: 'uvSphere',
      roundness: 1,
      faceting: 0
    }
  }
};

export const DEFAULT_CIRCLES2D_CONFIG: Circles2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'circles2d',
  circles: {
    mode: 'scatter',
    count: 220,
    rMinPx: 18,
    rMaxPx: 150,
    jitter: 1.0,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    croissant: { enabled: false, innerScale: 0.72, offset: 0.35, angleJitterDeg: 180 }
  }
};

export const DEFAULT_POLYGON2D_CONFIG: Polygon2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'polygon2d',
  polygons: {
    mode: 'scatter',
    shape: 'polygon',
    count: 200,
    edges: 6,
    rMinPx: 18,
    rMaxPx: 130,
    jitter: 1.0,
    rotateJitterDeg: 180,
    grid: {
      kind: 'square',
      cellPx: 80,
      jitter: 1.0
    },
    star: {
      innerScale: 0.5
    },
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_TRIANGLES2D_CONFIG: Triangles2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'triangles2d',
  triangles: {
    mode: 'tessellation',
    density: 1.0,
    scalePx: 90,
    jitter: 0.15,
    rotateJitterDeg: 25,
    insetPx: 0,
    fillOpacity: 0.95,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6 },
    paletteMode: 'cycle',
    colorWeights: [1, 1, 1, 1, 1],
    shading: { enabled: true, lightDeg: 35, strength: 0.25 }
  }
};

export const DEFAULT_TRIANGLES3D_CONFIG: Triangles3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'triangles3d',
  prisms: {
    mode: 'stackedPrisms',
    count: 160,
    base: 'prism',
    radius: 0.22,
    height: 0.5,
    taper: 1,
    wallBulgeX: 0,
    wallBulgeY: 0,
    spread: 4.4,
    jitter: 0.65,
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_HEXGRID2D_CONFIG: HexGrid2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'hexgrid2d',
  hexgrid: {
    radiusPx: 56,
    marginPx: 2,
    originPx: { x: 0, y: 0 },
    overscanPx: 32,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
    coloring: { weightsMode: 'preset', preset: 'accents', weights: [1, 1, 1, 1, 1], paletteMode: 'weighted' },
    effect: { kind: 'bevel', amount: 0.45, frequency: 1.0 },
    grouping: { mode: 'noise', strength: 0.6, targetGroupCount: 24 },
    fillOpacity: 0.96
  }
};

export const DEFAULT_RIDGES2D_CONFIG: Ridges2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'ridges2d',
  // A more "paper"-like default background for topo lines.
  backgroundColor: '#f2eee4',
  // Earthy inks; weighted palette tends to pick the darkest for contour lines.
  colors: ['#263a2f', '#3f6b55', '#7ea66a', '#d0c29c', '#8b5a3c'],
  ridges: {
    gridStepPx: 6,
    frequency: 2.4,
    detailFrequency: 7.5,
    detailAmplitude: 0.18,
    octaves: 5,
    warpAmount: 0.85,
    warpDepth: 0.25,
    warpFrequency: 1.6,
    contrast: 1.1,
    bias: -0.03,
    levels: 14,
    levelJitter: 0.08,
    lineWidthPx: 1.25,
    lineOpacity: 0.6,
    smoothing: 0.35,
    fillBands: { enabled: true, opacity: 0.18 },
    paletteMode: 'weighted',
    colorWeights: [0.58, 0.18, 0.12, 0.08, 0.04]
  }
};

export const DEFAULT_BANDS2D_CONFIG: Bands2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'bands2d',
  // Keep this generator crisp by default.
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: {
    ...DEFAULT_POPSICLE_CONFIG.collisions,
    mode: 'none',
    carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve }
  },
  bands: {
    mode: 'waves',
    seedOffset: 0,
    angleDeg: 22,
    bandWidthPx: 120,
    gapPx: 28,
    offsetPx: 0,
    jitterPx: 0,
    panel: {
      enabled: false,
      rectFrac: { x: 0.33, y: 0.33, w: 0.34, h: 0.34 },
      radiusPx: 0,
      fill: { enabled: false, color: '#0b0b10', opacity: 1.0 }
    },
    fill: { enabled: true, opacity: 1.0 },
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.65 },
    waves: {
      amplitudePx: 36,
      wavelengthPx: 520,
      noiseAmount: 0.25,
      noiseScale: 0.9
    },
    chevron: {
      amplitudePx: 68,
      wavelengthPx: 260,
      sharpness: 1.4,
      sharedPhase: true
    },
    paletteMode: 'cycle',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_FLOWLINES2D_CONFIG: Flowlines2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'flowlines2d',
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: {
    ...DEFAULT_POPSICLE_CONFIG.collisions,
    mode: 'none',
    carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve }
  },
  flowlines: {
    seedOffset: 0,
    frequency: 2.4,
    octaves: 3,
    warpAmount: 0.55,
    warpFrequency: 1.8,
    strength: 1.0,
    epsilonPx: 1.0,

    spawn: 'grid',
    density: 0.9,
    spacingPx: 6,
    marginPx: 18,
    stepPx: 1.15,
    maxSteps: 240,
    maxLines: 2600,
    minLengthPx: 26,
    jitter: 1.0,

    stroke: {
      widthPx: 1.2,
      opacity: 0.22,
      taper: 0.25
    },

    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    colorJitter: 0.12
  }
};

export const DEFAULT_DIAMONDGRID2D_CONFIG: DiamondGrid2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'diamondgrid2d',
  emission: { ...DEFAULT_POPSICLE_CONFIG.emission, enabled: false, intensity: 0 },
  bloom: { ...DEFAULT_POPSICLE_CONFIG.bloom, enabled: false },
  collisions: {
    ...DEFAULT_POPSICLE_CONFIG.collisions,
    mode: 'none',
    carve: { ...DEFAULT_POPSICLE_CONFIG.collisions.carve }
  },
  diamondgrid: {
    tileWidthPx: 120,
    tileHeightPx: 60,
    marginPx: 2,
    sizeVariance: 0,
    originPx: { x: 0, y: 0 },
    overscanPx: 64,
    panel: {
      enabled: false,
      rectFrac: { x: 0, y: 0, w: 1, h: 1 }
    },
    fillOpacity: 0.96,
    stroke: { enabled: false, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
    coloring: { paletteMode: 'weighted', colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08] },
    bevel: { enabled: true, amount: 0.48, mode: 'convex', lightDeg: 315, variation: 0.15 }
  }
};

export const DEFAULT_SVG_SOURCE =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-app-window-icon lucide-app-window"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>`;

export const DEFAULT_SVG2D_CONFIG: Svg2DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg2d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    renderMode: 'auto',
    colorMode: 'palette',
    maxTones: 8,
    count: 220,
    rMinPx: 18,
    rMaxPx: 150,
    jitter: 1.0,
    rotateJitterDeg: 180,
    fillOpacity: 0.95,
    // Default stroke-on helps outline icons (Lucide etc.) read correctly under auto mode.
    stroke: { enabled: true, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
  }
};

export const DEFAULT_SVG3D_CONFIG: Svg3DConfig = {
  ...DEFAULT_POPSICLE_CONFIG,
  type: 'svg3d',
  svg: {
    source: DEFAULT_SVG_SOURCE,
    renderMode: 'auto',
    colorMode: 'palette',
    maxTones: 8,
    count: 160,
    spread: 4.4,
    depth: 4.0,
    tiltDeg: 0,
    rotateDeg: 0,
    rotateJitterDeg: 360,
    sizeMin: 0.14,
    sizeMax: 0.5,
    extrudeDepth: 0.22,
    stroke: { enabled: true, radius: 0.03, segments: 6, opacity: 1.0 },
    bevel: { enabled: true, size: 0.06, segments: 2 },
    paletteMode: 'weighted',
    colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
    opacity: 1.0
  }
};

export const DEFAULT_CONFIG_BY_TYPE: Record<WallpaperType, WallpaperConfig> = {
  popsicle: DEFAULT_POPSICLE_CONFIG,
  spheres3d: DEFAULT_SPHERES3D_CONFIG,
  bands2d: DEFAULT_BANDS2D_CONFIG,
  flowlines2d: DEFAULT_FLOWLINES2D_CONFIG,
  diamondgrid2d: DEFAULT_DIAMONDGRID2D_CONFIG,
  circles2d: DEFAULT_CIRCLES2D_CONFIG,
  polygon2d: DEFAULT_POLYGON2D_CONFIG,
  triangles2d: DEFAULT_TRIANGLES2D_CONFIG,
  triangles3d: DEFAULT_TRIANGLES3D_CONFIG,
  hexgrid2d: DEFAULT_HEXGRID2D_CONFIG,
  ridges2d: DEFAULT_RIDGES2D_CONFIG,
  svg2d: DEFAULT_SVG2D_CONFIG,
  svg3d: DEFAULT_SVG3D_CONFIG
};
