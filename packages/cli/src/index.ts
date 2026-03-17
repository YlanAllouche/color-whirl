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
  .option('-n, --count <number>', 'Count (sticks/spheres/prisms)', '12')
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

function buildConfigAndFormat(options: any, command: Command): { config: WallpaperConfig; format: ExportFormat } {
  if (options.cfg) {
    const state = decodeAppStateFromBase64Url(String(options.cfg)) as WallpaperAppStateV1;
    const cfg = state.c;
    const fmt = (options.format ?? state.f ?? 'png') as ExportFormat;
    return { config: cfg, format: fmt };
  }

  const typeRaw = String(options.type ?? 'popsicle') as WallpaperType;
  const type: WallpaperType = (typeRaw === 'popsicle' || typeRaw === 'spheres3d' || typeRaw === 'circles2d' || typeRaw === 'triangles2d' || typeRaw === 'triangles3d' || typeRaw === 'hexgrid2d')
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
   }
   if (config.type === 'triangles3d') {
     if (fromCli('count') && options.count != null) config.prisms.count = parseInt(options.count, 10);
   }

  const format = (options.format ?? 'png') as ExportFormat;
  return { config, format };
}

program.parse();
