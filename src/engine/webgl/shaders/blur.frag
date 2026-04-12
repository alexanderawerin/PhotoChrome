#version 300 es
// Simple box blur for sharpness (unsharp mask)
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uDirection; // (1,0) for horizontal, (0,1) for vertical

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec3 result = vec3(0.0);

  // 3x3 box blur (simplified for speed)
  for (int i = -1; i <= 1; i++) {
    vec2 offset = vec2(float(i)) * uDirection * texelSize;
    result += texture(uTexture, vUv + offset).rgb;
  }

  result /= 3.0;
  fragColor = vec4(result, 1.0);
}
