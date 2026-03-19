#!/usr/bin/env node

import { Command } from 'commander';
import {
  WallpaperConfig,
  DEFAULT_CONFIG,
  decodeAppStateFromBase64Url,
  normalizeWallpaperConfig,
  type WallpaperAppStateV1,
  type ExportFormat
} from '@wallpaper-maker/core';
import { generateWallpaper } from './generate.js';
import { access, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const program = new Command();

program
  .name('wallpaper-maker')
  .description('Generate beautiful wallpapers from the command line')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a wallpaper')
  .option(
    '-c, --config <config>',
    'Config value: base64url app state, inline JSON (config or app state), or path to a JSON file (prefix with @ to force file)'
  )
  .option('-f, --format <format>', 'Output format (png, jpg, webp, svg)')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    try {
      const { config, format } = await buildConfigAndFormat(options);
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

type ParsedInput = {
  config: WallpaperConfig;
  formatFromState?: ExportFormat;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseExportFormat(value: unknown): ExportFormat {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'png' || s === 'jpg' || s === 'jpeg' || s === 'webp' || s === 'svg') {
    return (s === 'jpeg' ? 'jpg' : s) as ExportFormat;
  }
  return 'png';
}

function parseJsonPayload(payload: any): ParsedInput {
  if (payload && typeof payload === 'object' && payload.v === 1 && payload.c) {
    const state = payload as WallpaperAppStateV1;
    return {
      config: normalizeWallpaperConfig(state.c as any),
      formatFromState: parseExportFormat(state.f)
    };
  }
  return { config: normalizeWallpaperConfig(payload) };
}

async function readJsonFile(path: string): Promise<ParsedInput> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  return parseJsonPayload(parsed);
}

async function tryReadJsonFile(path: string): Promise<ParsedInput | null> {
  try {
    await access(path);
    return await readJsonFile(path);
  } catch {
    return null;
  }
}

async function parseConfigArg(value: unknown): Promise<ParsedInput> {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { config: cloneJson(DEFAULT_CONFIG) as WallpaperConfig };
  }

  // Force file mode via @prefix.
  if (raw.startsWith('@')) {
    const p = raw.slice(1);
    if (!p) throw new Error('Invalid --config: expected a file path after @');
    return await readJsonFile(p);
  }

  // Inline JSON.
  if (raw.startsWith('{') || raw.startsWith('[')) {
    return parseJsonPayload(JSON.parse(raw));
  }

  // If it looks like a file path and exists, treat it as such.
  const fromFile = await tryReadJsonFile(raw);
  if (fromFile) return fromFile;

  // Fallback: base64url-encoded app state (same payload as web URL cfg).
  try {
    const state = decodeAppStateFromBase64Url(raw) as WallpaperAppStateV1;
    return { config: normalizeWallpaperConfig(state.c as any), formatFromState: parseExportFormat(state.f) };
  } catch {
    // Ignore.
  }

  throw new Error('Invalid --config: expected inline JSON, a JSON file path, or a base64url app-state payload');
}

async function buildConfigAndFormat(options: any): Promise<{ config: WallpaperConfig; format: ExportFormat }> {
  const parsed = await parseConfigArg(options.config);
  const format = options.format ? parseExportFormat(options.format) : (parsed.formatFromState ?? 'png');
  return { config: parsed.config, format };
}

program.parse();
