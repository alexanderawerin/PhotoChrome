#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uGrainStrength;
uniform float uGrainSize;
uniform float uTime;
const vec3 LUMA_WEIGHTS = vec3(0.299, 0.587, 0.114);
float random(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}
void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  vec4 original = texelFetch(uTexture, pixel, 0);
  float sum = 0.0;
  float count = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 neighbor = pixel + ivec2(x, y);
      if (all(greaterThanEqual(neighbor, ivec2(0))) && all(lessThan(neighbor, ivec2(uResolution)))) {
        sum += dot(texelFetch(uTexture, neighbor, 0).rgb, LUMA_WEIGHTS);
        count += 1.0;
      }
    }
  }
  float diff = dot(original.rgb, LUMA_WEIGHTS) - sum / count;
  vec3 rgb = floor(clamp(original.rgb + vec3(diff * uAmount * 0.5), 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  if (uGrainStrength > 0.0) {
    float noise = (random(vUv * uResolution / uGrainSize + uTime) - 0.5) * uGrainStrength * 60.0 / 255.0;
    rgb += vec3(noise);
  }
  fragColor = vec4(clamp(rgb, 0.0, 1.0), original.a);
}
