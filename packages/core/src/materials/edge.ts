import * as THREE from 'three';
import type { EdgeConfig, WallpaperConfig } from '../types.js';
import { clamp, chainOnBeforeCompile } from './utils.js';

export function applyEdgeEffects(
  material: THREE.Material,
  surfaceKind: 'cap' | 'side',
  config: WallpaperConfig,
  edge: EdgeConfig | undefined,
  stickDimensions?: { width: number; height: number; depth: number }
): void {
  const seam = edge?.seam;
  const band = edge?.band;
  if (!seam?.enabled && !band?.enabled) return;
  if (!stickDimensions) return;

  const halfW = Math.max(1e-6, stickDimensions.width / 2);
  const halfH = Math.max(1e-6, stickDimensions.height / 2);
  const halfD = Math.max(1e-6, stickDimensions.depth / 2);
  const minHalf = Math.max(1e-6, Math.min(halfW, halfH, halfD));

  const stickRoundness = clamp(Number((config as any).stickRoundness) || 0, 0, 1);
  const corner = Math.max(0, Math.min(Math.min(halfW, halfH), Math.min(halfW, halfH) * stickRoundness));
  const profileRaw = String((config as any).stickEndProfile ?? 'rounded');
  const profile = profileRaw === 'chamfer' ? 1 : profileRaw === 'chipped' ? 2 : 0;

  const seamWidth = clamp(Number(seam?.width) || 0, 0, 0.25) * minHalf;
  const seamOpacity = clamp(Number(seam?.opacity) || 0, 0, 1);
  const seamNoise = clamp(Number(seam?.noise) || 0, 0, 1);
  const seamEm = clamp(Number(seam?.emissiveIntensity) || 0, 0, 20);
  const seamColor = new THREE.Color(typeof seam?.color === 'string' ? seam.color : '#0b0b10');

  const bandWidth = clamp(Number(band?.width) || 0, 0, 0.6) * minHalf;
  const bandOpacity = clamp(Number(band?.opacity) || 0, 0, 1);
  const bandNoise = clamp(Number(band?.noise) || 0, 0, 1);
  const bandEm = clamp(Number(band?.emissiveIntensity) || 0, 0, 20);
  const bandColor = new THREE.Color(typeof band?.color === 'string' ? band.color : '#ffffff');

  const key =
    `edgefx-v2:${surfaceKind}:${profile}:${corner.toFixed(4)}:${halfW.toFixed(4)}:${halfH.toFixed(4)}:${halfD.toFixed(4)}:` +
    `${seam?.enabled ? 1 : 0}:${seamColor.getHexString()}:${seamOpacity.toFixed(3)}:${seamWidth.toFixed(4)}:${seamNoise.toFixed(3)}:${seamEm.toFixed(3)}:` +
    `${band?.enabled ? 1 : 0}:${bandColor.getHexString()}:${bandOpacity.toFixed(3)}:${bandWidth.toFixed(4)}:${bandNoise.toFixed(3)}:${bandEm.toFixed(3)}`;

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wmEdgeHalfSize = { value: new THREE.Vector3(halfW, halfH, halfD) };
      shader.uniforms.wmEdgeSurfaceKind = { value: surfaceKind === 'cap' ? 0 : 1 };
      shader.uniforms.wmStickHalfXY = { value: new THREE.Vector2(halfW, halfH) };
      shader.uniforms.wmStickCorner = { value: corner };
      shader.uniforms.wmStickProfile = { value: profile };

      shader.uniforms.wmEdgeSeamEnabled = { value: seam?.enabled ? 1 : 0 };
      shader.uniforms.wmEdgeSeamColor = { value: seamColor };
      shader.uniforms.wmEdgeSeamOpacity = { value: seamOpacity };
      shader.uniforms.wmEdgeSeamWidth = { value: seamWidth };
      shader.uniforms.wmEdgeSeamNoise = { value: seamNoise };
      shader.uniforms.wmEdgeSeamEmissive = { value: seamEm };

      shader.uniforms.wmEdgeBandEnabled = { value: band?.enabled ? 1 : 0 };
      shader.uniforms.wmEdgeBandColor = { value: bandColor };
      shader.uniforms.wmEdgeBandOpacity = { value: bandOpacity };
      shader.uniforms.wmEdgeBandWidth = { value: bandWidth };
      shader.uniforms.wmEdgeBandNoise = { value: bandNoise };
      shader.uniforms.wmEdgeBandEmissive = { value: bandEm };

      const vtx = `\nvarying vec3 wmObjPos;\n`;
      if (shader.vertexShader.includes('#include <common>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${vtx}`);
      } else if (!shader.vertexShader.includes('varying vec3 wmObjPos')) {
        shader.vertexShader = vtx + shader.vertexShader;
      }

      if (shader.vertexShader.includes('#include <begin_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nwmObjPos = position;`);
      }

      const fragUniforms = `
uniform vec3 wmEdgeHalfSize;
uniform int wmEdgeSurfaceKind;
uniform vec2 wmStickHalfXY;
uniform float wmStickCorner;
uniform int wmStickProfile;
uniform int wmEdgeSeamEnabled;
uniform vec3 wmEdgeSeamColor;
uniform float wmEdgeSeamOpacity;
uniform float wmEdgeSeamWidth;
uniform float wmEdgeSeamNoise;
uniform float wmEdgeSeamEmissive;
uniform int wmEdgeBandEnabled;
uniform vec3 wmEdgeBandColor;
uniform float wmEdgeBandOpacity;
uniform float wmEdgeBandWidth;
uniform float wmEdgeBandNoise;
uniform float wmEdgeBandEmissive;
varying vec3 wmObjPos;
`;

      if (shader.fragmentShader.includes('#include <common>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fragUniforms}`);
      } else if (!shader.fragmentShader.includes('uniform vec3 wmEdgeHalfSize')) {
        shader.fragmentShader = fragUniforms + '\n' + shader.fragmentShader;
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Edge effects (cap perimeter + side seams)\nvec3 wmEdge_aPos3 = abs(wmObjPos);\nvec2 wmEdge_aXY = abs(wmObjPos.xy);\nfloat wmEdge_dzEdge = max(0.0, wmEdgeHalfSize.z - wmEdge_aPos3.z);\nfloat wmEdge_rand = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n\nfloat wmEdge_capMargin = 0.0;\n{\n  float wmEdge_hx = wmStickHalfXY.x;\n  float wmEdge_hy = wmStickHalfXY.y;\n  float wmEdge_c = clamp(wmStickCorner, 0.0, min(wmEdge_hx, wmEdge_hy));\n  if (wmStickProfile == 0) {\n    vec2 wmEdge_q = wmEdge_aXY - (vec2(wmEdge_hx, wmEdge_hy) - vec2(wmEdge_c));\n    float wmEdge_sd = length(max(wmEdge_q, 0.0)) + min(max(wmEdge_q.x, wmEdge_q.y), 0.0) - wmEdge_c;\n    wmEdge_capMargin = max(0.0, -wmEdge_sd);\n  } else {\n    float wmEdge_m1 = wmEdge_hx - wmEdge_aXY.x;\n    float wmEdge_m2 = wmEdge_hy - wmEdge_aXY.y;\n    float wmEdge_m3 = ((wmEdge_hx + wmEdge_hy - wmEdge_c) - (wmEdge_aXY.x + wmEdge_aXY.y)) * 0.70710678;\n    wmEdge_capMargin = max(0.0, min(wmEdge_m1, min(wmEdge_m2, wmEdge_m3)));\n  }\n}\n\nfloat wmEdge_base = wmEdgeSurfaceKind == 0 ? wmEdge_capMargin : wmEdge_dzEdge;\n\nif (wmEdgeBandEnabled == 1 && wmEdgeBandWidth > 0.0) {\n  float wmEdge_bm = 1.0 - smoothstep(wmEdgeBandWidth, wmEdgeBandWidth * 2.0, wmEdge_base);\n  wmEdge_bm *= mix(1.0, wmEdge_rand, wmEdgeBandNoise);\n  float wmEdge_bAmt = clamp(wmEdge_bm * wmEdgeBandOpacity, 0.0, 1.0);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmEdgeBandColor, wmEdge_bAmt);\n  gl_FragColor.rgb += wmEdgeBandColor * (wmEdge_bm * wmEdgeBandEmissive);\n}\nif (wmEdgeSeamEnabled == 1 && wmEdgeSeamWidth > 0.0) {\n  float wmEdge_sm = 1.0 - smoothstep(wmEdgeSeamWidth, wmEdgeSeamWidth * 2.0, wmEdge_base);\n  wmEdge_sm *= mix(1.0, wmEdge_rand, wmEdgeSeamNoise);\n  float wmEdge_sAmt = clamp(wmEdge_sm * wmEdgeSeamOpacity, 0.0, 1.0);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmEdgeSeamColor, wmEdge_sAmt);\n  gl_FragColor.rgb += wmEdgeSeamColor * (wmEdge_sm * wmEdgeSeamEmissive);\n}`
      );
    },
    key
  );
}
