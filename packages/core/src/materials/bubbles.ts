import * as THREE from 'three';
import type { BubblesConfig, WallpaperConfig } from '../types.js';
import { clamp, chainOnBeforeCompile } from './utils.js';

export function applyBubbles(
  material: THREE.Material,
  config: WallpaperConfig,
  objectScale?: THREE.Vector3 | number,
  bubbles?: BubblesConfig
): void {
  const g = (bubbles ?? ((config as any)?.bubbles as BubblesConfig | undefined)) as BubblesConfig | undefined;
  if (!g?.enabled) return;

  const mode = (g as any).mode === 'cap' ? 1 : 0;

  const enabled = !!g.enabled;
  const frequency = clamp(Number(g.frequency) || 0, 0, 20);
  const variance = clamp(Number(g.frequencyVariance) || 0, 0, 1);
  const count = Math.max(0, Math.min(16, Math.round(Number(g.count) || 0)));
  const radiusMin = Math.max(0, Number(g.radiusMin) || 0);
  const radiusMax = Math.max(radiusMin, Number(g.radiusMax) || radiusMin);
  const softness = Math.max(0, Number(g.softness) || 0);
  const wallThickness = Math.max(0, Number(g.wallThickness) || 0);
  const seedOffset = Number.isFinite(Number(g.seedOffset)) ? Number(g.seedOffset) : 0;

  if (!enabled || frequency <= 0 || count <= 0 || radiusMax <= 0) return;

  const anyMat: any = material as any;
  // Through mode relies on alpha/discard; enable transparency when needed.
  if (mode === 0 && softness > 0) {
    anyMat.transparent = true;
    anyMat.depthWrite = false;
  }

  const scaleVec =
    typeof objectScale === 'number'
      ? new THREE.Vector3(objectScale, objectScale, objectScale)
      : objectScale instanceof THREE.Vector3
        ? objectScale
        : new THREE.Vector3(1, 1, 1);

  // Keep the seed stable but small-ish for float precision.
  const seedBase = ((Number(config.seed) >>> 0) % 100000) * 0.001 + seedOffset;

  const key =
    `bubbles-v2:${enabled ? 1 : 0}:` +
    `${mode}:` +
    `${frequency.toFixed(4)}:${variance.toFixed(4)}:${count}:` +
    `${radiusMin.toFixed(4)}:${radiusMax.toFixed(4)}:` +
    `${softness.toFixed(4)}:${wallThickness.toFixed(4)}:` +
    `${seedBase.toFixed(4)}:` +
    `${scaleVec.x.toFixed(4)},${scaleVec.y.toFixed(4)},${scaleVec.z.toFixed(4)}`;

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wmBubblesEnabled = { value: enabled ? 1 : 0 };
      shader.uniforms.wmBubblesMode = { value: mode };
      shader.uniforms.wmBubblesFrequency = { value: frequency };
      shader.uniforms.wmBubblesFrequencyVariance = { value: variance };
      shader.uniforms.wmBubblesCount = { value: count };
      shader.uniforms.wmBubblesRadiusMin = { value: radiusMin };
      shader.uniforms.wmBubblesRadiusMax = { value: radiusMax };
      shader.uniforms.wmBubblesSoftness = { value: softness };
      shader.uniforms.wmBubblesWallThickness = { value: wallThickness };
      shader.uniforms.wmBubblesSeed = { value: seedBase };
      shader.uniforms.wmBubblesScale = { value: scaleVec };

      const vtxHeader = `\nvarying vec3 wmBubblesWorldPos;\n`;
      if (shader.vertexShader.includes('#include <common>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${vtxHeader}`);
      } else if (!shader.vertexShader.includes('varying vec3 wmBubblesWorldPos')) {
        shader.vertexShader = vtxHeader + shader.vertexShader;
      }

      if (shader.vertexShader.includes('#include <worldpos_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>\nwmBubblesWorldPos = worldPosition.xyz;`
        );
      } else if (shader.vertexShader.includes('#include <begin_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n#ifdef USE_INSTANCING\nvec4 wmWP = modelMatrix * instanceMatrix * vec4(position, 1.0);\n#else\nvec4 wmWP = modelMatrix * vec4(position, 1.0);\n#endif\nwmBubblesWorldPos = wmWP.xyz;`
        );
      }

      const fragHeader = `
 uniform int wmBubblesEnabled;
 uniform int wmBubblesMode;
 uniform float wmBubblesFrequency;
 uniform float wmBubblesFrequencyVariance;
 uniform int wmBubblesCount;
 uniform float wmBubblesRadiusMin;
 uniform float wmBubblesRadiusMax;
 uniform float wmBubblesSoftness;
 uniform float wmBubblesWallThickness;
 uniform float wmBubblesSeed;
 uniform vec3 wmBubblesScale;
 varying vec3 wmBubblesWorldPos;

float wmHash1(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

vec3 wmHash3(vec3 p) {
  return vec3(
    wmHash1(p + vec3(0.0, 0.0, 0.0)),
    wmHash1(p + vec3(17.0, 0.0, 0.0)),
    wmHash1(p + vec3(0.0, 37.0, 0.0))
  );
}

 float wmBubblesEffectiveFrequency() {
   float baseFreq = max(1e-6, wmBubblesFrequency);
   float variance = clamp(wmBubblesFrequencyVariance, 0.0, 1.0);
   float bias = wmHash1(vec3(wmBubblesSeed, wmBubblesSeed + 3.1, wmBubblesSeed + 7.2));
   return baseFreq * (1.0 + (bias - 0.5) * 2.0 * variance);
 }

 float wmCavitySdf(vec3 cell, vec3 p, float invFreq) {
   vec3 seed = vec3(wmBubblesSeed);
   vec3 jitter = wmHash3(cell + seed);
   vec3 center = (cell + jitter) * invFreq;
   float rr = mix(wmBubblesRadiusMin, wmBubblesRadiusMax, wmHash1(cell + seed + vec3(13.37, 9.91, 2.17)));
   return length(p - center) - rr;
 }

 float wmBubblesMinSdf(vec3 p) {
   float freq = wmBubblesEffectiveFrequency();
   float invF = 1.0 / freq;
  vec3 gp = p * freq;
  vec3 i = floor(gp);
  vec3 fracP = fract(gp);
  vec3 o = step(vec3(0.5), fracP);
  vec3 base = i + o;

  float dMin = 1e9;

   if (wmBubblesCount > 0) dMin = min(dMin, wmCavitySdf(base + vec3( 0.0,  0.0,  0.0), p, invF));
   if (wmBubblesCount > 1) dMin = min(dMin, wmCavitySdf(base + vec3(-1.0,  0.0,  0.0), p, invF));
   if (wmBubblesCount > 2) dMin = min(dMin, wmCavitySdf(base + vec3( 0.0, -1.0,  0.0), p, invF));
   if (wmBubblesCount > 3) dMin = min(dMin, wmCavitySdf(base + vec3(-1.0, -1.0,  0.0), p, invF));
   if (wmBubblesCount > 4) dMin = min(dMin, wmCavitySdf(base + vec3( 0.0,  0.0, -1.0), p, invF));
   if (wmBubblesCount > 5) dMin = min(dMin, wmCavitySdf(base + vec3(-1.0,  0.0, -1.0), p, invF));
   if (wmBubblesCount > 6) dMin = min(dMin, wmCavitySdf(base + vec3( 0.0, -1.0, -1.0), p, invF));
   if (wmBubblesCount > 7) dMin = min(dMin, wmCavitySdf(base + vec3(-1.0, -1.0, -1.0), p, invF));

  return dMin;
}

 void wmApplyBubbles(inout vec4 col) {
   if (wmBubblesEnabled == 0) return;

   vec3 p = wmBubblesWorldPos / max(wmBubblesScale, vec3(1e-6));

   float sdf = wmBubblesMinSdf(p);
  if (sdf >= 0.0) return;

  float depth = -sdf;
   float softness = max(0.0, wmBubblesSoftness);
   float thickness = max(0.0, wmBubblesWallThickness);

  float fade;
  if (softness <= 1e-6) {
    fade = depth >= thickness ? 1.0 : 0.0;
  } else {
    fade = smoothstep(thickness, thickness + softness, depth);
  }

  if (wmBubblesMode == 0) {
    // through
    if (fade >= 0.999) {
      discard;
    }

    col.a *= max(0.0, 1.0 - fade);
    if (col.a <= 0.001) discard;

    if (thickness > 1e-6 && depth <= thickness) {
      float wallNorm = clamp(1.0 - depth / thickness, 0.0, 1.0);
      vec3 wallTone = mix(vec3(0.04, 0.04, 0.05), col.rgb * 0.32, wallNorm);
      float mixAmt = clamp(0.45 + 0.45 * wallNorm, 0.0, 1.0);
      col.rgb = mix(col.rgb, wallTone, mixAmt);
    }
  } else {
    // cap (no see-through): keep alpha, shade like a cavity (AO + rim)
    float t = max(1e-6, thickness);
    float cavity = smoothstep(0.0, t, depth);
    float deep = smoothstep(t, t + max(softness, t * 0.8), depth);
    float rim = 1.0 - smoothstep(0.0, t * 0.22, depth);

    // Estimate a stable normal from worldpos derivatives (works across materials).
    vec3 n = normalize(cross(dFdx(wmBubblesWorldPos), dFdy(wmBubblesWorldPos)));
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - wmBubblesWorldPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);

    vec3 base = col.rgb;

    // Base cavity darkening, but never to pure black.
    float ao = mix(1.0, 0.62, cavity);
    ao = mix(ao, 0.48, deep);
    ao *= 1.0 - 0.22 * rim;
    ao = clamp(ao, 0.34, 1.0);

    vec3 shaded = base * ao;

    // Slight cool tint deeper inside to read as depth.
    vec3 cool = vec3(0.04, 0.05, 0.07);
    shaded = mix(shaded, shaded * 0.85 + cool * 0.15, deep);

    // Rim sheen to avoid "stain" look.
    shaded += base * (0.18 * rim * fres);

    float mixAmt = clamp(0.25 + 0.65 * cavity + 0.35 * rim, 0.0, 1.0);
    col.rgb = mix(base, shaded, mixAmt);
  }
}
`;

      if (shader.fragmentShader.includes('#include <common>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fragHeader}`);
      } else if (!shader.fragmentShader.includes('wmApplyBubbles')) {
        shader.fragmentShader = fragHeader + '\n' + shader.fragmentShader;
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `wmApplyBubbles(gl_FragColor);\n#include <dithering_fragment>`
      );
    },
    key
  );
}
