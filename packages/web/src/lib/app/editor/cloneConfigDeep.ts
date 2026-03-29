import type { WallpaperConfig } from '@wallpaper-maker/core';

export function cloneConfigDeep(src: WallpaperConfig): WallpaperConfig {
  const cloneAny = <T>(value: T): T => {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  };

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
        spheres: { ...src.spheres, colorWeights: [...src.spheres.colorWeights], shape: { ...src.spheres.shape } }
      };
    case 'bands2d':
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
        bands: {
          ...src.bands,
          panel: {
            ...src.bands.panel,
            rectFrac: { ...src.bands.panel.rectFrac },
            fill: { ...src.bands.panel.fill }
          },
          fill: { ...src.bands.fill },
          stroke: { ...src.bands.stroke },
          waves: { ...src.bands.waves },
          chevron: { ...src.bands.chevron },
          colorWeights: [...(src.bands.colorWeights ?? [])]
        }
      };
    case 'flowlines2d':
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
        flowlines: {
          ...src.flowlines,
          stroke: { ...src.flowlines.stroke },
          colorWeights: [...(src.flowlines.colorWeights ?? [])]
        }
      };
    case 'diamondgrid2d':
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
        diamondgrid: {
          ...src.diamondgrid,
          originPx: { ...src.diamondgrid.originPx },
          stroke: { ...src.diamondgrid.stroke },
          coloring: { ...src.diamondgrid.coloring, colorWeights: [...(src.diamondgrid.coloring.colorWeights ?? [])] },
          bevel: { ...src.diamondgrid.bevel },
          sparkles: { ...src.diamondgrid.sparkles }
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
        circles: {
          ...src.circles,
          stroke: { ...src.circles.stroke },
          colorWeights: [...src.circles.colorWeights],
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
        polygons: {
          ...src.polygons,
          stroke: { ...src.polygons.stroke },
          grid: { ...src.polygons.grid },
          star: { ...src.polygons.star },
          colorWeights: [...src.polygons.colorWeights]
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
        triangles: {
          ...src.triangles,
          stroke: { ...src.triangles.stroke },
          colorWeights: [...src.triangles.colorWeights],
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
        prisms: { ...src.prisms, colorWeights: [...src.prisms.colorWeights] }
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
          coloring: { ...src.hexgrid.coloring, weights: [...src.hexgrid.coloring.weights] },
          effect: { ...src.hexgrid.effect },
          grouping: { ...src.hexgrid.grouping }
        }
      };
    case 'ridges2d':
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
          ...src.ridges,
          fillBands: { ...src.ridges.fillBands },
          colorWeights: [...src.ridges.colorWeights]
        }
      };
    case 'svg2d':
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
        svg: {
          ...src.svg,
          stroke: { ...src.svg.stroke },
          colorWeights: [...(src.svg.colorWeights ?? [])]
        }
      };
    case 'svg3d':
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
        svg: {
          ...(src as any).svg,
          stroke: { ...(src as any).svg?.stroke },
          bevel: { ...(src as any).svg?.bevel },
          colorWeights: [...((src as any).svg?.colorWeights ?? [])]
        } as any
      } as any;
  }
}
