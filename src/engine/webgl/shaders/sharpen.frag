// Unsharp mask sharpening
precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;  // Original image
uniform sampler2D uBlurred;  // Blurred version
uniform float uAmount;       // -4 to +4

// Luminance weights (Rec. 709)
const vec3 LUMA_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec3 original = texture2D(uTexture, vUv).rgb;
  vec3 blurred = texture2D(uBlurred, vUv).rgb;
  
  // Calculate luminance difference
  float origLum = dot(original, LUMA_WEIGHTS);
  float blurLum = dot(blurred, LUMA_WEIGHTS);
  float diff = origLum - blurLum;
  
  // Apply sharpening: original + amount * (original - blurred)
  float strength = uAmount * 0.5;
  vec3 result = original + vec3(diff * strength);
  
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}

