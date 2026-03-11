#!/usr/bin/env node

import { Command } from 'commander';
import {
  WallpaperConfig,
  DEFAULT_CONFIG,
  RESOLUTION_PRESETS,
  COLOR_PALETTES,
  ResolutionPreset,
  ColorPalette,
  Direction,
  StackingMode,
  TextureType
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
  .option('-t, --type <type>', 'Wallpaper type', 'popsickle')
  .option('-W, --width <width>', 'Image width in pixels')
  .option('-H, --height <height>', 'Image height in pixels')
  .option('-r, --resolution <preset>', 'Use a preset resolution (1080p, 1440p, 4k, mobile, square, ultrawide)')
  .option('-c, --colors <colors>', 'Comma-separated hex colors (e.g., "#ff0000,#00ff00")')
  .option('-p, --palette <palette>', 'Use a preset color palette (sunset, ocean, forest, monochrome, candy, neon)')
  .option('-T, --texture <texture>', 'Texture type (glossy, matte, metallic)', 'glossy')
  .option('-b, --background <color>', 'Background color (hex)', '#1a1a2e')
  .option('-d, --direction <direction>', 'Stacking direction (top-bottom, left-right, top-right-to-bottom-left, bottom-left-to-top-right)', 'top-bottom')
  .option('-s, --stacking <mode>', 'Stacking mode (perfect, helix, unstacked)', 'helix')
  .option('-n, --count <number>', 'Number of sticks', '12')
  .option('--helix-angle <degrees>', 'Helix rotation angle in degrees (0-720)', '360')
  .option('--gap <number>', 'Gap between sticks (0-5.0)', '0.05')
  .option('--thickness <number>', 'Stick thickness multiplier', '1.0')
  .option('--roundness <number>', 'Stick end roundness (0-1)', '0.15')
  .option('--bevel <number>', 'Bevel amount (0-1)', '0.35')
  .option('--camera-distance <number>', 'Camera distance', '17.3')
  .option('--camera-azimuth <number>', 'Camera azimuth in degrees', '45')
  .option('--camera-elevation <number>', 'Camera elevation in degrees', '35.3')
  .option('-f, --format <format>', 'Output format (png, jpg, webp, svg)', 'png')
  .option('-q, --quality <number>', 'Image quality (0-1)', '0.95')
  .option('-o, --output <path>', 'Output file path')
  .option('--lighting', 'Enable lighting', true)
  .option('--no-lighting', 'Disable lighting')
  .option('--light-intensity <number>', 'Light intensity', '1.5')
  .option('--light-x <number>', 'Light X position', '5')
  .option('--light-y <number>', 'Light Y position', '5')
  .option('--light-z <number>', 'Light Z position', '5')
  .option('--ambient <number>', 'Ambient light intensity', '0.3')
  .action(async (options) => {
    try {
      const config = buildConfig(options);
      console.log('Generating wallpaper...');
      console.log(`Type: ${config.type}`);
      console.log(`Resolution: ${config.width}x${config.height}`);
      console.log(`Colors: ${config.colors.join(', ')}`);
      
      const result = await generateWallpaper(config, options.format);
      
      const outputPath = options.output || `wallpaper-${Date.now()}.${options.format}`;
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

function buildConfig(options: any): WallpaperConfig {
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
  
  if (options.palette) {
    const paletteName = options.palette as ColorPalette;
    if (paletteName in COLOR_PALETTES) {
      colors = [...COLOR_PALETTES[paletteName]];
    } else {
      console.warn(`Unknown color palette: ${options.palette}`);
    }
  }
  
  if (options.colors) {
    colors = options.colors.split(',').map((c: string) => c.trim());
  }
  
  const config: WallpaperConfig = {
    type: options.type as 'popsickle',
    width,
    height,
    colors,
    texture: options.texture as TextureType,
    backgroundColor: options.background,
    direction: options.direction as Direction,
    stacking: options.stacking as StackingMode,
    stickCount: parseInt(options.count, 10),
    helixAngle: parseFloat(options.helixAngle),
    stickGap: parseFloat(options.gap),
    stickThickness: parseFloat(options.thickness),
    stickRoundness: parseFloat(options.roundness),
    stickBevel: parseFloat(options.bevel),
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
    }
  };
  
  return config;
}

program.parse();
