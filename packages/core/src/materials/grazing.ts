import * as THREE from 'three';
import type { GrazingConfig } from '../types.js';
import { clamp, chainOnBeforeCompile } from './utils.js';

export function applyGrazing(material: THREE.Material, cfg: GrazingConfig): void {
  if (!cfg.enabled) return;

  const mode = cfg.mode === 'mix' ? 'mix' : 'add';
  const color = new THREE.Color(cfg.color);
  const strength = clamp(cfg.strength, 0, mode === 'add' ? 5 : 1);
  const power = clamp(cfg.power, 0.5, 8);
  const width = clamp(cfg.width, 0, 1);
  const noise = clamp(cfg.noise, 0, 1);

  chainOnBeforeCompile(
    material,
    (shader) => {
      shader.uniforms.wmGrazingColor = { value: color };
      shader.uniforms.wmGrazingStrength = { value: strength };
      shader.uniforms.wmGrazingPower = { value: power };
      shader.uniforms.wmGrazingWidth = { value: width };
      shader.uniforms.wmGrazingNoise = { value: noise };
      shader.uniforms.wmGrazingMode = { value: mode === 'add' ? 0 : 1 };

      const uniforms = `
uniform vec3 wmGrazingColor;
uniform float wmGrazingStrength;
uniform float wmGrazingPower;
uniform float wmGrazingWidth;
uniform float wmGrazingNoise;
uniform int wmGrazingMode;
`;

      if (shader.fragmentShader.includes('#include <common>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${uniforms}`);
      } else if (!shader.fragmentShader.includes('uniform vec3 wmGrazingColor')) {
        shader.fragmentShader = uniforms + '\n' + shader.fragmentShader;
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Grazing highlight\nvec3 gN = normalize(normal);\nvec3 gV = normalize(vViewPosition);\n#ifdef ORTHOGRAPHIC_CAMERA\ngV = vec3(0.0, 0.0, 1.0);\n#endif\nfloat gDot = clamp(dot(gN, gV), 0.0, 1.0);\nfloat gEdge = pow(1.0 - gDot, wmGrazingPower);\nfloat gMask = wmGrazingMode == 0 ? gEdge : smoothstep(1.0 - wmGrazingWidth, 1.0, gEdge);\nfloat gRand = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\ngMask *= mix(1.0, gRand, wmGrazingNoise);\nif (wmGrazingMode == 0) {\n  gl_FragColor.rgb += wmGrazingColor * (gMask * wmGrazingStrength);\n} else {\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, wmGrazingColor, clamp(gMask * wmGrazingStrength, 0.0, 1.0));\n}`
      );
    },
    `grazing-v1:${mode}:${color.getHexString()}:${strength.toFixed(3)}:${power.toFixed(3)}:${width.toFixed(3)}:${noise.toFixed(3)}`
  );
}
