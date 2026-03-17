import { WallpaperConfig, encodeAppStateToBase64Url } from '@wallpaper-maker/core';
import puppeteer from 'puppeteer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, resolve } from 'node:path';

export interface GenerateResult {
  data: Uint8Array | string;
  format: string;
  mimeType: string;
}

export async function generateWallpaper(
  config: WallpaperConfig,
  format: 'png' | 'jpg' | 'webp' | 'svg'
): Promise<GenerateResult> {
  if (format === 'svg') {
    return generateSVG(config);
  }
  
  return generateRaster(config, format);
}

async function generateRaster(
  config: WallpaperConfig,
  format: 'png' | 'jpg' | 'webp'
): Promise<GenerateResult> {
  const cfg = encodeAppStateToBase64Url({ v: 1, c: config, f: format, m: 'raster' });

  const server = await startRendererServer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();

    await page.goto(`${server.url}/index.html?cfg=${encodeURIComponent(cfg)}`, { waitUntil: 'domcontentloaded' });
    
    await page.setViewport({
      width: config.width,
      height: config.height,
      deviceScaleFactor: 1
    });
    
    await page.waitForFunction(() => {
      return (globalThis as any).wallpaperRendered === true;
    }, { timeout: 30000 });
    
    const screenshotOptions: any = {
      type: format === 'jpg' ? 'jpeg' : format,
      omitBackground: false
    };
    
    if (format === 'jpg' || format === 'webp') {
      screenshotOptions.quality = 95;
    }
    
    const buffer = await page.screenshot(screenshotOptions) as unknown as Buffer;
    
    const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    
    return {
      data: new Uint8Array(buffer),
      format,
      mimeType
    };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function startRendererServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const coreDistDirUrl = new URL('../../core/dist/', import.meta.url);
  const coreDistDirPath = fileURLToPath(coreDistDirUrl);

  const contentTypeByExt: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };

  const importMapJson = JSON.stringify(
    {
      imports: {
        three: 'https://unpkg.com/three@0.180.0/build/three.module.js'
      }
    },
    null,
    2
  );

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; }
      canvas { display: block; }
    </style>
    <script type="importmap">${importMapJson}</script>
  </head>
  <body>
    <canvas id="c"></canvas>
    <script type="module">
      import { createPopsicleScene, decodeAppStateFromBase64Url } from '/core/index.js';
      import { EffectComposer } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js';
      import { RenderPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/RenderPass.js';
      import { UnrealBloomPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass.js';
      import { Vector2 } from 'three';

      const sp = new URLSearchParams(location.search);
      const cfg = sp.get('cfg');
      if (!cfg) throw new Error('Missing cfg');

      const state = decodeAppStateFromBase64Url(cfg);
      const config = state.c;

      const canvas = document.getElementById('c');
      const { scene, camera, renderer } = createPopsicleScene(config, { canvas, preserveDrawingBuffer: true, pixelRatio: 1 });
      renderer.setSize(config.width, config.height, false);
      renderer.setPixelRatio(1);

      if (config.bloom && config.bloom.enabled) {
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(
          new UnrealBloomPass(
            new Vector2(config.width, config.height),
            config.bloom.strength,
            config.bloom.radius,
            config.bloom.threshold
          )
        );
        composer.render();
        composer.dispose();
      } else {
        renderer.render(scene, camera);
      }
      globalThis.wallpaperRendered = true;
    </script>
  </body>
</html>`;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
        return;
      }

      if (url.pathname.startsWith('/core/')) {
        const rel = url.pathname.slice('/core/'.length);
        const safeRel = normalize(rel).replace(/^([/\\])+/, '');
        const abs = resolve(join(coreDistDirPath, safeRel));

        if (!abs.startsWith(coreDistDirPath)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        const data = await readFile(abs);
        const ext = extname(abs);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeByExt[ext] || 'application/octet-stream');
        res.end(data);
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    } catch (err: any) {
      res.statusCode = 500;
      res.end(String(err?.stack || err));
    }
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    server.close();
    throw new Error('Failed to bind renderer server');
  }

  const url = `http://127.0.0.1:${addr.port}`;
  return {
    url,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((err) => (err ? rejectClose(err) : resolveClose()));
    })
  };
}

function generateSVG(config: WallpaperConfig): GenerateResult {
  const {
    width,
    height,
    colors,
    backgroundColor,
    stickCount,
    stickOverhang,
    rotationCenterOffsetX,
    rotationCenterOffsetY
  } = config;

  const stickSize = (config as any).stickSize ?? 1.0;
  const stickRatio = (config as any).stickRatio ?? 3.0;
  const stickOpacityRaw = (config as any).stickOpacity;
  const stickOpacity = Math.max(0, Math.min(1, Number.isFinite(Number(stickOpacityRaw)) ? Number(stickOpacityRaw) : 1.0));

  const sizeNum = Number(stickSize);
  const ratioNum = Number(stickRatio);
  const safeSize = Math.max(0.01, Number.isFinite(sizeNum) ? sizeNum : 1.0);
  const safeRatio = Math.max(0.05, Number.isFinite(ratioNum) ? ratioNum : 3.0);

  // Base footprint matches historical defaults; ratio re-shapes while preserving area.
  const baseStickWidth = width * 0.15 * safeSize;
  const baseStickHeight = height * 0.8 * safeSize;
  const area = baseStickWidth * baseStickHeight;

  const stickWidth = Math.sqrt(area / safeRatio);
  const stickHeight = Math.sqrt(area * safeRatio);
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
`;
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  for (let i = 0; i < stickCount; i++) {
    const color = colors[i % colors.length];
    
    let x = centerX;
    let y = centerY;
    
    // Helix stacking with rotation
    const rotationAngle = (i * stickOverhang * Math.PI) / 180;
    const offsetXPercent = rotationCenterOffsetX / 100;
    const offsetYPercent = rotationCenterOffsetY / 100;
    
    const pivotX = offsetXPercent * (stickWidth / 2);
    const pivotY = offsetYPercent * (stickHeight / 2);
    
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    
    const offsetX = pivotX * (1 - cos) + pivotY * sin;
    const offsetY = pivotY * (1 - cos) - pivotX * sin;
    
    x += offsetX;
    y += offsetY;
    const rotation = (rotationAngle * 180) / Math.PI;
    
    const maxRadius = Math.min(stickWidth, stickHeight) / 2;
    const radius = maxRadius * Math.max(0, Math.min(1, config.stickRoundness ?? 0));
    const rx = radius;
    const ry = radius;
    
    const gradientId = `grad-${i}`;
    svg += `  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustBrightness(color, -20)};stop-opacity:1" />
    </linearGradient>
  </defs>
`;
    
    svg += `  <rect x="${x - stickWidth/2}" y="${y - stickHeight/2}" width="${stickWidth}" height="${stickHeight}" rx="${rx}" ry="${ry}" fill="url(#${gradientId})" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>
`;
  }
  
  svg += '</svg>';
  
  return {
    data: svg,
    format: 'svg',
    mimeType: 'image/svg+xml'
  };
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x00FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
