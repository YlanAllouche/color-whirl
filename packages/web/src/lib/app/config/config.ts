import { DEFAULT_CONFIG, type WallpaperConfig, type WallpaperType, DEFAULT_CONFIG_BY_TYPE } from '@wallpaper-maker/core';

function cloneAny<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function cloneDefaultConfig(): WallpaperConfig {
  return {
    ...DEFAULT_CONFIG,
    colors: [...DEFAULT_CONFIG.colors],
    palette: {
      overrides: Array.isArray((DEFAULT_CONFIG as any).palette?.overrides)
        ? (DEFAULT_CONFIG as any).palette.overrides.map((v: any) => (v && typeof v === 'object' ? { ...v } : null))
        : []
    },
    textureParams: {
      drywall: { ...DEFAULT_CONFIG.textureParams.drywall },
      glass: { ...DEFAULT_CONFIG.textureParams.glass },
      cel: { ...DEFAULT_CONFIG.textureParams.cel }
    },
    voronoi: { ...(DEFAULT_CONFIG as any).voronoi, nucleus: { ...((DEFAULT_CONFIG as any).voronoi?.nucleus ?? { enabled: false }) } } as any,
    facades: {
      side: { ...DEFAULT_CONFIG.facades.side },
      grazing: { ...DEFAULT_CONFIG.facades.grazing },
      outline: { ...DEFAULT_CONFIG.facades.outline }
    },
    edge: { ...DEFAULT_CONFIG.edge, seam: { ...DEFAULT_CONFIG.edge.seam }, band: { ...DEFAULT_CONFIG.edge.band } },
    bubbles: { ...(DEFAULT_CONFIG as any).bubbles, interior: { ...((DEFAULT_CONFIG as any).bubbles?.interior ?? { enabled: true }) } },
    emission: { ...DEFAULT_CONFIG.emission },
    bloom: { ...DEFAULT_CONFIG.bloom },
    collisions: { ...DEFAULT_CONFIG.collisions, carve: { ...DEFAULT_CONFIG.collisions.carve } },
    lighting: {
      ...DEFAULT_CONFIG.lighting,
      position: { ...DEFAULT_CONFIG.lighting.position }
    },
    camera: { ...DEFAULT_CONFIG.camera },
    environment: { ...DEFAULT_CONFIG.environment },
    shadows: { ...DEFAULT_CONFIG.shadows },
    rendering: { ...DEFAULT_CONFIG.rendering },
    geometry: { ...DEFAULT_CONFIG.geometry }
  };
}

export function cloneConfigDeep(src: WallpaperConfig): WallpaperConfig {
  const palette = {
    overrides: Array.isArray((src as any).palette?.overrides) ? cloneAny((src as any).palette.overrides) : []
  } as any;

  const voronoi = {
    ...((src as any).voronoi ?? {}),
    nucleus: { ...(((src as any).voronoi?.nucleus ?? { enabled: false }) as any) }
  } as any;

  switch (src.type) {
    case 'popsicle':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        voronoi,
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry }
      };
    case 'spheres3d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        voronoi,
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        spheres: {
          ...src.spheres,
          colorWeights: [...(src.spheres.colorWeights ?? [])],
          shape: { ...src.spheres.shape }
        }
      };
    case 'circles2d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        circles: {
          ...src.circles,
          stroke: { ...src.circles.stroke },
          colorWeights: [...(src.circles.colorWeights ?? [])],
          croissant: { ...src.circles.croissant }
        }
      };
    case 'polygon2d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        polygons: {
          ...src.polygons,
          grid: { ...src.polygons.grid },
          star: { ...src.polygons.star },
          stroke: { ...src.polygons.stroke },
          colorWeights: [...(src.polygons.colorWeights ?? [])]
        }
      };
    case 'triangles2d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        triangles: {
          ...src.triangles,
          stroke: { ...src.triangles.stroke },
          colorWeights: [...(src.triangles.colorWeights ?? [])],
          shading: { ...src.triangles.shading }
        }
      };
    case 'triangles3d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        voronoi,
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        prisms: {
          ...src.prisms,
          colorWeights: [...(src.prisms.colorWeights ?? [])]
        }
      };
    case 'hexgrid2d':
      return {
        ...src,
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        hexgrid: {
          ...src.hexgrid,
          originPx: { ...src.hexgrid.originPx },
          stroke: { ...src.hexgrid.stroke },
          coloring: { ...src.hexgrid.coloring, weights: [...(src.hexgrid.coloring.weights ?? [])] },
          effect: { ...src.hexgrid.effect },
          grouping: { ...src.hexgrid.grouping }
        }
      };
    case 'ridges2d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        ridges: {
          ...(src as any).ridges,
          fillBands: { ...((src as any).ridges?.fillBands ?? {}) },
          colorWeights: [...(((src as any).ridges?.colorWeights ?? []) as any)]
        }
      } as any;
    case 'bands2d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        bands: {
          ...(src as any).bands,
          panel: {
            ...((src as any).bands?.panel ?? {}),
            rectFrac: { ...((src as any).bands?.panel?.rectFrac ?? {}) },
            fill: { ...((src as any).bands?.panel?.fill ?? {}) }
          },
          fill: { ...((src as any).bands?.fill ?? {}) },
          stroke: { ...((src as any).bands?.stroke ?? {}) },
          waves: { ...((src as any).bands?.waves ?? {}) },
          chevron: { ...((src as any).bands?.chevron ?? {}) },
          colorWeights: [...(((src as any).bands?.colorWeights ?? []) as any)]
        }
      } as any;
    case 'flowlines2d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        flowlines: {
          ...(src as any).flowlines,
          stroke: { ...((src as any).flowlines?.stroke ?? {}) },
          colorWeights: [...(((src as any).flowlines?.colorWeights ?? []) as any)]
        }
      } as any;
    case 'diamondgrid2d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        diamondgrid: {
          ...(src as any).diamondgrid,
          originPx: { ...((src as any).diamondgrid?.originPx ?? {}) },
          panel: {
            ...((src as any).diamondgrid?.panel ?? {}),
            rectFrac: { ...((src as any).diamondgrid?.panel?.rectFrac ?? {}) }
          },
          stroke: { ...((src as any).diamondgrid?.stroke ?? {}) },
          coloring: { ...((src as any).diamondgrid?.coloring ?? {}), colorWeights: [...(((src as any).diamondgrid?.coloring?.colorWeights ?? []) as any)] },
          bevel: { ...((src as any).diamondgrid?.bevel ?? {}) }
        }
      } as any;
    case 'svg2d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        voronoi,
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        svg: {
          ...(src as any).svg,
          stroke: { ...(src as any).svg?.stroke },
          colorWeights: [...(((src as any).svg?.colorWeights ?? []) as any)]
        }
      } as any;
    case 'svg3d':
      return {
        ...(src as any),
        colors: [...src.colors],
        palette,
        textureParams: {
          drywall: { ...src.textureParams.drywall },
          glass: { ...src.textureParams.glass },
          cel: { ...src.textureParams.cel }
        },
        facades: {
          side: { ...src.facades.side },
          grazing: { ...src.facades.grazing },
          outline: { ...src.facades.outline }
        },
        voronoi,
        edge: { ...src.edge, seam: { ...src.edge.seam }, band: { ...src.edge.band } },
        bubbles: { ...(src as any).bubbles },
        emission: { ...src.emission },
        bloom: { ...src.bloom },
        collisions: { ...src.collisions, carve: { ...src.collisions.carve } },
        lighting: {
          ...src.lighting,
          position: { ...src.lighting.position }
        },
        camera: { ...src.camera },
        environment: { ...src.environment },
        shadows: { ...src.shadows },
        rendering: { ...src.rendering },
        geometry: { ...src.geometry },
        svg: {
          ...(src as any).svg,
          stroke: { ...(src as any).svg?.stroke },
          bevel: { ...(src as any).svg?.bevel },
          colorWeights: [...(((src as any).svg?.colorWeights ?? []) as any)]
        }
      } as any;
  }
}

export function cloneDefaultConfigByType(type: WallpaperType): WallpaperConfig {
  return cloneConfigDeep(DEFAULT_CONFIG_BY_TYPE[type]);
}
