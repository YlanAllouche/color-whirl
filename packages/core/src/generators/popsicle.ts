import * as THREE from 'three';
import type { WallpaperConfig, Direction, StackingMode, TextureType } from '../types.js';

interface StickDimensions {
  width: number;
  height: number;
  depth: number;
}

function getStickDimensions(direction: Direction, canvasWidth: number, canvasHeight: number, stickThickness: number): StickDimensions {
  const isVertical = direction === 'top-bottom';
  const isDiagonal = direction === 'top-right-to-bottom-left' || direction === 'bottom-left-to-top-right';
  const aspect = canvasWidth / canvasHeight;
  
  // Normalize to frustum size (10 units) with aspect ratio correction
  const baseSize = 8; // Use 80% of the 10-unit frustum
  
  if (isVertical) {
    return {
      width: baseSize * aspect * 0.15,
      height: baseSize * 0.8,
      depth: baseSize * aspect * 0.02 * stickThickness
    };
  } else if (isDiagonal) {
    const size = baseSize * 0.7;
    return {
      width: size * 0.12,
      height: size,
      depth: baseSize * aspect * 0.02 * stickThickness
    };
  } else {
    return {
      width: baseSize * aspect * 0.8,
      height: baseSize * 0.15,
      depth: baseSize * 0.02 * stickThickness,
      // radius handled by stickRoundness
    };
  }
}

function createMaterial(texture: TextureType, color: string): THREE.MeshPhysicalMaterial {
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

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cameraZoomFromDistance(distance: number): number {
  // Orthographic cameras don't "zoom" with distance; map distance to zoom instead.
  const referenceDistance = 17.3;
  const safeDistance = Math.max(0.1, distance);
  return referenceDistance / safeDistance;
}

function getStackingOffset(
  stacking: StackingMode,
  index: number,
  totalSticks: number,
  stickDimensions: StickDimensions,
  helixAngle: number,
  stickGap: number
): { x: number; y: number; z: number; rotationZ: number } {
  
  switch (stacking) {
    case 'perfect':
      return {
        x: 0,
        y: 0,
        z: index * (stickDimensions.depth + stickGap),
        rotationZ: 0
      };
    
    case 'helix':
      // True helix: all sticks centered at (0,0), each rotated around Z axis progressively
      // helixAngle is in degrees, convert to radians
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

function getDirectionRotation(direction: Direction): number {
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

export function createPopsicleScene(config: WallpaperConfig): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
} {
  const {
    width,
    height,
    colors,
    texture,
    backgroundColor,
    direction,
    stacking,
    stickCount,
    helixAngle,
    stickGap,
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
  const azimuthRad = degToRad(cameraConfig.azimuth);
  const elevationRad = degToRad(cameraConfig.elevation);
  camera.position.set(
    cameraConfig.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
    cameraConfig.distance * Math.sin(elevationRad),
    cameraConfig.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
  );
  camera.zoom = cameraZoomFromDistance(cameraConfig.distance);
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
      stickRoundness,
      stickBevel
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
  
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  return { scene, camera, renderer };
}

export function renderPopsicleToCanvas(
  config: WallpaperConfig,
  canvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const { scene, camera, renderer } = createPopsicleScene(config);
  
  if (canvas) {
    renderer.domElement = canvas;
  }
  
  renderer.render(scene, camera);
  
  return renderer.domElement;
}
