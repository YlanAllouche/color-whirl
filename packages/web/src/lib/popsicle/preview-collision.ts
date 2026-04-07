import * as THREE from 'three';
import { chainOnBeforeCompile, makeSolidRedTexture01, type PopsicleConfig } from './preview-utils.js';

type CollisionMaskingParams = {
  config: PopsicleConfig;
  previewWidth: number;
  previewHeight: number;
  meshesByPalette: THREE.Mesh[][];
  paletteMaterials: Array<Array<THREE.Material | THREE.Material[]>>;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  stickMeshes: THREE.Mesh[];
  enabled: boolean;
};

export class PopsicleCollisionMasking {
  private collisionDepthMat: THREE.MeshDepthMaterial | null = null;
  private collisionDummy: THREE.DataTexture | null = null;
  private collisionRTs: THREE.WebGLRenderTarget[] = [];
  private collisionRTW = 0;
  private collisionRTH = 0;

  dispose(): void {
    for (const rt of this.collisionRTs) rt.dispose();
    this.collisionRTs = [];
    this.collisionDepthMat?.dispose();
    this.collisionDepthMat = null;
    this.collisionDummy?.dispose();
    this.collisionDummy = null;
    this.collisionRTW = 0;
    this.collisionRTH = 0;
  }

  applyRasterMasking(params: CollisionMaskingParams): void {
    const {
      config,
      previewWidth,
      previewHeight,
      meshesByPalette,
      paletteMaterials,
      renderer,
      scene,
      camera,
      stickMeshes,
      enabled
    } = params;

    const nColors = Math.max(1, config.colors.length);
    if (meshesByPalette.length !== nColors) return;

    const maskingEnabled = enabled && config.collisions.mode === 'carve' && nColors <= 8;
    if (!maskingEnabled) {
      // Leave any injected shader code in-place; it no-ops when otherDepthCount=0.
      for (const list of paletteMaterials) {
        for (const m of list ?? []) {
          if (!m) continue;
          const mats = Array.isArray(m) ? m : [m];
          for (const mm of mats) {
            const sh = (mm.userData as any).__wmCollisionShader;
            if (sh?.uniforms?.wmOtherDepthCount) sh.uniforms.wmOtherDepthCount.value = 0;
          }
        }
      }
      return;
    }

    const marginPx = Math.max(0, Number(config.collisions.carve.marginPx) || 0);
    const featherPx = config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0;
    const softEdge = config.collisions.carve.edge === 'soft' && featherPx > 0;

    const screenW = Math.max(1, Math.round(previewWidth));
    const screenH = Math.max(1, Math.round(previewHeight));
    const maskScale = 0.6;
    const rtW = Math.max(1, Math.round(screenW * maskScale));
    const rtH = Math.max(1, Math.round(screenH * maskScale));

    const makeRT = () => {
      const rt = new THREE.WebGLRenderTarget(rtW, rtH, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false
      });
      rt.depthTexture = new THREE.DepthTexture(rtW, rtH);
      rt.depthTexture.format = THREE.DepthFormat;
      rt.depthTexture.type = THREE.UnsignedShortType;
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
      return rt;
    };

    if (!this.collisionDepthMat) this.collisionDepthMat = new THREE.MeshDepthMaterial();
    if (!this.collisionDummy) this.collisionDummy = makeSolidRedTexture01();

    if (this.collisionRTs.length !== nColors || this.collisionRTW !== rtW || this.collisionRTH !== rtH) {
      for (const rt of this.collisionRTs) rt.dispose();
      this.collisionRTs = Array.from({ length: nColors }, () => makeRT());
      this.collisionRTW = rtW;
      this.collisionRTH = rtH;
    }

    // Popsicle doesn't have palette weights; use palette index as priority (higher index carves lower index).
    const weights = Array.from({ length: nColors }, (_, i) => i);

    const otherIndicesByPalette: number[][] = [];
    for (let pi = 0; pi < nColors; pi++) {
      const others: number[] = [];
      for (let j = 0; j < nColors; j++) {
        if (j === pi) continue;
        if (config.collisions.carve.direction === 'twoWay') {
          others.push(j);
          continue;
        }
        if ((weights[j] ?? 0) > (weights[pi] ?? 0)) others.push(j);
      }
      others.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
      otherIndicesByPalette[pi] = others.slice(0, 7);
    }

    const dummy = this.collisionDummy;
    const depthRTs = this.collisionRTs;

    const patchMaterial = (mat: THREE.Material, pi: number) => {
      if (softEdge) {
        mat.transparent = true;
        mat.depthWrite = false;
      }

      const idxs = otherIndicesByPalette[pi] ?? [];
      const otherDepth = idxs.map((j) => depthRTs[j].depthTexture);

      const finishEnabled = config.collisions.mode === 'carve' && config.collisions.carve.finish === 'wallsCap' ? 1 : 0;
      const finishDepthPx =
        (Math.max(0, Number(config.collisions.carve.marginPx) || 0) +
          (config.collisions.carve.edge === 'soft' ? Math.max(0, Number(config.collisions.carve.featherPx) || 0) : 0)) *
        Math.max(0, Number(config.collisions.carve.finishAutoDepthMult) || 0);

      chainOnBeforeCompile(
        mat,
        (shader) => {
          shader.uniforms.wmCollideRes = { value: new THREE.Vector2(screenW, screenH) };
          shader.uniforms.wmCollideMarginPx = { value: marginPx };
          shader.uniforms.wmCollideFeatherPx = { value: featherPx };
          shader.uniforms.wmCollideSoftEdge = { value: softEdge ? 1 : 0 };
          shader.uniforms.wmFinishEnabled = { value: finishEnabled };
          shader.uniforms.wmFinishDepthPx = { value: finishDepthPx };
          shader.uniforms.wmOtherDepthCount = { value: otherDepth.length };
          shader.uniforms.wmOtherDepth0 = { value: (otherDepth[0] as any) ?? dummy };
          shader.uniforms.wmOtherDepth1 = { value: (otherDepth[1] as any) ?? dummy };
          shader.uniforms.wmOtherDepth2 = { value: (otherDepth[2] as any) ?? dummy };
          shader.uniforms.wmOtherDepth3 = { value: (otherDepth[3] as any) ?? dummy };
          shader.uniforms.wmOtherDepth4 = { value: (otherDepth[4] as any) ?? dummy };
          shader.uniforms.wmOtherDepth5 = { value: (otherDepth[5] as any) ?? dummy };
          shader.uniforms.wmOtherDepth6 = { value: (otherDepth[6] as any) ?? dummy };

          (mat.userData as any).__wmCollisionShader = shader;

          const headerGlobal = `
 uniform vec2 wmCollideRes;
 uniform float wmCollideMarginPx;
 uniform float wmCollideFeatherPx;
 uniform float wmCollideSoftEdge;
 uniform float wmFinishEnabled;
 uniform float wmFinishDepthPx;
 uniform int wmOtherDepthCount;
 uniform sampler2D wmOtherDepth0;
 uniform sampler2D wmOtherDepth1;
 uniform sampler2D wmOtherDepth2;
 uniform sampler2D wmOtherDepth3;
 uniform sampler2D wmOtherDepth4;
 uniform sampler2D wmOtherDepth5;
 uniform sampler2D wmOtherDepth6;

 float wmDepth01(sampler2D d, vec2 uv) {
   return texture2D(d, clamp(uv, 0.0, 1.0)).x;
 }

 float wmInFront01(sampler2D d, vec2 uv, float curZ) {
   float z = wmDepth01(d, uv);
   if (z >= 0.999999) return 0.0;
   return z < (curZ - 0.00001) ? 1.0 : 0.0;
 }

 float wmInFrontAtRadius(sampler2D d, vec2 uv, float radiusPx, float curZ) {
   float p = wmInFront01(d, uv, curZ);
   if (radiusPx <= 0.0) return p;
   vec2 px = 1.0 / wmCollideRes;
   vec2 o = vec2(radiusPx, 0.0) * px;
   p = max(p, wmInFront01(d, uv + vec2( o.x, 0.0), curZ));
   p = max(p, wmInFront01(d, uv + vec2(-o.x, 0.0), curZ));
   p = max(p, wmInFront01(d, uv + vec2(0.0,  o.x), curZ));
   p = max(p, wmInFront01(d, uv + vec2(0.0, -o.x), curZ));
   p = max(p, wmInFront01(d, uv + vec2( o.x,  o.x), curZ));
   p = max(p, wmInFront01(d, uv + vec2(-o.x,  o.x), curZ));
   p = max(p, wmInFront01(d, uv + vec2( o.x, -o.x), curZ));
   p = max(p, wmInFront01(d, uv + vec2(-o.x, -o.x), curZ));
   return p;
 }

 float wmAnyInFront(vec2 uv, float radiusPx, float curZ) {
   float p = 0.0;
   if (wmOtherDepthCount > 0) p = max(p, wmInFrontAtRadius(wmOtherDepth0, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 1) p = max(p, wmInFrontAtRadius(wmOtherDepth1, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 2) p = max(p, wmInFrontAtRadius(wmOtherDepth2, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 3) p = max(p, wmInFrontAtRadius(wmOtherDepth3, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 4) p = max(p, wmInFrontAtRadius(wmOtherDepth4, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 5) p = max(p, wmInFrontAtRadius(wmOtherDepth5, uv, radiusPx, curZ));
   if (wmOtherDepthCount > 6) p = max(p, wmInFrontAtRadius(wmOtherDepth6, uv, radiusPx, curZ));
   return p;
 }

 void wmApplyCollisionMask(inout vec4 col) {
   if (wmOtherDepthCount <= 0) return;
   vec2 uv = gl_FragCoord.xy / wmCollideRes;
   float curZ = gl_FragCoord.z;
   float margin = max(0.0, wmCollideMarginPx);
   float feather = max(0.0, wmCollideFeatherPx);

   float hit0 = wmAnyInFront(uv, 0.0, curZ);
   if (hit0 > 0.5) {
     discard;
   }

   float hitM = wmAnyInFront(uv, margin, curZ);
   if (hitM <= 0.5) {
     return;
   }

   float carveAmt = 1.0;
   if (wmCollideSoftEdge > 0.5 && feather > 0.0) {
     float cut = 0.0;
     if (wmAnyInFront(uv, margin + feather * 0.25, curZ) > 0.5) cut = max(cut, 0.25);
     if (wmAnyInFront(uv, margin + feather * 0.50, curZ) > 0.5) cut = max(cut, 0.50);
     if (wmAnyInFront(uv, margin + feather * 0.75, curZ) > 0.5) cut = max(cut, 0.75);
     if (wmAnyInFront(uv, margin + feather, curZ) > 0.5) cut = max(cut, 1.00);
     carveAmt = 1.0 - cut;
   }

   if (wmFinishEnabled > 0.5) {
     float wallThickness = max(2.0, min(30.0, wmFinishDepthPx * 0.35));
     float wall = wmAnyInFront(uv, max(0.0, margin - wallThickness), curZ);
     vec3 capCol = col.rgb * 0.14;
     vec3 wallCol = col.rgb * 0.30;
     vec3 inside = mix(capCol, wallCol, wall);
     col.rgb = mix(col.rgb, inside, carveAmt);
     return;
   }

   if (wmCollideSoftEdge > 0.5 && feather > 0.0) {
     col.a *= max(0.0, 1.0 - carveAmt);
     if (col.a <= 0.001) discard;
   } else {
     discard;
   }
 }
`;

          let fs = shader.fragmentShader;
          if (fs.includes('#include <common>')) {
            fs = fs.replace('#include <common>', `#include <common>\n${headerGlobal}\n`);
          } else {
            fs = fs.replace('void main() {', `${headerGlobal}\nvoid main() {`);
          }
          fs = fs.replace('#include <dithering_fragment>', `wmApplyCollisionMask(gl_FragColor);\n#include <dithering_fragment>`);
          shader.fragmentShader = fs;
        },
        `collide-v1:${config.collisions.carve.direction}:${config.collisions.carve.edge}:${marginPx.toFixed(2)}:${featherPx.toFixed(2)}:${idxs.length}`
      );
    };

    for (let pi = 0; pi < nColors; pi++) {
      const list = paletteMaterials[pi] ?? [];
      for (const entry of list) {
        if (!entry) continue;
        const mats = Array.isArray(entry) ? entry : [entry];
        for (const mm of mats) patchMaterial(mm, pi);
      }
    }

    // Render per-palette depth maps.
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = (scene as any).overrideMaterial;
    const clearCol = renderer.getClearColor(new THREE.Color());
    const clearA = renderer.getClearAlpha();
    const vis = stickMeshes.map((m) => m.visible);

    renderer.setClearColor(0x000000, 0);
    (scene as any).overrideMaterial = this.collisionDepthMat;

    for (let i = 0; i < stickMeshes.length; i++) {
      if (stickMeshes[i].visible) stickMeshes[i].visible = false;
    }

    for (let pi = 0; pi < nColors; pi++) {
      for (const mesh of meshesByPalette[pi]) mesh.visible = true;
      renderer.setRenderTarget(depthRTs[pi]);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      for (const mesh of meshesByPalette[pi]) mesh.visible = false;
    }

    (scene as any).overrideMaterial = prevOverride;
    for (let i = 0; i < stickMeshes.length; i++) stickMeshes[i].visible = vis[i];
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(clearCol, clearA);
  }
}
