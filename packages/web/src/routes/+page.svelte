<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { 
    DEFAULT_CONFIG, 
    type WallpaperConfig,
    RESOLUTION_PRESETS,
    generateRandomConfigNoPresets,
    exportToPNG,
    exportToJPG,
    exportToWebP,
    exportToSVG,
    downloadFile
  } from '@wallpaper-maker/core';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>({ ...DEFAULT_CONFIG });
  
  let canvasContainer: HTMLDivElement;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  
  // Export format selection
  let exportFormat = $state<'png' | 'jpg' | 'webp' | 'svg'>('png');
  let isExporting = $state(false);
  
  // URL sync + CLI preview
  let urlSyncEnabled = $state(false);
  let cliCommand = $state('');

  type LockState = {
    colors: boolean;
    backgroundColor: boolean;
    texture: boolean;
    stickCount: boolean;
    stickOverhang: boolean;
    rotationCenterOffsetX: boolean;
    rotationCenterOffsetY: boolean;
    stickGap: boolean;
    stickThickness: boolean;
    stickRoundness: boolean;
    stickBevel: boolean;
    cameraDistance: boolean;
    cameraAzimuth: boolean;
    cameraElevation: boolean;
    lightingEnabled: boolean;
    lightingIntensity: boolean;
    lightingX: boolean;
    lightingY: boolean;
    lightingZ: boolean;
    lightingAmbient: boolean;
  };

  type LockKey = keyof LockState;

  // UI-only: locks are not synced to URL.
  let locks = $state<LockState>({
    colors: false,
    backgroundColor: false,
    texture: false,
    stickCount: false,
    stickOverhang: false,
    rotationCenterOffsetX: false,
    rotationCenterOffsetY: false,
    stickGap: false,
    stickThickness: false,
    stickRoundness: false,
    stickBevel: false,
    cameraDistance: false,
    cameraAzimuth: false,
    cameraElevation: false,
    lightingEnabled: false,
    lightingIntensity: false,
    lightingX: false,
    lightingY: false,
    lightingZ: false,
    lightingAmbient: false
  });

  function toggleLock(key: LockKey) {
    locks = { ...locks, [key]: !locks[key] };
  }
  
  // Derived values
  let aspectRatio = $derived(config.width / config.height);
  
  function createRoundedBox(
    width: number,
    height: number,
    depth: number,
    roundness: number,
    bevel: number
  ): THREE.BufferGeometry {
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

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
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
  
  function createMaterial(texture: string, color: string): THREE.MeshPhysicalMaterial {
    const baseConfig: THREE.MeshPhysicalMaterialParameters = {
      color: color,
      transparent: true,
      opacity: 0.98
    };

    switch (texture) {
      case 'glossy':
        return new THREE.MeshPhysicalMaterial({
          ...baseConfig,
          roughness: 0.05,
          metalness: 0.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          reflectivity: 1.0,
          ior: 1.5,
          transmission: 0.0,
          thickness: 0.1
        });
      case 'metallic':
        return new THREE.MeshPhysicalMaterial({
          ...baseConfig,
          roughness: 0.15,
          metalness: 1.0,
          clearcoat: 0.3,
          clearcoatRoughness: 0.1,
          reflectivity: 1.0,
          envMapIntensity: 1.5,
          ior: 2.0
        });
      case 'matte':
      default:
        return new THREE.MeshPhysicalMaterial({
          ...baseConfig,
          roughness: 0.95,
          metalness: 0.0,
          clearcoat: 0.0,
          sheen: 0.3,
          sheenRoughness: 0.8,
          sheenColor: new THREE.Color(0xffffff),
          reflectivity: 0.2
        });
    }
  }
  
   function getStickDimensions(
     canvasWidth: number, 
     canvasHeight: number,
     stickThickness: number
   ) {
     const aspect = canvasWidth / canvasHeight;
     const baseSize = 8;
     
     // Default to vertical orientation (top-bottom)
     return {
       width: baseSize * aspect * 0.15,
       height: baseSize * 0.8,
       depth: baseSize * aspect * 0.02 * stickThickness
     };
   }
  
  function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

   function getStackingOffset(
     index: number,
     stickDimensions: { width: number; height: number; depth: number },
     stickOverhang: number,
     rotationCenterOffsetX: number,
     rotationCenterOffsetY: number,
     stickGap: number
   ) {
     // Helix with configurable overhang angle and rotation center offset
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
  
   function renderScene() {
    if (!canvasContainer) return;
    
    if (renderer) {
      renderer.dispose();
      canvasContainer.innerHTML = '';
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
        stickThickness,
        stickRoundness,
        stickBevel,
        lighting,
        camera: cameraConfig
      } = config;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    
    const aspect = width / height;
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(
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
    
     const stickDimensions = getStickDimensions(width, height, stickThickness);
     
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
    
    renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;
    const previewWidth = Math.min(containerWidth, containerHeight * aspect);
    const previewHeight = previewWidth / aspect;
    
    renderer.setSize(previewWidth, previewHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    canvasContainer.appendChild(renderer.domElement);
    renderer.render(scene, camera);
  }
  
  async function handleExport() {
    if (!renderer || !scene || !camera) return;
    
    isExporting = true;
    
    try {
      renderer.setSize(config.width, config.height);
      renderer.render(scene, camera);
      
      const canvas = renderer.domElement;
      let result;
      
      switch (exportFormat) {
        case 'png':
          result = await exportToPNG(canvas, { format: 'png', quality: 0.95 });
          break;
        case 'jpg':
          result = await exportToJPG(canvas, { format: 'jpg', quality: 0.95 });
          break;
        case 'webp':
          result = await exportToWebP(canvas, { format: 'webp', quality: 0.95 });
          break;
        case 'svg':
          result = await exportToSVG(config);
          break;
      }
      
      const filename = `wallpaper-${Date.now()}.${exportFormat}`;
      downloadFile(result.data, filename, result.mimeType);
      
      renderScene();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }
  
  function applyResolutionPreset(preset: keyof typeof RESOLUTION_PRESETS) {
    const { width, height } = RESOLUTION_PRESETS[preset];
    config = { ...config, width, height };
  }
  
  function addColor() {
    config = { ...config, colors: [...config.colors, '#ffffff'] };
  }
  
  function removeColor(index: number) {
    if (config.colors.length > 1) {
      const newColors = config.colors.filter((_, i) => i !== index);
      config = { ...config, colors: newColors };
    }
  }
  
  function updateColor(index: number, color: string) {
    const newColors = [...config.colors];
    newColors[index] = color;
    config = { ...config, colors: newColors };
  }

  function cloneDefaultConfig(): WallpaperConfig {
     return {
       ...DEFAULT_CONFIG,
       colors: [...DEFAULT_CONFIG.colors],
       lighting: {
         ...DEFAULT_CONFIG.lighting,
         position: { ...DEFAULT_CONFIG.lighting.position }
       },
       camera: { ...DEFAULT_CONFIG.camera }
     };
  }

  function mergeWithLocks(next: WallpaperConfig): WallpaperConfig {
    const current = config;
    const merged: WallpaperConfig = {
      ...next,
      colors: [...next.colors],
      lighting: {
        ...next.lighting,
        position: { ...next.lighting.position }
      },
      camera: { ...next.camera }
    };

    // Resolution is not randomized; always preserve the current values.
    merged.width = current.width;
    merged.height = current.height;

     if (locks.colors) merged.colors = [...current.colors];
     if (locks.backgroundColor) merged.backgroundColor = current.backgroundColor;

     if (locks.texture) merged.texture = current.texture;

    if (locks.stickCount) merged.stickCount = current.stickCount;
    if (locks.stickOverhang) merged.stickOverhang = current.stickOverhang;
    if (locks.rotationCenterOffsetX) merged.rotationCenterOffsetX = current.rotationCenterOffsetX;
    if (locks.rotationCenterOffsetY) merged.rotationCenterOffsetY = current.rotationCenterOffsetY;
    if (locks.stickGap) merged.stickGap = current.stickGap;
    if (locks.stickThickness) merged.stickThickness = current.stickThickness;
    if (locks.stickRoundness) merged.stickRoundness = current.stickRoundness;
    if (locks.stickBevel) merged.stickBevel = current.stickBevel;

    if (locks.cameraDistance) merged.camera.distance = current.camera.distance;
    if (locks.cameraAzimuth) merged.camera.azimuth = current.camera.azimuth;
    if (locks.cameraElevation) merged.camera.elevation = current.camera.elevation;

    if (locks.lightingEnabled) merged.lighting.enabled = current.lighting.enabled;
    if (locks.lightingIntensity) merged.lighting.intensity = current.lighting.intensity;
    if (locks.lightingX) merged.lighting.position.x = current.lighting.position.x;
    if (locks.lightingY) merged.lighting.position.y = current.lighting.position.y;
    if (locks.lightingZ) merged.lighting.position.z = current.lighting.position.z;
    if (locks.lightingAmbient) merged.lighting.ambientIntensity = current.lighting.ambientIntensity;

    return merged;
  }

  function generateRandomGeneratedColors() {
    // Randomize everything, including a non-preset generated color theme.
    config = mergeWithLocks(generateRandomConfigNoPresets());
  }

  function parseConfigFromUrl(searchParams: URLSearchParams) {
    const next = cloneDefaultConfig();

    const num = (key: string, fallback: number) => {
      const raw = searchParams.get(key);
      if (raw === null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };

    const str = (key: string, fallback: string) => {
      const raw = searchParams.get(key);
      return raw === null ? fallback : raw;
    };

    const bool = (key: string, fallback: boolean) => {
      const raw = searchParams.get(key);
      if (raw === null) return fallback;
      return raw === '1' || raw === 'true' || raw === 'yes';
    };

    next.width = num('w', next.width);
    next.height = num('h', next.height);

    const colorsRaw = searchParams.get('colors');
    if (colorsRaw) {
      const parsed = colorsRaw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (parsed.length > 0) next.colors = parsed;
    }

     next.texture = str('tex', next.texture) as any;
     next.backgroundColor = str('bg', next.backgroundColor);

     next.stickCount = Math.round(num('count', next.stickCount));
     next.stickOverhang = num('overhang', next.stickOverhang);
     next.rotationCenterOffsetX = num('rotx', next.rotationCenterOffsetX);
     next.rotationCenterOffsetY = num('roty', next.rotationCenterOffsetY);
     next.stickGap = num('gap', next.stickGap);
     next.stickThickness = num('thick', next.stickThickness);
     next.stickRoundness = num('round', next.stickRoundness);
     next.stickBevel = num('bevel', next.stickBevel);

    next.lighting.enabled = bool('light', next.lighting.enabled);
    next.lighting.intensity = num('li', next.lighting.intensity);
    next.lighting.position.x = num('lx', next.lighting.position.x);
    next.lighting.position.y = num('ly', next.lighting.position.y);
    next.lighting.position.z = num('lz', next.lighting.position.z);
    next.lighting.ambientIntensity = num('amb', next.lighting.ambientIntensity);

    next.camera.distance = num('cd', next.camera.distance);
    next.camera.azimuth = num('ca', next.camera.azimuth);
    next.camera.elevation = num('ce', next.camera.elevation);

    const fmt = searchParams.get('fmt');
    if (fmt === 'png' || fmt === 'jpg' || fmt === 'webp' || fmt === 'svg') {
      exportFormat = fmt;
    }

    config = next;
  }

  function buildUrlSearchParams(): URLSearchParams {
    const p = new URLSearchParams();

     p.set('w', String(config.width));
     p.set('h', String(config.height));
      p.set('colors', config.colors.join(','));
      p.set('tex', config.texture);
      p.set('bg', config.backgroundColor);
      p.set('count', String(config.stickCount));
     p.set('overhang', String(config.stickOverhang));
     p.set('rotx', String(config.rotationCenterOffsetX));
     p.set('roty', String(config.rotationCenterOffsetY));
     p.set('gap', String(config.stickGap));
     p.set('thick', String(config.stickThickness));
     p.set('round', String(config.stickRoundness));
     p.set('bevel', String(config.stickBevel));

    p.set('light', config.lighting.enabled ? '1' : '0');
    p.set('li', String(config.lighting.intensity));
    p.set('lx', String(config.lighting.position.x));
    p.set('ly', String(config.lighting.position.y));
    p.set('lz', String(config.lighting.position.z));
    p.set('amb', String(config.lighting.ambientIntensity));

    p.set('cd', String(config.camera.distance));
    p.set('ca', String(config.camera.azimuth));
    p.set('ce', String(config.camera.elevation));

    p.set('fmt', exportFormat);

    return p;
  }

  function quoteCliArg(value: string): string {
    // Keep it simple and shell-friendly.
    if (/^[A-Za-z0-9_\-.,#/:]+$/.test(value)) return value;
    return JSON.stringify(value);
  }

  function buildCliCommandString(): string {
    const parts: string[] = [];
    parts.push('pnpm', 'cli', 'generate');
    parts.push('--width', String(config.width));
    parts.push('--height', String(config.height));
     parts.push('--colors', quoteCliArg(config.colors.join(',')));
     parts.push('--texture', config.texture);
     parts.push('--background', config.backgroundColor);
     parts.push('--count', String(config.stickCount));
     parts.push('--stick-overhang', String(config.stickOverhang));
     parts.push('--rotation-center-offset-x', String(config.rotationCenterOffsetX));
     parts.push('--rotation-center-offset-y', String(config.rotationCenterOffsetY));
     parts.push('--gap', String(config.stickGap));
    parts.push('--thickness', String(config.stickThickness));
    parts.push('--roundness', String(config.stickRoundness));
    parts.push('--bevel', String(config.stickBevel));
    parts.push('--camera-distance', String(config.camera.distance));
    parts.push('--camera-azimuth', String(config.camera.azimuth));
    parts.push('--camera-elevation', String(config.camera.elevation));

    if (!config.lighting.enabled) {
      parts.push('--no-lighting');
    } else {
      parts.push('--light-intensity', String(config.lighting.intensity));
      parts.push('--light-x', String(config.lighting.position.x));
      parts.push('--light-y', String(config.lighting.position.y));
      parts.push('--light-z', String(config.lighting.position.z));
      parts.push('--ambient', String(config.lighting.ambientIntensity));
    }

    parts.push('--format', exportFormat);
    return parts.join(' ');
  }

  async function copyCliCommand() {
    try {
      await navigator.clipboard.writeText(cliCommand);
    } catch {
      // Older browsers / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = cliCommand;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  $effect(() => {
    cliCommand = buildCliCommandString();
  });

  $effect(() => {
    if (!urlSyncEnabled) return;
    if (typeof window === 'undefined') return;

    const params = buildUrlSearchParams();
    const url = new URL(window.location.href);
    const next = params.toString();
    if (url.searchParams.toString() === next) return;

    // Debounce URL updates to avoid spamming history.
    const handle = window.setTimeout(() => {
      const u = new URL(window.location.href);
      u.search = next;
      history.replaceState({}, '', u);
    }, 120);

    return () => {
      window.clearTimeout(handle);
    };
  });
  
  $effect(() => {
    renderScene();
  });
  
  onMount(() => {
    const hasUrlParams = window.location.search.length > 0;
    
    try {
      if (hasUrlParams) {
        parseConfigFromUrl(new URLSearchParams(window.location.search));
      } else {
        // Use fully random configuration when no URL parameters are present
        config = generateRandomConfigNoPresets();
      }
    } catch {
      // Ignore malformed URLs and use random config
      config = generateRandomConfigNoPresets();
    }

    urlSyncEnabled = true;
    renderScene();
    
    const resizeObserver = new ResizeObserver(() => {
      renderScene();
    });
    
    if (canvasContainer) {
      resizeObserver.observe(canvasContainer);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<svelte:head>
  <title>ColorWhirl</title>
</svelte:head>

<div class="app">
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>ColorWhirl</h1>
    </div>
    
    <div class="sidebar-content">
      <!-- Export Section -->
      <section class="control-section">
        <h3>Export</h3>
        <div class="export-controls">
          <select bind:value={exportFormat}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
          <button onclick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </section>
      
        <!-- Random Config -->
        <section class="control-section">
          <h3>Randomize</h3>
          <div class="randomize-buttons">
            <button type="button" onclick={generateRandomGeneratedColors} title="Randomize all settings, generate a new non-preset color theme">
              Randomize
            </button>
          </div>
        </section>
       
       <!-- Resolution Controls -->
      <section class="control-section">
        <h3>Resolution</h3>
        <div class="preset-buttons">
          {#each Object.keys(RESOLUTION_PRESETS) as preset}
            <button onclick={() => applyResolutionPreset(preset as keyof typeof RESOLUTION_PRESETS)}>
              {preset}
            </button>
          {/each}
        </div>
        <div class="input-row">
          <label>
            <span>W</span>
            <input type="number" bind:value={config.width} min="100" max="8000" />
          </label>
          <label>
            <span>H</span>
            <input type="number" bind:value={config.height} min="100" max="8000" />
          </label>
        </div>
      </section>
      
      <!-- Colors Section -->
      <section class="control-section">
        <h3>
          <button type="button" class="setting-title" class:locked={locks.colors} onclick={() => toggleLock('colors')} title="Click to lock/unlock for randomize">
            Colors
          </button>
        </h3>
        <div class="colors-list">
          {#each config.colors as color, i}
            <div class="color-item">
              <input type="color" value={color} oninput={(e) => updateColor(i, e.currentTarget.value)} />
              <button class="remove-btn" onclick={() => removeColor(i)} disabled={config.colors.length <= 1}>×</button>
            </div>
          {/each}
          <button class="add-btn" onclick={addColor}>+ Add Color</button>
        </div>
      </section>
      
      <!-- Appearance -->
      <section class="control-section">
        <h3>Appearance</h3>
        <label class="control-row">
          <button type="button" class="setting-title" class:locked={locks.texture} onclick={() => toggleLock('texture')} title="Click to lock/unlock for randomize">Texture</button>
          <select bind:value={config.texture}>
            <option value="glossy">Glossy</option>
            <option value="matte">Matte</option>
            <option value="metallic">Metallic</option>
          </select>
        </label>
         <label class="control-row">
           <button type="button" class="setting-title" class:locked={locks.backgroundColor} onclick={() => toggleLock('backgroundColor')} title="Click to lock/unlock for randomize">Background</button>
           <input type="color" bind:value={config.backgroundColor} />
         </label>
       </section>
      
       <!-- Stick Settings -->
        <section class="control-section">
          <h3>Stick Settings</h3>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickCount} onclick={() => toggleLock('stickCount')} title="Click to lock/unlock for randomize">Count: {config.stickCount}</button>
            <input type="range" bind:value={config.stickCount} min="1" max="200" />
          </label>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickGap} onclick={() => toggleLock('stickGap')} title="Click to lock/unlock for randomize">Gap: {config.stickGap.toFixed(2)}</button>
            <input type="range" bind:value={config.stickGap} min="0" max="5.0" step="0.01" />
          </label>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickThickness} onclick={() => toggleLock('stickThickness')} title="Click to lock/unlock for randomize">Thickness: {config.stickThickness.toFixed(1)}</button>
            <input type="range" bind:value={config.stickThickness} min="0.1" max="3.0" step="0.1" />
          </label>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickRoundness} onclick={() => toggleLock('stickRoundness')} title="Click to lock/unlock for randomize">Roundness: {config.stickRoundness.toFixed(2)}</button>
            <input type="range" bind:value={config.stickRoundness} min="0" max="1" step="0.01" />
          </label>
          <label class="control-row slider">
           <button type="button" class="setting-title" class:locked={locks.stickBevel} onclick={() => toggleLock('stickBevel')} title="Click to lock/unlock for randomize">Bevel: {config.stickBevel.toFixed(2)}</button>
            <input type="range" bind:value={config.stickBevel} min="0" max="1" step="0.01" />
           </label>
          
          <!-- Helix Settings -->
          <div style="border-top: 1px solid #333; margin-top: 0.75rem; padding-top: 0.75rem;">
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.stickOverhang} onclick={() => toggleLock('stickOverhang')} title="Click to lock/unlock for randomize">Overhang: {config.stickOverhang.toFixed(0)}°</button>
               <input type="range" bind:value={config.stickOverhang} min="0" max="180" step="1" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.rotationCenterOffsetX} onclick={() => toggleLock('rotationCenterOffsetX')} title="Click to lock/unlock for randomize">Rotation Center X: {config.rotationCenterOffsetX.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetX} min="-100" max="100" step="5" />
             </label>
             <label class="control-row slider">
               <button type="button" class="setting-title" class:locked={locks.rotationCenterOffsetY} onclick={() => toggleLock('rotationCenterOffsetY')} title="Click to lock/unlock for randomize">Rotation Center Y: {config.rotationCenterOffsetY.toFixed(0)}%</button>
               <input type="range" bind:value={config.rotationCenterOffsetY} min="-100" max="100" step="5" />
             </label>
           </div>
        </section>
      
      <!-- Camera View -->
      <section class="control-section">
        <h3>Camera View</h3>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraAzimuth} onclick={() => toggleLock('cameraAzimuth')} title="Click to lock/unlock for randomize">Azimuth: {config.camera.azimuth}°</button>
          <input type="range" bind:value={config.camera.azimuth} min="0" max="360" step="5" />
        </label>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraElevation} onclick={() => toggleLock('cameraElevation')} title="Click to lock/unlock for randomize">Elevation: {config.camera.elevation}°</button>
          <input type="range" bind:value={config.camera.elevation} min="-80" max="80" step="5" />
        </label>
        <label class="control-row slider">
          <button type="button" class="setting-title" class:locked={locks.cameraDistance} onclick={() => toggleLock('cameraDistance')} title="Click to lock/unlock for randomize">Distance: {config.camera.distance.toFixed(1)}</button>
          <input type="range" bind:value={config.camera.distance} min="5" max="50" step="0.1" />
        </label>
      </section>
      
      <!-- Lighting -->
      <section class="control-section">
        <h3>Lighting</h3>
        <label class="control-row checkbox">
          <input type="checkbox" bind:checked={config.lighting.enabled} />
          <button
            type="button"
            class="setting-title"
            class:locked={locks.lightingEnabled}
            onclick={(e) => {
              e.preventDefault();
              toggleLock('lightingEnabled');
            }}
            title="Click to lock/unlock for randomize"
          >
            Enable Lighting
          </button>
        </label>
        {#if config.lighting.enabled}
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingIntensity} onclick={() => toggleLock('lightingIntensity')} title="Click to lock/unlock for randomize">Intensity: {config.lighting.intensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.intensity} min="0" max="3" step="0.1" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingX} onclick={() => toggleLock('lightingX')} title="Click to lock/unlock for randomize">Position X: {config.lighting.position.x}</button>
            <input type="range" bind:value={config.lighting.position.x} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingY} onclick={() => toggleLock('lightingY')} title="Click to lock/unlock for randomize">Position Y: {config.lighting.position.y}</button>
            <input type="range" bind:value={config.lighting.position.y} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingZ} onclick={() => toggleLock('lightingZ')} title="Click to lock/unlock for randomize">Position Z: {config.lighting.position.z}</button>
            <input type="range" bind:value={config.lighting.position.z} min="0" max="20" step="0.5" />
          </label>
          <label class="control-row slider">
            <button type="button" class="setting-title" class:locked={locks.lightingAmbient} onclick={() => toggleLock('lightingAmbient')} title="Click to lock/unlock for randomize">Ambient: {config.lighting.ambientIntensity.toFixed(1)}</button>
            <input type="range" bind:value={config.lighting.ambientIntensity} min="0" max="1" step="0.1" />
          </label>
        {/if}
      </section>

      <section class="control-section">
        <h3>CLI</h3>
        <div class="cli-controls">
          <textarea class="cli-text" readonly rows="4">{cliCommand}</textarea>
          <button class="cli-copy" onclick={copyCliCommand}>Copy</button>
        </div>
      </section>
    </div>
  </aside>
  
  <main class="preview-area">
    <div bind:this={canvasContainer} class="canvas-container"></div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    background: #0a0a0f;
    color: #fff;
    overflow: hidden;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
  }
  
  .sidebar {
    width: 300px;
    min-width: 300px;
    background: #111118;
    border-right: 1px solid #222;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #222;
    background: #0d0d12;
  }
  
  .sidebar-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
  }
  
  .control-section {
    background: #1a1a24;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #252530;
  }
  
  .control-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .export-controls {
    display: flex;
    gap: 0.5rem;
  }
  
  .export-controls select {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .export-controls button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .export-controls button:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .export-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .randomize-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: nowrap;
  }

  .randomize-buttons button {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0.5rem;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .cli-controls {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .cli-text {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #0f0f14;
    color: #d7d7e3;
    font-size: 0.75rem;
    line-height: 1.25;
    resize: vertical;
    min-height: 4.5rem;
  }

  .cli-copy {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .cli-copy:hover {
    background: #333;
  }
  
  .preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }
  
  .preset-buttons button {
    padding: 0.375rem 0.625rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #aaa;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }
  
  .preset-buttons button:hover {
    background: #333;
    color: #fff;
    border-color: #444;
  }
  
  .input-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-row label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .input-row label span {
    font-size: 0.75rem;
    color: #888;
    min-width: 1rem;
  }
  
  .input-row input[type="number"] {
    flex: 1;
    padding: 0.375rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    width: 0;
  }
  
  .colors-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .color-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .color-item input[type="color"] {
    flex: 1;
    height: 32px;
    border: 1px solid #333;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  
  .remove-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: none;
    background: #ff4444;
    color: #fff;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .remove-btn:hover:not(:disabled) {
    background: #ff6666;
  }
  
  .remove-btn:disabled {
    background: #444;
    cursor: not-allowed;
  }
  
  .add-btn {
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px dashed #444;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .add-btn:hover {
    border-color: #666;
    color: #fff;
    background: #252530;
  }
  
  .control-row {
    display: flex;
    align-items: center;
    margin-bottom: 0.625rem;
  }
  
  .control-row:last-child {
    margin-bottom: 0;
  }
  
  .control-row .setting-title {
    min-width: 100px;
    font-size: 0.875rem;
    color: #ccc;
    text-align: left;
  }

  .setting-title {
    cursor: pointer;
    user-select: none;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    line-height: inherit;
    color: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  .setting-title:not(.locked):hover {
    color: #fff;
  }

  .setting-title.locked {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: #3a1111;
    border: 1px solid #ff5a5a;
    color: #ffd5d5;
  }

  .setting-title.locked:hover {
    background: #4a1616;
  }
  
  .control-row select {
    flex: 1;
    padding: 0.375rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #252530;
    color: #fff;
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .control-row input[type="color"] {
    width: 50px;
    height: 28px;
    border: 1px solid #333;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  
  .control-row.slider {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }
  
  .control-row.slider .setting-title {
    min-width: auto;
    font-size: 0.8125rem;
    color: #aaa;
  }
  
  .control-row input[type="range"] {
    width: 100%;
    height: 4px;
    background: #333;
    border-radius: 2px;
    outline: none;
    -webkit-appearance: none;
  }
  
  .control-row input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .control-row input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
  
  .control-row.checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .control-row.checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #667eea;
    cursor: pointer;
  }
  
  .control-row.checkbox .setting-title {
    min-width: auto;
  }
  
  .preview-area {
    flex: 1;
    background: #0a0a0f;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    position: relative;
  }
  
  .canvas-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f0f15;
    border-radius: 12px;
    border: 1px solid #1a1a24;
  }
  
  .canvas-container :global(canvas) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }
  
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.3s;
    }
    
    .sidebar.open {
      transform: translateX(0);
    }
    
    .preview-area {
      padding: 1rem;
    }
  }
</style>
