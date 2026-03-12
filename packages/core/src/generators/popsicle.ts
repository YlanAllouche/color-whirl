import * as THREE from 'three';
import type { WallpaperConfig, TextureType } from '../types.js';

interface StickDimensions {
  width: number;
  height: number;
  depth: number;
}

function getStickDimensions(canvasWidth: number, canvasHeight: number, stickThickness: number): StickDimensions {
  const aspect = canvasWidth / canvasHeight;
  
  // Normalize to frustum size (10 units) with aspect ratio correction
  const baseSize = 8; // Use 80% of the 10-unit frustum
  
  // Default to vertical orientation (top-bottom)
  return {
    width: baseSize * aspect * 0.15,
    height: baseSize * 0.8,
    depth: baseSize * aspect * 0.02 * stickThickness
  };
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
  index: number,
  stickDimensions: StickDimensions,
  stickOverhang: number,
  rotationCenterOffsetX: number,
  rotationCenterOffsetY: number,
  stickGap: number
): { x: number; y: number; z: number; rotationZ: number } {
  // Helix with configurable overhang angle and rotation center offset
  // stickOverhang: degrees each stick rotates from the previous
  const rotationAngle = index * degToRad(stickOverhang);
  
  // Rotation center offset: -100% = far left/bottom, 0% = center, +100% = far right/top
  // We need to apply the rotation around a point other than (0,0)
  const offsetXPercent = rotationCenterOffsetX / 100;
  const offsetYPercent = rotationCenterOffsetY / 100;
  
  // Calculate the rotation pivot point relative to stick center
  // The stick extends from -height/2 to +height/2 in its local Y axis
  const pivotX = offsetXPercent * (stickDimensions.width / 2);
  const pivotY = offsetYPercent * (stickDimensions.height / 2);
  
  // Apply rotation around the pivot point
  // First translate to pivot, rotate, then translate back
  const cos = Math.cos(rotationAngle);
  const sin = Math.sin(rotationAngle);
  
  // Position offset from rotation around pivot
  const offsetX = pivotX * (1 - cos) + pivotY * sin;
  const offsetY = pivotY * (1 - cos) - pivotX * sin;
  
  return {
    x: offsetX,
    y: offsetY,
    z: index * (stickDimensions.depth + stickGap),
    rotationZ: rotationAngle
  };
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
