#!/usr/bin/env node

import { Command } from 'commander';
import {
  WallpaperConfig,
  DEFAULT_CONFIG,
  RESOLUTION_PRESETS,
  ResolutionPreset,
  TextureType,
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
  .option('-W, --width <width>', 'Image width in pixels')
  .option('-H, --height <height>', 'Image height in pixels')
  .option('-r, --resolution <preset>', 'Use a preset resolution (1080p, 1440p, 4k, mobile, square, ultrawide)')
  .option('-c, --colors <colors>', 'Comma-separated hex colors (e.g., "#ff0000,#00ff00")')
    .option('-T, --texture <texture>', 'Texture type (glossy, matte, metallic, drywall, glass, mirror, cel)', 'glossy')
    .option('-b, --background <color>', 'Background color (hex)', '#1a1a2e')
   .option('-n, --count <number>', 'Number of sticks', '12')
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
  .action(async (options) => {
    try {
      const { config, format } = buildConfigAndFormat(options);
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

function buildConfigAndFormat(options: any): { config: WallpaperConfig; format: ExportFormat } {
  if (options.cfg) {
    const state = decodeAppStateFromBase64Url(String(options.cfg)) as WallpaperAppStateV1;
    const cfg = state.c;
    const fmt = (options.format ?? state.f ?? 'png') as ExportFormat;
    return { config: cfg, format: fmt };
  }

  let width = DEFAULT_CONFIG.width;
  let height = DEFAULT_CONFIG.height;
  
  if (options.resolution) {
    const preset = options.resolution as ResolutionPreset;
    if (preset in RESOLUTION_PRESETS) {
      const { width: w, height: h } = RESOLUTION_PRESETS[preset];
      width = w;
      height = h;
    } else {
      console.warn(`Unknown resolution preset: ${options.resolution}`);
    }
  }
  
  if (options.width) width = parseInt(options.width, 10);
  if (options.height) height = parseInt(options.height, 10);
  
   let colors = DEFAULT_CONFIG.colors;
   const backgroundColor = DEFAULT_CONFIG.backgroundColor;
   
   if (options.colors) {
     colors = options.colors.split(',').map((c: string) => c.trim());
   }
  
     const toneMapping = String(options.toneMapping ?? DEFAULT_CONFIG.rendering.toneMapping);
     const envStyle = String(options.envStyle ?? DEFAULT_CONFIG.environment.style);
     const shadowType = String(options.shadowType ?? DEFAULT_CONFIG.shadows.type);

      const stickOpacityRaw = parseFloat(options.stickOpacity);
      const stickOpacity = Number.isFinite(stickOpacityRaw)
        ? Math.max(0, Math.min(1, stickOpacityRaw))
        : DEFAULT_CONFIG.stickOpacity;

       const config: WallpaperConfig = {
         type: options.type as 'popsicle',
         seed: DEFAULT_CONFIG.seed,
         width,
         height,
         colors,
         texture: options.texture as TextureType,
         textureParams: DEFAULT_CONFIG.textureParams,
         backgroundColor: options.background || backgroundColor,
       stickCount: parseInt(options.count, 10),
      stickOverhang: parseFloat(options.stickOverhang),
       rotationCenterOffsetX: parseFloat(options.rotationCenterOffsetX),
       rotationCenterOffsetY: parseFloat(options.rotationCenterOffsetY),
       stickGap: parseFloat(options.gap),
      stickSize: parseFloat(options.size),
      stickRatio: parseFloat(options.ratio),
      stickThickness: parseFloat(options.thickness),
      stickRoundness: parseFloat(options.roundness),
      stickBevel: parseFloat(options.bevel),
      stickOpacity,
      lighting: {
        enabled: options.lighting,
       intensity: parseFloat(options.lightIntensity),
       position: {
         x: parseFloat(options.lightX),
         y: parseFloat(options.lightY),
         z: parseFloat(options.lightZ)
       },
       ambientIntensity: parseFloat(options.ambient)
     },
     camera: {
       distance: parseFloat(options.cameraDistance),
       azimuth: parseFloat(options.cameraAzimuth),
       elevation: parseFloat(options.cameraElevation)
      },
      rendering: {
        toneMapping: toneMapping === 'none' ? 'none' : 'aces',
        exposure: Number.isFinite(parseFloat(options.exposure)) ? parseFloat(options.exposure) : DEFAULT_CONFIG.rendering.exposure
      },
      environment: {
        enabled: Boolean(options.environment),
        intensity: Number.isFinite(parseFloat(options.envIntensity)) ? parseFloat(options.envIntensity) : DEFAULT_CONFIG.environment.intensity,
        rotation: Number.isFinite(parseFloat(options.envRotation)) ? parseFloat(options.envRotation) : DEFAULT_CONFIG.environment.rotation,
        style: envStyle === 'overcast' || envStyle === 'sunset' ? envStyle : 'studio'
      },
      shadows: {
        enabled: Boolean(options.shadows),
        type: shadowType === 'vsm' ? 'vsm' : 'pcfsoft',
        mapSize: Number.isFinite(parseInt(options.shadowMapSize, 10)) ? parseInt(options.shadowMapSize, 10) : DEFAULT_CONFIG.shadows.mapSize,
        bias: Number.isFinite(parseFloat(options.shadowBias)) ? parseFloat(options.shadowBias) : DEFAULT_CONFIG.shadows.bias,
        normalBias: Number.isFinite(parseFloat(options.shadowNormalBias)) ? parseFloat(options.shadowNormalBias) : DEFAULT_CONFIG.shadows.normalBias
      },
       geometry: {
         quality: Number.isFinite(parseFloat(options.geometryQuality)) ? parseFloat(options.geometryQuality) : DEFAULT_CONFIG.geometry.quality
       }
      };
  
  const format = (options.format ?? 'png') as ExportFormat;
  return { config, format };
}

program.parse();
