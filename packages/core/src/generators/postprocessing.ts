import * as THREE from 'three';
import type { BloomConfig } from '../types.js';

// These imports rely on either the bundler (web) or importmap mappings (CLI renderer).
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function renderWithOptionalBloom(options: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  width: number;
  height: number;
  bloom: BloomConfig;
}): void {
  const { renderer, scene, camera, width, height, bloom } = options;
  if (!bloom?.enabled) {
    renderer.render(scene, camera);
    return;
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(width, height),
      Number(bloom.strength) || 0,
      Number(bloom.radius) || 0,
      Number(bloom.threshold) || 0
    )
  );
  composer.setSize(width, height);
  composer.render();
  composer.dispose();
}
