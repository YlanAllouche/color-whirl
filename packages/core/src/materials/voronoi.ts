import * as THREE from 'three';
import type { VoronoiConfig } from '../types.js';
import { clamp, chainOnBeforeCompile } from './utils.js';

export function applyVoronoi(material: THREE.Material, cfg: VoronoiConfig | undefined): void {
  if (!cfg?.enabled) return;

  const space = cfg.space === 'object' ? 1 : 0;
  const kind = cfg.kind === 'cells' ? 0 : 1;
  const scale = clamp(Number(cfg.scale) || 0, 0, 80);
  const seedOffset = Number.isFinite(Number(cfg.seedOffset)) ? Number(cfg.seedOffset) : 0;
  const amount = clamp(Number(cfg.amount) || 0, 0, 1);
  const edgeWidth = clamp(Number(cfg.edgeWidth) || 0, 0, 1);
  const softness = clamp(Number(cfg.softness) || 0, 0, 1);
  const colorStrength = clamp(Number(cfg.colorStrength) || 0, 0, 1);
  const roughnessStrength = clamp(Number(cfg.roughnessStrength) || 0, 0, 1);
  const normalStrength = clamp(Number(cfg.normalStrength) || 0, 0, 1);
  const normalScale = clamp(Number(cfg.normalScale) || 0, 0, 1);
  const materialKindRaw = String((cfg as any).materialKind ?? 'match');
  const materialKind = materialKindRaw === 'cells' ? 0 : materialKindRaw === 'edges' ? 1 : 2;
  const crackleAmount = clamp(Number((cfg as any).crackleAmount) || 0, 0, 1);
  const crackleScale = clamp(Number((cfg as any).crackleScale) || 0, 0, 200);
  const nucleusCfg: any = (cfg as any).nucleus;
  const nucleusEnabled = !!nucleusCfg?.enabled;
  const nucleusSize = clamp(Number(nucleusCfg?.size) || 0, 0, 1);
  const nucleusSoftness = clamp(Number(nucleusCfg?.softness) || 0, 0, 1);
  const nucleusStrength = clamp(Number(nucleusCfg?.strength) || 0, 0, 1);
  const nucleusColor = new THREE.Color(typeof nucleusCfg?.color === 'string' ? nucleusCfg.color : '#ffffff');
  const materialModeRaw = String(cfg.materialMode ?? 'both');
  const materialMode =
    materialModeRaw === 'none' ? 0 : materialModeRaw === 'roughness' ? 1 : materialModeRaw === 'normal' ? 2 : 3;
  const modeRaw = String(cfg.colorMode ?? 'darken');
  const colorMode = modeRaw === 'lighten' ? 1 : modeRaw === 'tint' ? 2 : 0;
  const tint = new THREE.Color(typeof cfg.tintColor === 'string' ? cfg.tintColor : '#ffffff');
  const anyMat: any = material as any;
  const baseRoughness = typeof anyMat.roughness === 'number' ? clamp(anyMat.roughness, 0, 1) : 0.5;
  const baseMetalness = typeof anyMat.metalness === 'number' ? clamp(anyMat.metalness, 0, 1) : 0;
  const baseClearcoat = typeof anyMat.clearcoat === 'number' ? clamp(anyMat.clearcoat, 0, 1) : 0;
  const reflectiveBoost = clamp(
    1.0 + (1.0 - baseRoughness) * 0.7 + baseMetalness * 0.55 + baseClearcoat * 0.2,
    1.0,
    2.1
  );
  const tunedRoughnessStrength = clamp(roughnessStrength * reflectiveBoost, 0, 1);
  const tunedNormalStrength = clamp(normalStrength * (0.9 + (reflectiveBoost - 1.0) * 0.85), 0, 1);
  const tunedNormalScale = clamp(normalScale * (0.92 + (reflectiveBoost - 1.0) * 0.45), 0, 1);
  const usesRoughness = materialMode === 1 || materialMode === 3;
  const usesNormal = materialMode === 2 || materialMode === 3;
  const effectiveRoughnessStrength = usesRoughness ? tunedRoughnessStrength : 0;
  const effectiveNormalStrength = usesNormal ? tunedNormalStrength : 0;
  const effectiveNormalScale = usesNormal ? tunedNormalScale : 0;

  const anyVisible =
    colorStrength > 0 || effectiveRoughnessStrength > 0 || effectiveNormalStrength > 0 || (nucleusEnabled && nucleusStrength > 0);
  if (!(scale > 0) || !(amount > 0) || !anyVisible) return;

  const key =
    `voronoi-v2:${space}:${kind}:${materialKind}:` +
    `${scale.toFixed(4)}:${seedOffset.toFixed(4)}:` +
    `${amount.toFixed(4)}:${edgeWidth.toFixed(4)}:${softness.toFixed(4)}:` +
    `${colorStrength.toFixed(4)}:${materialMode}:${effectiveRoughnessStrength.toFixed(4)}:${effectiveNormalStrength.toFixed(4)}:${effectiveNormalScale.toFixed(4)}:` +
    `${colorMode}:${tint.getHexString()}:` +
    `${crackleAmount.toFixed(4)}:${crackleScale.toFixed(4)}:` +
    `${nucleusEnabled ? 1 : 0}:${nucleusSize.toFixed(4)}:${nucleusSoftness.toFixed(4)}:${nucleusStrength.toFixed(4)}:${nucleusColor.getHexString()}`;

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wmVorSpace = { value: space };
      shader.uniforms.wmVorKind = { value: kind };
      shader.uniforms.wmVorMatKind = { value: materialKind };
      shader.uniforms.wmVorScale = { value: scale };
      shader.uniforms.wmVorSeed = { value: seedOffset };
      shader.uniforms.wmVorAmount = { value: amount };
      shader.uniforms.wmVorEdgeWidth = { value: edgeWidth };
      shader.uniforms.wmVorSoftness = { value: softness };
      shader.uniforms.wmVorColorStrength = { value: colorStrength };
      shader.uniforms.wmVorRoughnessStrength = { value: effectiveRoughnessStrength };
      shader.uniforms.wmVorNormalStrength = { value: effectiveNormalStrength };
      shader.uniforms.wmVorNormalScale = { value: effectiveNormalScale };
      shader.uniforms.wmVorColorMode = { value: colorMode };
      shader.uniforms.wmVorTint = { value: tint };
      shader.uniforms.wmVorCrackleAmount = { value: crackleAmount };
      shader.uniforms.wmVorCrackleScale = { value: crackleScale };
      shader.uniforms.wmVorNucleusEnabled = { value: nucleusEnabled ? 1 : 0 };
      shader.uniforms.wmVorNucleusSize = { value: nucleusSize };
      shader.uniforms.wmVorNucleusSoftness = { value: nucleusSoftness };
      shader.uniforms.wmVorNucleusStrength = { value: nucleusStrength };
      shader.uniforms.wmVorNucleusColor = { value: nucleusColor };

      const vtxHeader = `\nvarying vec3 wmVorWorldPos;\nvarying vec3 wmVorObjPos;\n`;
      if (shader.vertexShader.includes('#include <common>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${vtxHeader}`);
      } else if (!shader.vertexShader.includes('varying vec3 wmVorWorldPos')) {
        shader.vertexShader = vtxHeader + shader.vertexShader;
      }

      if (shader.vertexShader.includes('#include <begin_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nwmVorObjPos = position;`
        );
      }

      if (shader.vertexShader.includes('#include <worldpos_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>\nwmVorWorldPos = worldPosition.xyz;`
        );
      } else if (!shader.vertexShader.includes('wmVorWorldPos')) {
        // Fallback: approximate from model matrix.
        shader.vertexShader = shader.vertexShader.replace(
          'void main() {',
          `void main() {\n#ifdef USE_INSTANCING\nvec4 wmVorWP = modelMatrix * instanceMatrix * vec4(position, 1.0);\n#else\nvec4 wmVorWP = modelMatrix * vec4(position, 1.0);\n#endif\nwmVorWorldPos = wmVorWP.xyz;\nwmVorObjPos = position;`
        );
      }

      const fragUniforms = `
 uniform int wmVorSpace;
 uniform int wmVorKind;
 uniform int wmVorMatKind;
 uniform float wmVorScale;
 uniform float wmVorSeed;
 uniform float wmVorAmount;
 uniform float wmVorEdgeWidth;
 uniform float wmVorSoftness;
 uniform float wmVorColorStrength;
 uniform float wmVorRoughnessStrength;
 uniform float wmVorNormalStrength;
 uniform float wmVorNormalScale;
 uniform int wmVorColorMode;
 uniform vec3 wmVorTint;
 uniform float wmVorCrackleAmount;
 uniform float wmVorCrackleScale;
 uniform int wmVorNucleusEnabled;
 uniform float wmVorNucleusSize;
 uniform float wmVorNucleusSoftness;
 uniform float wmVorNucleusStrength;
 uniform vec3 wmVorNucleusColor;
 varying vec3 wmVorWorldPos;
 varying vec3 wmVorObjPos;

float wmVorHash1(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

vec3 wmVorHash3(vec3 p) {
  return vec3(
    wmVorHash1(p + vec3(0.0, 0.0, 0.0)),
    wmVorHash1(p + vec3(17.0, 13.0, 5.0)),
    wmVorHash1(p + vec3(31.0, 7.0, 19.0))
  );
}

vec3 wmVorCoords(vec3 p3) {
  return p3 * wmVorScale + vec3(wmVorSeed, wmVorSeed * 1.37, wmVorSeed * 2.11);
}

vec3 wmVorUncoords(vec3 p) {
  return (p - vec3(wmVorSeed, wmVorSeed * 1.37, wmVorSeed * 2.11)) / max(1e-6, wmVorScale);
}

float wmVorNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = wmVorHash1(i + vec3(0.0, 0.0, 0.0));
  float n100 = wmVorHash1(i + vec3(1.0, 0.0, 0.0));
  float n010 = wmVorHash1(i + vec3(0.0, 1.0, 0.0));
  float n110 = wmVorHash1(i + vec3(1.0, 1.0, 0.0));
  float n001 = wmVorHash1(i + vec3(0.0, 0.0, 1.0));
  float n101 = wmVorHash1(i + vec3(1.0, 0.0, 1.0));
  float n011 = wmVorHash1(i + vec3(0.0, 1.0, 1.0));
  float n111 = wmVorHash1(i + vec3(1.0, 1.0, 1.0));

  float x00 = mix(n000, n100, u.x);
  float x10 = mix(n010, n110, u.x);
  float x01 = mix(n001, n101, u.x);
  float x11 = mix(n011, n111, u.x);
  float y0 = mix(x00, x10, u.y);
  float y1 = mix(x01, x11, u.y);
  return mix(y0, y1, u.z);
}

void wmVorEval(vec3 p, out float f1, out float f2, out vec3 r1) {
  vec3 g = floor(p);
  vec3 f = fract(p);
  float d1 = 1e9;
  float d2 = 1e9;
  vec3 bestR = vec3(0.0);
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + wmVorHash3(g + o) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          bestR = r;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  f1 = sqrt(max(0.0, d1));
  f2 = sqrt(max(0.0, d2));
  r1 = bestR;
}

float wmVorFieldValueForKind(float f1, float f2, int kind) {
  return kind == 0 ? f1 : (f2 - f1);
}

float wmVorMaskFromField(float v, int kind) {
  float w = max(1e-6, wmVorEdgeWidth);
  float s = max(1e-6, wmVorSoftness);
  if (kind == 0) {
    // "cells": show a soft nucleus-like blob (keeps historical look).
    return 1.0 - smoothstep(0.15, 0.15 + s * 0.9, v);
  }
  // "edges": wall mask around Voronoi borders.
  return 1.0 - smoothstep(w, w + s, v);
}

float wmVorCrackleMul(vec3 coords) {
  if (!(wmVorCrackleAmount > 0.0) || !(wmVorCrackleScale > 0.0)) return 1.0;
  vec3 p3 = wmVorUncoords(coords);
  vec3 np = p3 * wmVorCrackleScale + vec3(wmVorSeed * 0.71, wmVorSeed * 1.13, wmVorSeed * 1.97);
  float n = wmVorNoise(np);
  float cut = smoothstep(0.35, 0.75, n);
  return mix(1.0, cut, clamp(wmVorCrackleAmount, 0.0, 1.0));
}

float wmVorMaskAtKind(vec3 coords, int kind) {
  float f1;
  float f2;
  vec3 r1;
  wmVorEval(coords, f1, f2, r1);
  float v = wmVorFieldValueForKind(f1, f2, kind);
  float m = wmVorMaskFromField(v, kind);
  if (kind == 1) {
    m *= wmVorCrackleMul(coords);
  }
  return m;
}

void wmApplyVoronoi(inout vec4 col) {
  vec3 p3 = wmVorSpace == 0 ? wmVorWorldPos : wmVorObjPos;
  vec3 p = wmVorCoords(p3);
  float f1;
  float f2;
  vec3 r1;
  wmVorEval(p, f1, f2, r1);
  float mask = wmVorMaskFromField(wmVorFieldValueForKind(f1, f2, wmVorKind), wmVorKind);
  if (wmVorKind == 1) {
    mask *= wmVorCrackleMul(p);
  }

  float a = clamp(wmVorAmount * mask, 0.0, 1.0);
  float cs = clamp(wmVorColorStrength, 0.0, 1.0);
  if (wmVorColorMode == 0) {
    col.rgb *= mix(1.0, 1.0 - cs, a);
  } else if (wmVorColorMode == 1) {
    col.rgb = mix(col.rgb, vec3(1.0), a * cs);
  } else {
    col.rgb = mix(col.rgb, wmVorTint, a * cs);
  }

  if (wmVorNucleusEnabled == 1) {
    float ns = max(1e-6, wmVorNucleusSize);
    float nsoft = max(1e-6, wmVorNucleusSoftness);
    float d = length(r1);
    float nmask = 1.0 - smoothstep(ns, ns + nsoft, d);
    float na = clamp(nmask * wmVorNucleusStrength, 0.0, 1.0);
    col.rgb = mix(col.rgb, wmVorNucleusColor, na);
  }
}

float wmVorMaterialMask() {
  vec3 p3 = wmVorSpace == 0 ? wmVorWorldPos : wmVorObjPos;
  vec3 p = wmVorCoords(p3);
  int k = wmVorMatKind == 2 ? wmVorKind : wmVorMatKind;
  return clamp(wmVorAmount * wmVorMaskAtKind(p, k), 0.0, 1.0);
}

vec3 wmVorNormalPerturb(vec3 baseNormal) {
  vec3 p3 = wmVorSpace == 0 ? wmVorWorldPos : wmVorObjPos;
  vec3 p = wmVorCoords(p3);
  float stepSize = max(0.00035, mix(0.0025, 0.055, wmVorNormalScale)) / max(wmVorScale, 0.35);
  int k = wmVorMatKind == 2 ? wmVorKind : wmVorMatKind;
  float center = clamp(wmVorAmount * wmVorMaskAtKind(p, k), 0.0, 1.0);
  float dx = clamp(wmVorAmount * wmVorMaskAtKind(p + vec3(stepSize, 0.0, 0.0), k), 0.0, 1.0) - center;
  float dy = clamp(wmVorAmount * wmVorMaskAtKind(p + vec3(0.0, stepSize, 0.0), k), 0.0, 1.0) - center;
  float dz = clamp(wmVorAmount * wmVorMaskAtKind(p + vec3(0.0, 0.0, stepSize), k), 0.0, 1.0) - center;
  vec3 grad = vec3(dx, dy, dz) / max(1e-6, stepSize);
  vec3 bumped = normalize(baseNormal - grad * (wmVorNormalStrength * 0.055));
  return bumped;
}
`;

      if (shader.fragmentShader.includes('#include <common>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fragUniforms}`);
      } else if (!shader.fragmentShader.includes('wmApplyVoronoi')) {
        shader.fragmentShader = fragUniforms + '\n' + shader.fragmentShader;
      }

      if (shader.fragmentShader.includes('#include <normal_fragment_maps>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>\nnormal = wmVorNormalPerturb(normal);`
        );
      }

      if (shader.fragmentShader.includes('#include <roughnessmap_fragment>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>\nfloat wmVorMask = wmVorMaterialMask();\nfloat wmVorCentered = (wmVorMask - 0.5) * 2.0;\nroughnessFactor = clamp(roughnessFactor + wmVorCentered * wmVorRoughnessStrength, 0.0, 1.0);`
        );
      } else if (shader.fragmentShader.includes('float roughnessFactor = roughness;')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          'float roughnessFactor = roughness;',
          `float wmVorMask = wmVorMaterialMask();\nfloat wmVorCentered = (wmVorMask - 0.5) * 2.0;\nfloat roughnessFactor = clamp(roughness + wmVorCentered * wmVorRoughnessStrength, 0.0, 1.0);`
        );
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `wmApplyVoronoi(gl_FragColor);\n#include <dithering_fragment>`
      );
    },
    key
  );
}
