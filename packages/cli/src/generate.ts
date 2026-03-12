import { WallpaperConfig, createPopsicleScene } from '@wallpaper-maker/core';
import puppeteer from 'puppeteer';
import { createCanvas } from 'canvas';

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
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    const html = generateHTML(config);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
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
  }
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
    
    svg += `  <rect x="${x - stickWidth/2}" y="${y - stickHeight/2}" width="${stickWidth}" height="${stickHeight}" rx="${rx}" ry="${ry}" fill="url(#${gradientId})" transform="rotate(${rotation} ${x} ${y})" opacity="0.95"/>
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

function generateHTML(config: WallpaperConfig): string {
  const configJson = JSON.stringify(config);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; overflow: hidden; background: ${config.backgroundColor}; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
    }
  }
  </script>
  <script type="module">
    import * as THREE from 'three';
    
    const config = ${configJson};
    
    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function getStickDimensions(canvasWidth, canvasHeight, stickThickness, stickSize, stickRatio) {
      const aspect = canvasWidth / canvasHeight;
      const baseSize = 8;

      const rawSize = Number(stickSize);
      const rawRatio = Number(stickRatio);
      const safeSize = clamp(Number.isFinite(rawSize) ? rawSize : 1.0, 0.01, 100);
      const safeRatio = clamp(Number.isFinite(rawRatio) ? rawRatio : 3.0, 0.05, 100);

      const baseWidth = baseSize * aspect * 0.15 * safeSize;
      const baseHeight = baseSize * 0.8 * safeSize;
      const area = baseWidth * baseHeight;

      const width = Math.sqrt(area / safeRatio);
      const height = Math.sqrt(area * safeRatio);

      return {
        width,
        height,
        depth: baseSize * aspect * 0.02 * stickThickness * safeSize
      };
    }
    
    function createMaterial(texture, color) {
      const baseConfig = {
        color: color,
        transparent: true,
        opacity: 0.95
      };

      switch (texture) {
        case 'glossy':
          return new THREE.MeshPhysicalMaterial({
            ...baseConfig,
            roughness: 0.1,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 1.0
          });
        case 'metallic':
          return new THREE.MeshPhysicalMaterial({
            ...baseConfig,
            roughness: 0.3,
            metalness: 0.8,
            clearcoat: 0.5,
            clearcoatRoughness: 0.2
          });
        case 'matte':
        default:
          return new THREE.MeshPhysicalMaterial({
            ...baseConfig,
            roughness: 0.9,
            metalness: 0.0,
            clearcoat: 0.0
          });
      }
    }
    
    function createRoundedBox(width, height, depth, roundness, bevel) {
      const safeRoundness = Math.max(0, Math.min(1, roundness));
      const safeBevel = Math.max(0, Math.min(1, bevel));
      const maxRadius = Math.min(width, height) / 2;
      const radius = maxRadius * safeRoundness;

      const shape = new THREE.Shape();
      const x = -width / 2;
      const y = -height / 2;

      if (radius <= 0) {
        shape.moveTo(x, y);
        shape.lineTo(x + width, y);
        shape.lineTo(x + width, y + height);
        shape.lineTo(x, y + height);
        shape.closePath();
      } else {
        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + height - radius);
        shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        shape.lineTo(x + radius, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);
      }
      
      const maxBevel = Math.min(width, height) * 0.15;
      const bevelSize = maxBevel * safeBevel;
      const bevelThickness = maxBevel * safeBevel;

      const extrudeSettings = {
        depth: depth,
        bevelEnabled: safeBevel > 0,
        bevelSegments: 4,
        steps: 1,
        bevelSize,
        bevelThickness,
        curveSegments: 12
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.center();
      
       return geometry;
     }
     
     function degToRad(deg) {
       return (deg * Math.PI) / 180;
     }

      function getStackingOffset(index, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap) {
        // Helix stacking with rotation
        const rotationAngle = index * degToRad(stickOverhang);
        
        const offsetXPercent = rotationCenterOffsetX / 100;
        const offsetYPercent = rotationCenterOffsetY / 100;
        
        const pivotX = offsetXPercent * (stickDimensions.width / 2);
        const pivotY = offsetYPercent * (stickDimensions.height / 2);
        
        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);
        
        const offsetX = pivotX * (1 - cos) + pivotY * sin;
        const offsetY = pivotY * (1 - cos) - pivotX * sin;
        
        return {
          x: offsetX,
          y: offsetY,
          z: index * (stickDimensions.depth + stickGap),
          rotationZ: rotationAngle
        };
      }
    
      const {
        width,
        height,
        colors,
        texture,
        backgroundColor,
        stickCount,
        stickOverhang,
        rotationCenterOffsetX,
        rotationCenterOffsetY,
        stickGap,
        stickSize,
        stickRatio,
        stickThickness,
        stickRoundness,
        stickBevel,
        lighting,
        camera: cameraConfig
      } = config;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    
    const aspect = width / height;
    const frustumSize = 10;
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    const azimuthRad = (cameraConfig.azimuth * Math.PI) / 180;
    const elevationRad = (cameraConfig.elevation * Math.PI) / 180;
    camera.position.set(
      cameraConfig.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
      cameraConfig.distance * Math.sin(elevationRad),
      cameraConfig.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    // Orthographic cameras don't change size with distance; convert distance to zoom.
    camera.zoom = 17.3 / Math.max(0.1, cameraConfig.distance);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    
    if (lighting.enabled) {
      const ambientLight = new THREE.AmbientLight(0xffffff, lighting.ambientIntensity);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, lighting.intensity);
      directionalLight.position.set(
        lighting.position.x,
        lighting.position.y,
        lighting.position.z
      );
      directionalLight.castShadow = true;
      scene.add(directionalLight);
      
      const fillLight = new THREE.DirectionalLight(0xffffff, lighting.intensity * 0.3);
      fillLight.position.set(-lighting.position.x, -lighting.position.y, lighting.position.z * 0.5);
      scene.add(fillLight);
    } else {
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      scene.add(ambientLight);
    }
    
      const stickDimensions = getStickDimensions(width, height, stickThickness, stickSize, stickRatio);
     
     const group = new THREE.Group();
     
     for (let i = 0; i < stickCount; i++) {
       const color = colors[i % colors.length];
       const material = createMaterial(texture, color);
       const geometry = createRoundedBox(
         stickDimensions.width,
         stickDimensions.height,
         stickDimensions.depth,
         stickRoundness,
         stickBevel
       );
       
        const mesh = new THREE.Mesh(geometry, material);
        
        const offset = getStackingOffset(i, stickDimensions, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY, stickGap);
        
        mesh.position.set(offset.x, offset.y, offset.z);
       mesh.rotation.z = offset.rotationZ;
      
      group.add(mesh);
    }
    
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
    
    scene.add(group);
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    document.body.appendChild(renderer.domElement);
    
    renderer.render(scene, camera);
    
    window.wallpaperRendered = true;
  </script>
</body>
</html>
  `;
}
