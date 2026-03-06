<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { 
    DEFAULT_CONFIG, 
    type WallpaperConfig,
    COLOR_PALETTES,
    RESOLUTION_PRESETS,
    exportToPNG,
    exportToJPG,
    exportToWebP,
    exportToSVG,
    downloadFile
  } from '@wallpaper-maker/core';

  
  // Reactive state using Svelte 5 runes
  let config = $state<WallpaperConfig>({ ...DEFAULT_CONFIG });
  
  // Local config extensions (not in core type)
  let stickGap = $state(0.05);
  let stickThickness = $state(1.0);
  let helixAngle = $state(45);
  let canvasContainer: HTMLDivElement;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  
  // Export format selection
  let exportFormat = $state<'png' | 'jpg' | 'webp' | 'svg'>('png');
  let isExporting = $state(false);
  
  // Camera rotation for live preview (spherical coordinates)
  let cameraDistance = $state(20);
  let cameraAzimuth = $state(45);
  let cameraElevation = $state(30);
  
  // Derived values
  let aspectRatio = $derived(config.width / config.height);
  
  function createRoundedBox(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: radius * 0.3,
      bevelThickness: radius * 0.3,
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
    direction: string, 
    canvasWidth: number, 
    canvasHeight: number,
    stickThickness: number
  ) {
    const isVertical = direction === 'top-bottom';
    const isDiagonal = direction === 'top-right-to-bottom-left' || direction === 'bottom-left-to-top-right';
    const aspect = canvasWidth / canvasHeight;
    
    const baseSize = 8;
    const thicknessScale = stickThickness;
    
    if (isVertical) {
      return {
        width: baseSize * aspect * 0.15,
        height: baseSize * 0.8,
        depth: baseSize * aspect * 0.02 * thicknessScale,
        radius: baseSize * aspect * 0.01
      };
    } else if (isDiagonal) {
      const size = baseSize * 0.7;
      return {
        width: size * 0.12,
        height: size,
        depth: baseSize * aspect * 0.02 * thicknessScale,
        radius: baseSize * aspect * 0.01
      };
    } else {
      return {
        width: baseSize * aspect * 0.8,
        height: baseSize * 0.15,
        depth: baseSize * 0.02 * thicknessScale,
        radius: baseSize * 0.01
      };
    }
  }
  
  function getStackingOffset(
    stacking: string,
    index: number,
    totalSticks: number,
    stickDimensions: { width: number; height: number; depth: number; radius: number },
    helixAngle: number,
    stickGap: number
  ) {
    switch (stacking) {
      case 'perfect':
        return {
          x: 0,
          y: 0,
          z: index * (stickDimensions.depth + stickGap),
          rotationZ: 0
        };
      
      case 'helix':
        const helixTurns = helixAngle / 360;
        const rotationAngle = (index / (totalSticks - 1)) * Math.PI * 2 * helixTurns;
        return {
          x: 0,
          y: 0,
          z: index * (stickDimensions.depth + stickGap),
          rotationZ: rotationAngle
        };
      
      case 'unstacked':
        const angleStep = (Math.PI / 2) / (totalSticks - 1);
        const currentAngle = index * angleStep;
        const maxOffset = stickDimensions.width * 0.4;
        return {
          x: Math.cos(currentAngle) * maxOffset * (index % 2 === 0 ? 1 : -1),
          y: Math.sin(currentAngle) * maxOffset * (index % 2 === 0 ? 1 : -1),
          z: index * (stickDimensions.depth * 2 + stickGap),
          rotationZ: currentAngle * (index % 2 === 0 ? 1 : -1)
        };
      
      default:
        return { x: 0, y: 0, z: index * stickDimensions.depth, rotationZ: 0 };
    }
  }
  
  function getDirectionRotation(direction: string): number {
    switch (direction) {
      case 'top-bottom':
        return 0;
      case 'left-right':
        return Math.PI / 2;
      case 'top-right-to-bottom-left':
        return Math.PI / 4;
      case 'bottom-left-to-top-right':
        return -Math.PI / 4;
      default:
        return 0;
    }
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
      direction, 
      stacking, 
      stickCount, 
      lighting
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
    
    const azimuthRad = (cameraAzimuth * Math.PI) / 180;
    const elevationRad = (cameraElevation * Math.PI) / 180;
    camera.position.set(
      cameraDistance * Math.cos(elevationRad) * Math.sin(azimuthRad),
      cameraDistance * Math.sin(elevationRad),
      cameraDistance * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
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
    
    const stickDimensions = getStickDimensions(direction, width, height, stickThickness);
    const directionRotation = getDirectionRotation(direction);
    
    const group = new THREE.Group();
    
    for (let i = 0; i < stickCount; i++) {
      const color = colors[i % colors.length];
      const material = createMaterial(texture, color);
      const geometry = createRoundedBox(
        stickDimensions.width,
        stickDimensions.height,
        stickDimensions.depth,
        stickDimensions.radius
      );
      
      const mesh = new THREE.Mesh(geometry, material);
      
      const offset = getStackingOffset(stacking, i, stickCount, stickDimensions, helixAngle, stickGap);
      
      mesh.position.set(offset.x, offset.y, offset.z);
      mesh.rotation.z = directionRotation + offset.rotationZ;
      
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
  
  function applyColorPalette(palette: keyof typeof COLOR_PALETTES) {
    config = { ...config, colors: [...COLOR_PALETTES[palette]] };
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
  
  $effect(() => {
    renderScene();
  });
  
  onMount(() => {
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

<div class="app">
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>Wallpaper Maker</h1>
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
          <button on:click={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </section>
      
      <!-- Resolution Controls -->
      <section class="control-section">
        <h3>Resolution</h3>
        <div class="preset-buttons">
          {#each Object.keys(RESOLUTION_PRESETS) as preset}
            <button on:click={() => applyResolutionPreset(preset as keyof typeof RESOLUTION_PRESETS)}>
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
        <h3>Colors</h3>
        <div class="preset-buttons">
          {#each Object.keys(COLOR_PALETTES) as palette}
            <button on:click={() => applyColorPalette(palette as keyof typeof COLOR_PALETTES)}>
              {palette}
            </button>
          {/each}
        </div>
        <div class="colors-list">
          {#each config.colors as color, i}
            <div class="color-item">
              <input type="color" value={color} on:input={(e) => updateColor(i, e.currentTarget.value)} />
              <button class="remove-btn" on:click={() => removeColor(i)} disabled={config.colors.length <= 1}>×</button>
            </div>
          {/each}
          <button class="add-btn" on:click={addColor}>+ Add Color</button>
        </div>
      </section>
      
      <!-- Appearance -->
      <section class="control-section">
        <h3>Appearance</h3>
        <label class="control-row">
          <span>Texture</span>
          <select bind:value={config.texture}>
            <option value="glossy">Glossy</option>
            <option value="matte">Matte</option>
            <option value="metallic">Metallic</option>
          </select>
        </label>
        <label class="control-row">
          <span>Background</span>
          <input type="color" bind:value={config.backgroundColor} />
        </label>
        <label class="control-row">
          <span>Direction</span>
          <select bind:value={config.direction}>
            <option value="top-bottom">Top-Bottom</option>
            <option value="left-right">Left-Right</option>
            <option value="top-right-to-bottom-left">Diagonal ↘</option>
            <option value="bottom-left-to-top-right">Diagonal ↗</option>
          </select>
        </label>
        <label class="control-row">
          <span>Stacking</span>
          <select bind:value={config.stacking}>
            <option value="perfect">Perfect Stack</option>
            <option value="helix">Helix</option>
            <option value="unstacked">Unstacked</option>
          </select>
        </label>
      </section>
      
      <!-- Stick Settings -->
      <section class="control-section">
        <h3>Stick Settings</h3>
        <label class="control-row slider">
          <span>Count: {config.stickCount}</span>
          <input type="range" bind:value={config.stickCount} min="3" max="200" />
        </label>
        <label class="control-row slider">
          <span>Gap: {stickGap.toFixed(2)}</span>
          <input type="range" bind:value={stickGap} min="0" max="5.0" step="0.01" />
        </label>
        <label class="control-row slider">
          <span>Thickness: {stickThickness.toFixed(1)}</span>
          <input type="range" bind:value={stickThickness} min="0.1" max="3.0" step="0.1" />
        </label>
      </section>
      
      <!-- Helix Settings -->
      {#if config.stacking === 'helix'}
        <section class="control-section">
          <h3>Helix Settings</h3>
          <label class="control-row slider">
            <span>Angle: {helixAngle}°</span>
            <input type="range" bind:value={helixAngle} min="0" max="720" step="5" />
          </label>
        </section>
      {/if}
      
      <!-- Camera View -->
      <section class="control-section">
        <h3>Camera View</h3>
        <label class="control-row slider">
          <span>Azimuth: {cameraAzimuth}°</span>
          <input type="range" bind:value={cameraAzimuth} min="0" max="360" step="5" />
        </label>
        <label class="control-row slider">
          <span>Elevation: {cameraElevation}°</span>
          <input type="range" bind:value={cameraElevation} min="-80" max="80" step="5" />
        </label>
        <label class="control-row slider">
          <span>Distance: {cameraDistance}</span>
          <input type="range" bind:value={cameraDistance} min="5" max="50" step="1" />
        </label>
      </section>
      
      <!-- Lighting -->
      <section class="control-section">
        <h3>Lighting</h3>
        <label class="control-row checkbox">
          <input type="checkbox" bind:checked={config.lighting.enabled} />
          <span>Enable Lighting</span>
        </label>
        {#if config.lighting.enabled}
          <label class="control-row slider">
            <span>Intensity: {config.lighting.intensity.toFixed(1)}</span>
            <input type="range" bind:value={config.lighting.intensity} min="0" max="3" step="0.1" />
          </label>
          <label class="control-row slider">
            <span>Position X: {config.lighting.position.x}</span>
            <input type="range" bind:value={config.lighting.position.x} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <span>Position Y: {config.lighting.position.y}</span>
            <input type="range" bind:value={config.lighting.position.y} min="-10" max="10" step="0.5" />
          </label>
          <label class="control-row slider">
            <span>Position Z: {config.lighting.position.z}</span>
            <input type="range" bind:value={config.lighting.position.z} min="0" max="20" step="0.5" />
          </label>
          <label class="control-row slider">
            <span>Ambient: {config.lighting.ambientIntensity.toFixed(1)}</span>
            <input type="range" bind:value={config.lighting.ambientIntensity} min="0" max="1" step="0.1" />
          </label>
        {/if}
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
  
  .control-row span {
    min-width: 100px;
    font-size: 0.875rem;
    color: #ccc;
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
  
  .control-row.slider span {
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
  
  .control-row.checkbox span {
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
