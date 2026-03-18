#!/usr/bin/env node

import { Command } from 'commander';
import {
  WallpaperConfig,
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_BY_TYPE,
  RESOLUTION_PRESETS,
  ResolutionPreset,
  TextureType,
  type WallpaperType,
  decodeAppStateFromBase64Url,
  normalizeWallpaperConfig,
  type WallpaperAppStateV1,
  type ExportFormat
} from '@wallpaper-maker/core';
import { generateWallpaper } from './generate.js';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

const program = new Command();

program
  .name('wallpaper-maker')
  .description('Generate beautiful wallpapers from the command line')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a wallpaper')
  .option('--cfg <cfg>', 'Base64url encoded web/cli config state')
  .option('-t, --type <type>', 'Wallpaper type', 'popsicle')
  .option('--seed <seed>', 'Seed (uint32)')
  .option('-W, --width <width>', 'Image width in pixels')
  .option('-H, --height <height>', 'Image height in pixels')
  .option('-r, --resolution <preset>', 'Use a preset resolution (1080p, 1440p, 4k, mobile, square, ultrawide)')
  .option('-c, --colors <colors>', 'Comma-separated hex colors (e.g., "#ff0000,#00ff00")')
  .option('-T, --texture <texture>', 'Texture type (glossy, matte, metallic, drywall, glass, mirror, cel)', 'glossy')
  .option('-b, --background <color>', 'Background color (hex)', '#1a1a2e')
  .option('-n, --count <number>', 'Count (sticks/spheres/circles/prisms)', '12')
  .option('--palette-mode <mode>', 'Palette mode (cycle, weighted)')
  .option('--weights <weights>', 'Comma-separated palette weights (e.g. "1,0.2,3")')
  .option('--opacity <opacity>', 'Shape opacity (0..1)')

  // textureParams
  .option('--drywall-grain-amount <number>', 'Drywall grain amount (0..1)')
  .option('--drywall-grain-scale <number>', 'Drywall grain scale')
  .option('--glass-style <style>', 'Glass style (simple, frosted, thick, stylized)')
  .option('--cel-bands <number>', 'Cel band count')
  .option('--cel-halftone', 'Enable cel halftone')
  .option('--no-cel-halftone', 'Disable cel halftone')

  // edges
  .option('--edges-tint', 'Enable edge tint')
  .option('--no-edges-tint', 'Disable edge tint')
  .option('--edges-tint-color <hex>', 'Edge tint color (hex)')
  .option('--edges-tint-amount <number>', 'Edge tint amount (0..1)')

  .option('--edges-material', 'Enable edge material override')
  .option('--no-edges-material', 'Disable edge material override')
  .option('--edges-material-roughness <number>', 'Edge roughness (0..1)')
  .option('--edges-material-metalness <number>', 'Edge metalness (0..1)')
  .option('--edges-material-clearcoat <number>', 'Edge clearcoat (0..1)')
  .option('--edges-material-env-intensity-mult <number>', 'Edge env intensity multiplier')

  .option('--edges-wear', 'Enable edge wear')
  .option('--no-edges-wear', 'Disable edge wear')
  .option('--edges-wear-intensity <number>', 'Edge wear intensity (0..1)')
  .option('--edges-wear-width <number>', 'Edge wear width (0..1)')
  .option('--edges-wear-noise <number>', 'Edge wear noise (0..1)')
  .option('--edges-wear-color-shift <hex>', 'Edge wear color shift (hex)')

  .option('--edges-rim-light', 'Enable edge rim light')
  .option('--no-edges-rim-light', 'Disable edge rim light')
  .option('--edges-rim-light-color <hex>', 'Rim light color (hex)')
  .option('--edges-rim-light-intensity <number>', 'Rim light intensity')
  .option('--edges-rim-light-power <number>', 'Rim light power')

  .option('--edges-outline', 'Enable outline (3D only)')
  .option('--no-edges-outline', 'Disable outline')
  .option('--edges-outline-color <hex>', 'Outline color (hex)')
  .option('--edges-outline-thickness <number>', 'Outline thickness')
  .option('--edges-outline-opacity <number>', 'Outline opacity (0..1)')

  // emission + bloom
  .option('--emission', 'Enable emission')
  .option('--no-emission', 'Disable emission')
  .option('--emission-palette-index <number>', 'Emission palette index')
  .option('--emission-intensity <number>', 'Emission intensity')
  .option('--bloom', 'Enable bloom')
  .option('--no-bloom', 'Disable bloom')
  .option('--bloom-strength <number>', 'Bloom strength')
  .option('--bloom-radius <number>', 'Bloom radius')
  .option('--bloom-threshold <number>', 'Bloom threshold (0..1)')

  // collisions
  .option('--collisions-mode <mode>', 'Collision mode (none, carve)')
  .option('--collisions-direction <direction>', 'Collision carve direction (oneWay, twoWay)')
  .option('--collisions-margin <px>', 'Collision carve margin in px')
  .option('--collisions-edge <edge>', 'Collision carve edge (hard, soft)')
  .option('--collisions-feather <px>', 'Collision carve feather (soft edge) in px')

  // spheres3d
  .option('--spheres-distribution <mode>', 'Spheres distribution (jitteredGrid, scatter, layeredDepth)')
  .option('--spheres-radius-min <number>', 'Spheres min radius (scene units)')
  .option('--spheres-radius-max <number>', 'Spheres max radius (scene units)')
  .option('--spheres-spread <number>', 'Spheres XY spread (scene units)')
  .option('--spheres-depth <number>', 'Spheres Z depth (scene units)')
  .option('--spheres-layers <number>', 'Spheres depth layers (layeredDepth)')

  // circles2d
  .option('--circles-mode <mode>', 'Circles mode (scatter, grid)')
  .option('--circles-r-min <px>', 'Circles min radius (px)')
  .option('--circles-r-max <px>', 'Circles max radius (px)')
  .option('--circles-jitter <number>', 'Circles jitter (0..1)')
  .option('--circles-fill-opacity <number>', 'Circles fill opacity (0..1)')
  .option('--circles-stroke', 'Enable circle stroke')
  .option('--no-circles-stroke', 'Disable circle stroke')
  .option('--circles-stroke-width <px>', 'Circle stroke width (px)')
  .option('--circles-stroke-color <hex>', 'Circle stroke color (hex)')
  .option('--circles-stroke-opacity <number>', 'Circle stroke opacity (0..1)')
  .option('--croissant', 'Enable croissant circles')
  .option('--no-croissant', 'Disable croissant circles')
  .option('--croissant-inner-scale <number>', 'Croissant inner scale (0..1)')
  .option('--croissant-offset <number>', 'Croissant inner offset (0..1)')
  .option('--croissant-angle-jitter <deg>', 'Croissant angle jitter (deg)')

  // polygon2d
  .option('--polygon-count <number>', 'Polygon count')
  .option('--polygon-edges <number>', 'Polygon edge count (>= 3)')
  .option('--polygon-r-min <px>', 'Polygon min radius (px)')
  .option('--polygon-r-max <px>', 'Polygon max radius (px)')
  .option('--polygon-jitter <number>', 'Polygon jitter (0..1)')
  .option('--polygon-rotate <deg>', 'Polygon rotate jitter (deg)')
  .option('--polygon-fill-opacity <number>', 'Polygon fill opacity (0..1)')
  .option('--polygon-stroke', 'Enable polygon stroke')
  .option('--no-polygon-stroke', 'Disable polygon stroke')
  .option('--polygon-stroke-width <px>', 'Polygon stroke width (px)')
  .option('--polygon-stroke-color <hex>', 'Polygon stroke color (hex)')
  .option('--polygon-stroke-opacity <number>', 'Polygon stroke opacity (0..1)')

  // triangles2d
  .option('--triangles2d-mode <mode>', 'Triangles2D mode (tessellation, scatter, lowpoly)')
  .option('--triangles-density <number>', 'Triangles2D density')
  .option('--triangles-scale <px>', 'Triangles2D scale (px)')
  .option('--triangles-jitter <number>', 'Triangles2D jitter (0..1)')
  .option('--triangles-rotate-jitter <deg>', 'Triangles2D rotate jitter (deg)')
  .option('--triangles-inset <px>', 'Triangles2D inset (px)')
  .option('--triangles-fill-opacity <number>', 'Triangles2D fill opacity (0..1)')
  .option('--triangles-stroke', 'Enable triangles2D stroke')
  .option('--no-triangles-stroke', 'Disable triangles2D stroke')
  .option('--triangles-stroke-width <px>', 'Triangles2D stroke width (px)')
  .option('--triangles-stroke-color <hex>', 'Triangles2D stroke color (hex)')
  .option('--triangles-stroke-opacity <number>', 'Triangles2D stroke opacity (0..1)')
  .option('--triangles-shading', 'Enable triangles2D shading')
  .option('--no-triangles-shading', 'Disable triangles2D shading')
  .option('--triangles-light <deg>', 'Triangles2D shading light angle (deg)')
  .option('--triangles-shading-strength <number>', 'Triangles2D shading strength (0..1)')

  // triangles3d
  .option('--prisms-mode <mode>', 'Prisms mode (tessellation, scatter, stackedPrisms)')
  .option('--prisms-radius <number>', 'Prism radius (scene units)')
  .option('--prisms-height <number>', 'Prism height (scene units)')
  .option('--prisms-spread <number>', 'Prism spread (scene units)')
  .option('--prisms-jitter <number>', 'Prism jitter (0..1)')

  // hexgrid2d
  .option('--hex-radius <px>', 'Hex radius (px)')
  .option('--hex-margin <px>', 'Hex margin (px)')
  .option('--hex-origin-x <px>', 'Hex origin x (px)')
  .option('--hex-origin-y <px>', 'Hex origin y (px)')
  .option('--hex-overscan <px>', 'Hex overscan (px)')
  .option('--hex-fill-opacity <number>', 'Hex fill opacity (0..1)')
  .option('--hex-stroke', 'Enable hex stroke')
  .option('--no-hex-stroke', 'Disable hex stroke')
  .option('--hex-stroke-width <px>', 'Hex stroke width (px)')
  .option('--hex-stroke-color <hex>', 'Hex stroke color (hex)')
  .option('--hex-stroke-opacity <number>', 'Hex stroke opacity (0..1)')
  .option('--hex-stroke-join <join>', 'Hex stroke join (round, miter, bevel)')
  .option('--hex-palette-mode <mode>', 'Hex palette mode (cycle, weighted)')
  .option('--hex-weights-mode <mode>', 'Hex weights mode (auto, preset, custom)')
  .option('--hex-weights-preset <preset>', 'Hex weights preset (equal, dominant, accents, rare-accents)')
  .option('--hex-weights <weights>', 'Comma-separated hex palette weights (custom)')
  .option('--hex-effect-kind <kind>', 'Hex effect kind (none, bevel, grain, gradient)')
  .option('--hex-effect-amount <number>', 'Hex effect amount (0..1)')
  .option('--hex-effect-frequency <number>', 'Hex effect frequency')
  .option('--hex-grouping-mode <mode>', 'Hex grouping mode (none, voronoi, noise, random-walk)')
  .option('--hex-grouping-strength <number>', 'Hex grouping strength (0..1)')
  .option('--hex-grouping-target <number>', 'Hex target group count')
  .option('--stick-overhang <degrees>', 'Stick overhang angle per stick in degrees', '30')
  .option('--rotation-center-offset-x <percent>', 'Rotation center X offset as percentage (-100 to 100)', '0')
  .option('--rotation-center-offset-y <percent>', 'Rotation center Y offset as percentage (-100 to 100)', '0')
  .option('--gap <number>', 'Gap between sticks (0-5.0)', '0.05')
  .option('--size <number>', 'Stick size multiplier (0.25-2.5)', '1.0')
  .option('--ratio <number>', 'Stick ratio (length/width)', '3.0')
  .option('--thickness <number>', 'Stick thickness multiplier', '1.0')
  .option('--roundness <number>', 'Stick end roundness (0-1)', '0.15')
  .option('--bevel <number>', 'Bevel amount (0-1)', '0.35')
  .option('--stick-opacity <number>', 'Stick opacity (0-1)', String(DEFAULT_CONFIG.stickOpacity))
  .option('--camera-distance <number>', 'Camera distance', '17.3')
  .option('--camera-azimuth <number>', 'Camera azimuth in degrees', '45')
  .option('--camera-elevation <number>', 'Camera elevation in degrees', '35.3')
  .option('-f, --format <format>', 'Output format (png, jpg, webp, svg)')
  .option('-o, --output <path>', 'Output file path')
  .option('--lighting', 'Enable lighting', true)
  .option('--no-lighting', 'Disable lighting')
  .option('--light-intensity <number>', 'Light intensity', '1.5')
  .option('--light-x <number>', 'Light X position', '5')
  .option('--light-y <number>', 'Light Y position', '5')
  .option('--light-z <number>', 'Light Z position', '5')
  .option('--ambient <number>', 'Ambient light intensity', '0.3')
  .option('--tone-mapping <type>', 'Tone mapping (aces, none)', DEFAULT_CONFIG.rendering.toneMapping)
  .option('--exposure <number>', 'Exposure', String(DEFAULT_CONFIG.rendering.exposure))
  .option('--environment', 'Enable environment reflections', DEFAULT_CONFIG.environment.enabled)
  .option('--no-environment', 'Disable environment reflections')
  .option('--env-style <style>', 'Environment style (studio, overcast, sunset)', DEFAULT_CONFIG.environment.style)
  .option('--env-intensity <number>', 'Environment intensity', String(DEFAULT_CONFIG.environment.intensity))
  .option('--env-rotation <degrees>', 'Environment rotation (0-360)', String(DEFAULT_CONFIG.environment.rotation))
  .option('--shadows', 'Enable shadows', DEFAULT_CONFIG.shadows.enabled)
  .option('--no-shadows', 'Disable shadows')
  .option('--shadow-type <type>', 'Shadow type (pcfsoft, vsm)', DEFAULT_CONFIG.shadows.type)
  .option('--shadow-map-size <number>', 'Shadow map size', String(DEFAULT_CONFIG.shadows.mapSize))
  .option('--shadow-bias <number>', 'Shadow bias', String(DEFAULT_CONFIG.shadows.bias))
  .option('--shadow-normal-bias <number>', 'Shadow normal bias', String(DEFAULT_CONFIG.shadows.normalBias))
  .option('--geometry-quality <number>', 'Geometry quality (0-1)', String(DEFAULT_CONFIG.geometry.quality))
  .action(async (options, command) => {
    try {
      const { config, format } = buildConfigAndFormat(options, command);
      console.log('Generating wallpaper...');
      console.log(`Type: ${config.type}`);
      console.log(`Resolution: ${config.width}x${config.height}`);
      console.log(`Colors: ${config.colors.join(', ')}`);
      
      const result = await generateWallpaper(config, format);
      
      const outputPath = options.output || `wallpaper-${Date.now()}.${format}`;
      const resolvedPath = resolve(outputPath);
      
      if (typeof result.data === 'string') {
        await writeFile(resolvedPath, result.data, 'utf-8');
      } else {
        await writeFile(resolvedPath, result.data);
      }
      
      console.log(`✓ Wallpaper saved to: ${resolvedPath}`);
    } catch (error) {
      console.error('Error generating wallpaper:', error);
      process.exit(1);
    }
  });

function cloneConfig<T>(value: T): T {
  // All wallpaper configs are plain JSON-like data.
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseNumberList(value: unknown): number[] {
  if (value == null) return [];
  const s = String(value);
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .map((x) => (Number.isFinite(x) ? x : 0));
}

function parseOpacity01(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildConfigAndFormat(options: any, command: Command): { config: WallpaperConfig; format: ExportFormat } {
  if (options.cfg) {
    const state = decodeAppStateFromBase64Url(String(options.cfg)) as WallpaperAppStateV1;
    const cfg = normalizeWallpaperConfig(state.c as any);
    const fmt = (options.format ?? state.f ?? 'png') as ExportFormat;
    return { config: cfg, format: fmt };
  }

  const typeRaw = String(options.type ?? 'popsicle') as WallpaperType;
  const type: WallpaperType = (typeRaw === 'popsicle' || typeRaw === 'spheres3d' || typeRaw === 'circles2d' || typeRaw === 'polygon2d' || typeRaw === 'triangles2d' || typeRaw === 'triangles3d' || typeRaw === 'hexgrid2d')
    ? typeRaw
    : 'popsicle';

  const source = (name: string) => {
    try {
      return command.getOptionValueSource(name);
    } catch {
      return 'unknown';
    }
  };
  const fromCli = (name: string) => source(name) === 'cli';

  const config = cloneConfig(DEFAULT_CONFIG_BY_TYPE[type] as any) as WallpaperConfig;
  let width = config.width;
  let height = config.height;
  
  if (fromCli('resolution') && options.resolution) {
    const preset = options.resolution as ResolutionPreset;
    if (preset in RESOLUTION_PRESETS) {
      const { width: w, height: h } = RESOLUTION_PRESETS[preset];
      width = w;
      height = h;
    } else {
      console.warn(`Unknown resolution preset: ${options.resolution}`);
    }
  }
  
  if (fromCli('width') && options.width) width = parseInt(options.width, 10);
  if (fromCli('height') && options.height) height = parseInt(options.height, 10);
  
  if (fromCli('seed') && options.seed != null) {
    const seedRaw = Number(options.seed);
    if (Number.isFinite(seedRaw)) config.seed = (Math.floor(seedRaw) >>> 0);
  }
 
  config.width = width;
  config.height = height;
   
   if (fromCli('colors') && options.colors) {
     config.colors = String(options.colors)
       .split(',')
       .map((c: string) => c.trim())
       .filter(Boolean);
   }
    
   if (fromCli('background') && options.background) {
     config.backgroundColor = String(options.background);
   }

  if (fromCli('texture') && options.texture) {
    config.texture = options.texture as TextureType;
  }

  // texture params
  if (fromCli('drywallGrainAmount') && options.drywallGrainAmount != null) {
    const v = parseOpacity01(options.drywallGrainAmount);
    if (v != null) config.textureParams.drywall.grainAmount = v;
  }
  if (fromCli('drywallGrainScale') && options.drywallGrainScale != null) {
    const v = parseFloat(options.drywallGrainScale);
    if (Number.isFinite(v)) config.textureParams.drywall.grainScale = clamp(v, 0.1, 50);
  }
  if (fromCli('glassStyle') && options.glassStyle != null) {
    const s = String(options.glassStyle);
    if (s === 'simple' || s === 'frosted' || s === 'thick' || s === 'stylized') config.textureParams.glass.style = s;
  }
  if (fromCli('celBands') && options.celBands != null) {
    const v = Math.round(parseFloat(options.celBands));
    if (Number.isFinite(v)) config.textureParams.cel.bands = clamp(v, 2, 12);
  }
  if (fromCli('celHalftone')) config.textureParams.cel.halftone = Boolean(options.celHalftone);

   if (fromCli('cameraDistance') && options.cameraDistance != null) config.camera.distance = parseFloat(options.cameraDistance);
   if (fromCli('cameraAzimuth') && options.cameraAzimuth != null) config.camera.azimuth = parseFloat(options.cameraAzimuth);
   if (fromCli('cameraElevation') && options.cameraElevation != null) config.camera.elevation = parseFloat(options.cameraElevation);

   if (fromCli('lighting')) config.lighting.enabled = Boolean(options.lighting);
   if (fromCli('lightIntensity') && options.lightIntensity != null) config.lighting.intensity = parseFloat(options.lightIntensity);
   if (fromCli('lightX') && options.lightX != null) config.lighting.position.x = parseFloat(options.lightX);
   if (fromCli('lightY') && options.lightY != null) config.lighting.position.y = parseFloat(options.lightY);
   if (fromCli('lightZ') && options.lightZ != null) config.lighting.position.z = parseFloat(options.lightZ);
   if (fromCli('ambient') && options.ambient != null) config.lighting.ambientIntensity = parseFloat(options.ambient);

   if (fromCli('toneMapping') && options.toneMapping != null) {
     const toneMapping = String(options.toneMapping);
     config.rendering.toneMapping = toneMapping === 'none' ? 'none' : 'aces';
   }
   if (fromCli('exposure') && options.exposure != null) {
     const ex = parseFloat(options.exposure);
     if (Number.isFinite(ex)) config.rendering.exposure = ex;
   }

   if (fromCli('environment')) config.environment.enabled = Boolean(options.environment);
   if (fromCli('envStyle') && options.envStyle != null) {
     const envStyle = String(options.envStyle);
     config.environment.style = envStyle === 'overcast' || envStyle === 'sunset' ? envStyle : 'studio';
   }
   if (fromCli('envIntensity') && options.envIntensity != null) {
     const v = parseFloat(options.envIntensity);
     if (Number.isFinite(v)) config.environment.intensity = v;
   }
   if (fromCli('envRotation') && options.envRotation != null) {
     const v = parseFloat(options.envRotation);
     if (Number.isFinite(v)) config.environment.rotation = v;
   }

   if (fromCli('shadows')) config.shadows.enabled = Boolean(options.shadows);
   if (fromCli('shadowType') && options.shadowType != null) {
     const shadowType = String(options.shadowType);
     config.shadows.type = shadowType === 'vsm' ? 'vsm' : 'pcfsoft';
   }
   if (fromCli('shadowMapSize') && options.shadowMapSize != null) {
     const v = parseInt(options.shadowMapSize, 10);
     if (Number.isFinite(v)) config.shadows.mapSize = v;
   }
   if (fromCli('shadowBias') && options.shadowBias != null) {
     const v = parseFloat(options.shadowBias);
     if (Number.isFinite(v)) config.shadows.bias = v;
   }
   if (fromCli('shadowNormalBias') && options.shadowNormalBias != null) {
     const v = parseFloat(options.shadowNormalBias);
     if (Number.isFinite(v)) config.shadows.normalBias = v;
   }

  if (fromCli('geometryQuality') && options.geometryQuality != null) {
    const v = parseFloat(options.geometryQuality);
    if (Number.isFinite(v)) config.geometry.quality = v;
  }

  // edges / emission / bloom
  const edgesTouched =
    fromCli('edgesTint') ||
    fromCli('edgesTintColor') ||
    fromCli('edgesTintAmount') ||
    fromCli('edgesMaterial') ||
    fromCli('edgesMaterialRoughness') ||
    fromCli('edgesMaterialMetalness') ||
    fromCli('edgesMaterialClearcoat') ||
    fromCli('edgesMaterialEnvIntensityMult') ||
    fromCli('edgesWear') ||
    fromCli('edgesWearIntensity') ||
    fromCli('edgesWearWidth') ||
    fromCli('edgesWearNoise') ||
    fromCli('edgesWearColorShift') ||
    fromCli('edgesRimLight') ||
    fromCli('edgesRimLightColor') ||
    fromCli('edgesRimLightIntensity') ||
    fromCli('edgesRimLightPower') ||
    fromCli('edgesOutline') ||
    fromCli('edgesOutlineColor') ||
    fromCli('edgesOutlineThickness') ||
    fromCli('edgesOutlineOpacity');

  const is3D = config.type === 'popsicle' || config.type === 'spheres3d' || config.type === 'triangles3d';
  if (edgesTouched && !is3D) {
    console.warn(`Warning: edges options are only supported for 3D types; ignoring edges flags for type=${config.type}`);
  }

  if (is3D) {
    if (fromCli('edgesTint')) config.edges.tint.enabled = Boolean(options.edgesTint);
    if (fromCli('edgesTintColor') && options.edgesTintColor != null) config.edges.tint.color = String(options.edgesTintColor);
    if (fromCli('edgesTintAmount') && options.edgesTintAmount != null) {
      const v = parseOpacity01(options.edgesTintAmount);
      if (v != null) config.edges.tint.amount = v;
    }

    if (fromCli('edgesMaterial')) config.edges.material.enabled = Boolean(options.edgesMaterial);
    if (fromCli('edgesMaterialRoughness') && options.edgesMaterialRoughness != null) {
      const v = parseOpacity01(options.edgesMaterialRoughness);
      if (v != null) config.edges.material.roughness = v;
    }
    if (fromCli('edgesMaterialMetalness') && options.edgesMaterialMetalness != null) {
      const v = parseOpacity01(options.edgesMaterialMetalness);
      if (v != null) config.edges.material.metalness = v;
    }
    if (fromCli('edgesMaterialClearcoat') && options.edgesMaterialClearcoat != null) {
      const v = parseOpacity01(options.edgesMaterialClearcoat);
      if (v != null) config.edges.material.clearcoat = v;
    }
    if (fromCli('edgesMaterialEnvIntensityMult') && options.edgesMaterialEnvIntensityMult != null) {
      const v = parseFloat(options.edgesMaterialEnvIntensityMult);
      if (Number.isFinite(v)) config.edges.material.envIntensityMult = clamp(v, 0, 3);
    }

    if (fromCli('edgesWear')) config.edges.wear.enabled = Boolean(options.edgesWear);
    if (fromCli('edgesWearIntensity') && options.edgesWearIntensity != null) {
      const v = parseOpacity01(options.edgesWearIntensity);
      if (v != null) config.edges.wear.intensity = v;
    }
    if (fromCli('edgesWearWidth') && options.edgesWearWidth != null) {
      const v = parseOpacity01(options.edgesWearWidth);
      if (v != null) config.edges.wear.width = v;
    }
    if (fromCli('edgesWearNoise') && options.edgesWearNoise != null) {
      const v = parseOpacity01(options.edgesWearNoise);
      if (v != null) config.edges.wear.noise = v;
    }
    if (fromCli('edgesWearColorShift') && options.edgesWearColorShift != null) config.edges.wear.colorShift = String(options.edgesWearColorShift);

    if (fromCli('edgesRimLight')) config.edges.rimLight.enabled = Boolean(options.edgesRimLight);
    if (fromCli('edgesRimLightColor') && options.edgesRimLightColor != null) config.edges.rimLight.color = String(options.edgesRimLightColor);
    if (fromCli('edgesRimLightIntensity') && options.edgesRimLightIntensity != null) {
      const v = parseFloat(options.edgesRimLightIntensity);
      if (Number.isFinite(v)) config.edges.rimLight.intensity = clamp(v, 0, 5);
    }
    if (fromCli('edgesRimLightPower') && options.edgesRimLightPower != null) {
      const v = parseFloat(options.edgesRimLightPower);
      if (Number.isFinite(v)) config.edges.rimLight.power = clamp(v, 0.5, 8);
    }

    if (fromCli('edgesOutline')) config.edges.outline.enabled = Boolean(options.edgesOutline);
    if (fromCli('edgesOutlineColor') && options.edgesOutlineColor != null) config.edges.outline.color = String(options.edgesOutlineColor);
    if (fromCli('edgesOutlineThickness') && options.edgesOutlineThickness != null) {
      const v = parseFloat(options.edgesOutlineThickness);
      if (Number.isFinite(v)) config.edges.outline.thickness = clamp(v, 0, 0.2);
    }
    if (fromCli('edgesOutlineOpacity') && options.edgesOutlineOpacity != null) {
      const v = parseOpacity01(options.edgesOutlineOpacity);
      if (v != null) config.edges.outline.opacity = v;
    }
  }

  if (fromCli('emission')) config.emission.enabled = Boolean(options.emission);
  if (fromCli('emissionPaletteIndex') && options.emissionPaletteIndex != null) {
    const v = Math.round(parseFloat(options.emissionPaletteIndex));
    if (Number.isFinite(v)) config.emission.paletteIndex = clamp(v, 0, Math.max(0, config.colors.length - 1));
  }
  if (fromCli('emissionIntensity') && options.emissionIntensity != null) {
    const v = parseFloat(options.emissionIntensity);
    if (Number.isFinite(v)) config.emission.intensity = clamp(v, 0, 20);
  }

  if (fromCli('bloom')) config.bloom.enabled = Boolean(options.bloom);
  if (fromCli('bloomStrength') && options.bloomStrength != null) {
    const v = parseFloat(options.bloomStrength);
    if (Number.isFinite(v)) config.bloom.strength = clamp(v, 0, 10);
  }
  if (fromCli('bloomRadius') && options.bloomRadius != null) {
    const v = parseFloat(options.bloomRadius);
    if (Number.isFinite(v)) config.bloom.radius = clamp(v, 0, 10);
  }
  if (fromCli('bloomThreshold') && options.bloomThreshold != null) {
    const v = parseOpacity01(options.bloomThreshold);
    if (v != null) config.bloom.threshold = v;
  }

  // collisions
  if (fromCli('collisionsMode') && options.collisionsMode != null) {
    const m = String(options.collisionsMode);
    config.collisions.mode = m === 'carve' ? 'carve' : 'none';
  }
  if (fromCli('collisionsDirection') && options.collisionsDirection != null) {
    const d = String(options.collisionsDirection);
    config.collisions.carve.direction = d === 'twoWay' ? 'twoWay' : 'oneWay';
  }
  if (fromCli('collisionsEdge') && options.collisionsEdge != null) {
    const e = String(options.collisionsEdge);
    config.collisions.carve.edge = e === 'soft' ? 'soft' : 'hard';
  }
  if (fromCli('collisionsMargin') && options.collisionsMargin != null) {
    const v = parseFloat(options.collisionsMargin);
    if (Number.isFinite(v)) config.collisions.carve.marginPx = Math.max(0, v);
  }
  if (fromCli('collisionsFeather') && options.collisionsFeather != null) {
    const v = parseFloat(options.collisionsFeather);
    if (Number.isFinite(v)) config.collisions.carve.featherPx = Math.max(0, v);
  }

  // Shared palette config for types that support it.
  if (fromCli('paletteMode') && options.paletteMode != null) {
    const m = String(options.paletteMode);
    const mode = m === 'weighted' ? 'weighted' : 'cycle';
    if (config.type === 'spheres3d') config.spheres.paletteMode = mode;
    if (config.type === 'circles2d') config.circles.paletteMode = mode;
    if (config.type === 'polygon2d') config.polygons.paletteMode = mode;
    if (config.type === 'triangles2d') config.triangles.paletteMode = mode;
    if (config.type === 'triangles3d') config.prisms.paletteMode = mode;
  }

  if (fromCli('weights') && options.weights != null) {
    const weights = parseNumberList(options.weights);
    if (config.type === 'spheres3d') config.spheres.colorWeights = weights;
    if (config.type === 'circles2d') config.circles.colorWeights = weights;
    if (config.type === 'polygon2d') config.polygons.colorWeights = weights;
    if (config.type === 'triangles2d') config.triangles.colorWeights = weights;
    if (config.type === 'triangles3d') config.prisms.colorWeights = weights;
  }

  if (fromCli('opacity') && options.opacity != null) {
    const op = parseOpacity01(options.opacity);
    if (op != null) {
      if (config.type === 'spheres3d') config.spheres.opacity = op;
      if (config.type === 'circles2d') config.circles.fillOpacity = op;
      if (config.type === 'polygon2d') config.polygons.fillOpacity = op;
      if (config.type === 'triangles2d') config.triangles.fillOpacity = op;
      if (config.type === 'triangles3d') config.prisms.opacity = op;
      if (config.type === 'hexgrid2d') config.hexgrid.fillOpacity = op;
    }
  }

   // Type-specific overrides (only if user supplied those flags)
  if (config.type === 'popsicle') {
     if (fromCli('count') && options.count != null) config.stickCount = parseInt(options.count, 10);
     if (fromCli('stickOverhang') && options.stickOverhang != null) config.stickOverhang = parseFloat(options.stickOverhang);
     if (fromCli('rotationCenterOffsetX') && options.rotationCenterOffsetX != null) config.rotationCenterOffsetX = parseFloat(options.rotationCenterOffsetX);
     if (fromCli('rotationCenterOffsetY') && options.rotationCenterOffsetY != null) config.rotationCenterOffsetY = parseFloat(options.rotationCenterOffsetY);
     if (fromCli('gap') && options.gap != null) config.stickGap = parseFloat(options.gap);
     if (fromCli('size') && options.size != null) config.stickSize = parseFloat(options.size);
     if (fromCli('ratio') && options.ratio != null) config.stickRatio = parseFloat(options.ratio);
     if (fromCli('thickness') && options.thickness != null) config.stickThickness = parseFloat(options.thickness);
     if (fromCli('roundness') && options.roundness != null) config.stickRoundness = parseFloat(options.roundness);
     if (fromCli('bevel') && options.bevel != null) config.stickBevel = parseFloat(options.bevel);

     if (fromCli('stickOpacity') && options.stickOpacity != null) {
       const stickOpacityRaw = parseFloat(options.stickOpacity);
       if (Number.isFinite(stickOpacityRaw)) config.stickOpacity = Math.max(0, Math.min(1, stickOpacityRaw));
     }
  }

  if (config.type === 'spheres3d') {
    if (fromCli('count') && options.count != null) config.spheres.count = parseInt(options.count, 10);

    if (fromCli('spheresDistribution') && options.spheresDistribution != null) {
      const d = String(options.spheresDistribution);
      config.spheres.distribution = d === 'scatter' || d === 'layeredDepth' ? d : 'jitteredGrid';
    }

    if (fromCli('spheresRadiusMin') && options.spheresRadiusMin != null) {
      const v = parseFloat(options.spheresRadiusMin);
      if (Number.isFinite(v)) config.spheres.radiusMin = v;
    }
    if (fromCli('spheresRadiusMax') && options.spheresRadiusMax != null) {
      const v = parseFloat(options.spheresRadiusMax);
      if (Number.isFinite(v)) config.spheres.radiusMax = v;
    }
    if (fromCli('spheresSpread') && options.spheresSpread != null) {
      const v = parseFloat(options.spheresSpread);
      if (Number.isFinite(v)) config.spheres.spread = v;
    }
    if (fromCli('spheresDepth') && options.spheresDepth != null) {
      const v = parseFloat(options.spheresDepth);
      if (Number.isFinite(v)) config.spheres.depth = v;
    }
    if (fromCli('spheresLayers') && options.spheresLayers != null) {
      const v = parseInt(options.spheresLayers, 10);
      if (Number.isFinite(v)) config.spheres.layers = v;
    }
  }

  if (config.type === 'circles2d') {
    if (fromCli('count') && options.count != null) config.circles.count = parseInt(options.count, 10);

    if (fromCli('circlesMode') && options.circlesMode != null) {
      const m = String(options.circlesMode);
      config.circles.mode = m === 'grid' ? 'grid' : 'scatter';
    }
    if (fromCli('circlesRMin') && options.circlesRMin != null) {
      const v = parseFloat(options.circlesRMin);
      if (Number.isFinite(v)) config.circles.rMinPx = v;
    }
    if (fromCli('circlesRMax') && options.circlesRMax != null) {
      const v = parseFloat(options.circlesRMax);
      if (Number.isFinite(v)) config.circles.rMaxPx = v;
    }
    if (fromCli('circlesJitter') && options.circlesJitter != null) {
      const v = parseOpacity01(options.circlesJitter);
      if (v != null) config.circles.jitter = v;
    }
    if (fromCli('circlesFillOpacity') && options.circlesFillOpacity != null) {
      const v = parseOpacity01(options.circlesFillOpacity);
      if (v != null) config.circles.fillOpacity = v;
    }

    if (fromCli('circlesStroke')) config.circles.stroke.enabled = Boolean(options.circlesStroke);
    if (fromCli('circlesStrokeWidth') && options.circlesStrokeWidth != null) {
      const v = parseFloat(options.circlesStrokeWidth);
      if (Number.isFinite(v)) config.circles.stroke.widthPx = v;
    }
    if (fromCli('circlesStrokeColor') && options.circlesStrokeColor != null) config.circles.stroke.color = String(options.circlesStrokeColor);
    if (fromCli('circlesStrokeOpacity') && options.circlesStrokeOpacity != null) {
      const v = parseOpacity01(options.circlesStrokeOpacity);
      if (v != null) config.circles.stroke.opacity = v;
    }

    if (fromCli('croissant')) config.circles.croissant.enabled = Boolean(options.croissant);
    if (fromCli('croissantInnerScale') && options.croissantInnerScale != null) {
      const v = parseOpacity01(options.croissantInnerScale);
      if (v != null) config.circles.croissant.innerScale = v;
    }
    if (fromCli('croissantOffset') && options.croissantOffset != null) {
      const v = parseOpacity01(options.croissantOffset);
      if (v != null) config.circles.croissant.offset = v;
    }
    if (fromCli('croissantAngleJitter') && options.croissantAngleJitter != null) {
      const v = parseFloat(options.croissantAngleJitter);
      if (Number.isFinite(v)) config.circles.croissant.angleJitterDeg = v;
    }
  }

  if (config.type === 'polygon2d') {
    if (fromCli('count') && options.count != null) config.polygons.count = parseInt(options.count, 10);
    if (fromCli('polygonCount') && options.polygonCount != null) config.polygons.count = parseInt(options.polygonCount, 10);

    if (fromCli('polygonEdges') && options.polygonEdges != null) {
      const v = Math.round(parseFloat(options.polygonEdges));
      if (Number.isFinite(v)) config.polygons.edges = clamp(v, 3, 128);
    }
    if (fromCli('polygonRMin') && options.polygonRMin != null) {
      const v = parseFloat(options.polygonRMin);
      if (Number.isFinite(v)) config.polygons.rMinPx = v;
    }
    if (fromCli('polygonRMax') && options.polygonRMax != null) {
      const v = parseFloat(options.polygonRMax);
      if (Number.isFinite(v)) config.polygons.rMaxPx = v;
    }
    if (fromCli('polygonJitter') && options.polygonJitter != null) {
      const v = parseOpacity01(options.polygonJitter);
      if (v != null) config.polygons.jitter = v;
    }
    if (fromCli('polygonRotate') && options.polygonRotate != null) {
      const v = parseFloat(options.polygonRotate);
      if (Number.isFinite(v)) config.polygons.rotateJitterDeg = v;
    }
    if (fromCli('polygonFillOpacity') && options.polygonFillOpacity != null) {
      const v = parseOpacity01(options.polygonFillOpacity);
      if (v != null) config.polygons.fillOpacity = v;
    }

    if (fromCli('polygonStroke')) config.polygons.stroke.enabled = Boolean(options.polygonStroke);
    if (fromCli('polygonStrokeWidth') && options.polygonStrokeWidth != null) {
      const v = parseFloat(options.polygonStrokeWidth);
      if (Number.isFinite(v)) config.polygons.stroke.widthPx = v;
    }
    if (fromCli('polygonStrokeColor') && options.polygonStrokeColor != null) config.polygons.stroke.color = String(options.polygonStrokeColor);
    if (fromCli('polygonStrokeOpacity') && options.polygonStrokeOpacity != null) {
      const v = parseOpacity01(options.polygonStrokeOpacity);
      if (v != null) config.polygons.stroke.opacity = v;
    }
  }

  if (config.type === 'triangles2d') {
    if (fromCli('triangles2dMode') && options.triangles2dMode != null) {
      const m = String(options.triangles2dMode);
      config.triangles.mode = m === 'scatter' || m === 'lowpoly' ? m : 'tessellation';
    }
    if (fromCli('trianglesDensity') && options.trianglesDensity != null) {
      const v = parseFloat(options.trianglesDensity);
      if (Number.isFinite(v)) config.triangles.density = v;
    }
    if (fromCli('trianglesScale') && options.trianglesScale != null) {
      const v = parseFloat(options.trianglesScale);
      if (Number.isFinite(v)) config.triangles.scalePx = v;
    }
    if (fromCli('trianglesJitter') && options.trianglesJitter != null) {
      const v = parseOpacity01(options.trianglesJitter);
      if (v != null) config.triangles.jitter = v;
    }
    if (fromCli('trianglesRotateJitter') && options.trianglesRotateJitter != null) {
      const v = parseFloat(options.trianglesRotateJitter);
      if (Number.isFinite(v)) config.triangles.rotateJitterDeg = v;
    }
    if (fromCli('trianglesInset') && options.trianglesInset != null) {
      const v = parseFloat(options.trianglesInset);
      if (Number.isFinite(v)) config.triangles.insetPx = v;
    }
    if (fromCli('trianglesFillOpacity') && options.trianglesFillOpacity != null) {
      const v = parseOpacity01(options.trianglesFillOpacity);
      if (v != null) config.triangles.fillOpacity = v;
    }

    if (fromCli('trianglesStroke')) config.triangles.stroke.enabled = Boolean(options.trianglesStroke);
    if (fromCli('trianglesStrokeWidth') && options.trianglesStrokeWidth != null) {
      const v = parseFloat(options.trianglesStrokeWidth);
      if (Number.isFinite(v)) config.triangles.stroke.widthPx = v;
    }
    if (fromCli('trianglesStrokeColor') && options.trianglesStrokeColor != null) config.triangles.stroke.color = String(options.trianglesStrokeColor);
    if (fromCli('trianglesStrokeOpacity') && options.trianglesStrokeOpacity != null) {
      const v = parseOpacity01(options.trianglesStrokeOpacity);
      if (v != null) config.triangles.stroke.opacity = v;
    }

    if (fromCli('trianglesShading')) config.triangles.shading.enabled = Boolean(options.trianglesShading);
    if (fromCli('trianglesLight') && options.trianglesLight != null) {
      const v = parseFloat(options.trianglesLight);
      if (Number.isFinite(v)) config.triangles.shading.lightDeg = v;
    }
    if (fromCli('trianglesShadingStrength') && options.trianglesShadingStrength != null) {
      const v = parseOpacity01(options.trianglesShadingStrength);
      if (v != null) config.triangles.shading.strength = v;
    }
  }

  if (config.type === 'triangles3d') {
    if (fromCli('count') && options.count != null) config.prisms.count = parseInt(options.count, 10);

    if (fromCli('prismsMode') && options.prismsMode != null) {
      const m = String(options.prismsMode);
      config.prisms.mode = m === 'scatter' || m === 'stackedPrisms' ? m : 'tessellation';
    }
    if (fromCli('prismsRadius') && options.prismsRadius != null) {
      const v = parseFloat(options.prismsRadius);
      if (Number.isFinite(v)) config.prisms.radius = v;
    }
    if (fromCli('prismsHeight') && options.prismsHeight != null) {
      const v = parseFloat(options.prismsHeight);
      if (Number.isFinite(v)) config.prisms.height = v;
    }
    if (fromCli('prismsSpread') && options.prismsSpread != null) {
      const v = parseFloat(options.prismsSpread);
      if (Number.isFinite(v)) config.prisms.spread = v;
    }
    if (fromCli('prismsJitter') && options.prismsJitter != null) {
      const v = parseOpacity01(options.prismsJitter);
      if (v != null) config.prisms.jitter = v;
    }
  }

  if (config.type === 'hexgrid2d') {
    if (fromCli('hexRadius') && options.hexRadius != null) {
      const v = parseFloat(options.hexRadius);
      if (Number.isFinite(v)) config.hexgrid.radiusPx = v;
    }
    if (fromCli('hexMargin') && options.hexMargin != null) {
      const v = parseFloat(options.hexMargin);
      if (Number.isFinite(v)) config.hexgrid.marginPx = v;
    }
    if (fromCli('hexOriginX') && options.hexOriginX != null) {
      const v = parseFloat(options.hexOriginX);
      if (Number.isFinite(v)) config.hexgrid.originPx.x = v;
    }
    if (fromCli('hexOriginY') && options.hexOriginY != null) {
      const v = parseFloat(options.hexOriginY);
      if (Number.isFinite(v)) config.hexgrid.originPx.y = v;
    }
    if (fromCli('hexOverscan') && options.hexOverscan != null) {
      const v = parseFloat(options.hexOverscan);
      if (Number.isFinite(v)) config.hexgrid.overscanPx = v;
    }
    if (fromCli('hexFillOpacity') && options.hexFillOpacity != null) {
      const v = parseOpacity01(options.hexFillOpacity);
      if (v != null) config.hexgrid.fillOpacity = v;
    }

    if (fromCli('hexStroke')) config.hexgrid.stroke.enabled = Boolean(options.hexStroke);
    if (fromCli('hexStrokeWidth') && options.hexStrokeWidth != null) {
      const v = parseFloat(options.hexStrokeWidth);
      if (Number.isFinite(v)) config.hexgrid.stroke.widthPx = v;
    }
    if (fromCli('hexStrokeColor') && options.hexStrokeColor != null) config.hexgrid.stroke.color = String(options.hexStrokeColor);
    if (fromCli('hexStrokeOpacity') && options.hexStrokeOpacity != null) {
      const v = parseOpacity01(options.hexStrokeOpacity);
      if (v != null) config.hexgrid.stroke.opacity = v;
    }
    if (fromCli('hexStrokeJoin') && options.hexStrokeJoin != null) {
      const j = String(options.hexStrokeJoin);
      config.hexgrid.stroke.join = j === 'miter' || j === 'bevel' ? j : 'round';
    }

    if (fromCli('hexPaletteMode') && options.hexPaletteMode != null) {
      const m = String(options.hexPaletteMode);
      config.hexgrid.coloring.paletteMode = m === 'weighted' ? 'weighted' : 'cycle';
    }
    if (fromCli('hexWeightsMode') && options.hexWeightsMode != null) {
      const m = String(options.hexWeightsMode);
      config.hexgrid.coloring.weightsMode = m === 'preset' || m === 'custom' ? m : 'auto';
    }
    if (fromCli('hexWeightsPreset') && options.hexWeightsPreset != null) {
      const p = String(options.hexWeightsPreset);
      config.hexgrid.coloring.preset = p === 'dominant' || p === 'accents' || p === 'rare-accents' ? p : 'equal';
    }
    if (fromCli('hexWeights') && options.hexWeights != null) {
      config.hexgrid.coloring.weightsMode = 'custom';
      config.hexgrid.coloring.weights = parseNumberList(options.hexWeights);
    }

    if (fromCli('hexEffectKind') && options.hexEffectKind != null) {
      const k = String(options.hexEffectKind);
      config.hexgrid.effect.kind = k === 'bevel' || k === 'grain' || k === 'gradient' ? k : 'none';
    }
    if (fromCli('hexEffectAmount') && options.hexEffectAmount != null) {
      const v = parseOpacity01(options.hexEffectAmount);
      if (v != null) config.hexgrid.effect.amount = v;
    }
    if (fromCli('hexEffectFrequency') && options.hexEffectFrequency != null) {
      const v = parseFloat(options.hexEffectFrequency);
      if (Number.isFinite(v)) config.hexgrid.effect.frequency = v;
    }

    if (fromCli('hexGroupingMode') && options.hexGroupingMode != null) {
      const m = String(options.hexGroupingMode);
      config.hexgrid.grouping.mode = m === 'voronoi' || m === 'noise' || m === 'random-walk' ? m : 'none';
    }
    if (fromCli('hexGroupingStrength') && options.hexGroupingStrength != null) {
      const v = parseOpacity01(options.hexGroupingStrength);
      if (v != null) config.hexgrid.grouping.strength = v;
    }
    if (fromCli('hexGroupingTarget') && options.hexGroupingTarget != null) {
      const v = parseInt(options.hexGroupingTarget, 10);
      if (Number.isFinite(v)) config.hexgrid.grouping.targetGroupCount = v;
    }
  }
  // triangles3d count handled above

  const format = (options.format ?? 'png') as ExportFormat;
  return { config, format };
}

program.parse();
