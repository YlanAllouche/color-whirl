import { WallpaperConfig, exportToSVG, encodeAppStateToBase64Url } from '@wallpaper-maker/core';
import puppeteer from 'puppeteer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';

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
    const result = await exportToSVG(config);
    return { data: result.data as string, format: 'svg', mimeType: 'image/svg+xml' };
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

  const corePkgDirPath = resolve(join(coreDistDirPath, '..'));
  const threeBuildDirPath = resolve(join(corePkgDirPath, 'node_modules', 'three', 'build'));
  const threeExamplesJsmDirPath = resolve(join(corePkgDirPath, 'node_modules', 'three', 'examples', 'jsm'));

  const contentTypeByExt: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm'
  };

  const importMapJson = JSON.stringify(
    {
      imports: {
        three: '/three/build/three.module.js',
        'three/examples/jsm/': '/three/examples/jsm/'
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
      import { renderWallpaperToCanvas, decodeAppStateFromBase64Url } from '/core/index.js';

      const sp = new URLSearchParams(location.search);
      const cfg = sp.get('cfg');
      if (!cfg) throw new Error('Missing cfg');

      const state = decodeAppStateFromBase64Url(cfg);
      const config = state.c;

      const canvas = document.getElementById('c');
      renderWallpaperToCanvas(config, canvas);
      globalThis.wallpaperRendered = true;
    </script>
  </body>
</html>`;

  const serveFileFromDir = async (baseDir: string, relPath: string, res: ServerResponse) => {
    const safeRel = normalize(relPath).replace(/^([/\\])+/, '');
    const abs = resolve(join(baseDir, safeRel));
    const relToBase = relative(baseDir, abs);
    if (relToBase === '..' || relToBase.startsWith(`..${sep}`) || relToBase.includes(`..${sep}`) || relToBase.includes(`${sep}..`)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    const data = await readFile(abs);
    const ext = extname(abs);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypeByExt[ext] || 'application/octet-stream');
    res.end(data);
  };

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
        await serveFileFromDir(coreDistDirPath, rel, res);
        return;
      }

      if (url.pathname.startsWith('/three/build/')) {
        const rel = url.pathname.slice('/three/build/'.length);
        await serveFileFromDir(threeBuildDirPath, rel, res);
        return;
      }

      if (url.pathname.startsWith('/three/examples/jsm/')) {
        const rel = url.pathname.slice('/three/examples/jsm/'.length);
        await serveFileFromDir(threeExamplesJsmDirPath, rel, res);
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
