#version 300 es
// Film simulation fragment shader
// Combines all effects in a single pass (except sharpness which needs blur)
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 fragColor;

// Input texture
uniform sampler2D uTexture;
uniform vec2 uResolution;

// Pre-simulation settings, matching the CPU pipeline
uniform int uDynamicRange; // 0 = DR100, 1 = DR200, 2 = DR400
uniform vec2 uWbPresetShift; // R/B shift in Fujifilm units
uniform bool uUseKelvin;
uniform vec2 uKelvinScale; // R/B multipliers relative to 5500K

// HaldCLUT 3D LUT (replaces curve + colorBalance + saturation)
uniform sampler3D uHaldCLUT;
uniform bool uUseHaldCLUT;
uniform int uHaldCLUTSize; // grid size (e.g. 64)

// Curve LUT (256x1 texture) — fallback when no HaldCLUT
uniform sampler2D uCurveLUT;
uniform bool uUseCurve;

// Color balance (split-toning) — fallback when no HaldCLUT
uniform vec3 uShadowsBalance;    // RGB shift for shadows
uniform vec3 uHighlightsBalance; // RGB shift for highlights
uniform bool uUseColorBalance;

// Saturation
uniform float uSimulationSaturation; // Base curve-simulation adjustment
uniform float uRecipeSaturation; // Recipe color setting, always applied

// White balance shift
uniform float uWbShiftRed;  // -9 to +9
uniform float uWbShiftBlue; // -9 to +9

// Tone adjustment
uniform float uHighlightTone; // -2 to +4
uniform float uShadowTone;    // -2 to +4

// Clarity (midtone contrast)
uniform float uClarity; // -5 to +5

// Color Chrome
uniform float uColorChrome; // 0 = off, 0.12 = weak, 0.25 = strong

// Color Chrome FX Blue
uniform float uColorChromeFXBlue; // 0 = off, 1.08 = weak, 1.15 = strong

// Grain
uniform float uGrainStrength; // 0 to 1
uniform float uGrainSize;     // 0.5 to 2
uniform float uTime;          // For grain animation (video)

// Luminance weights (Rec. 709)
const vec3 LUMA_WEIGHTS = vec3(0.299, 0.587, 0.114);

// Pseudo-random function for grain
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Calculate luminance
float luminance(vec3 color) {
  return dot(color, LUMA_WEIGHTS);
}

vec3 quantize(vec3 rgb) {
  return floor(clamp(rgb, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
}

void main() {
  vec4 color = texture(uTexture, vUv);
  vec3 rgb = color.rgb;

  if (uDynamicRange > 0) {
    float lum = luminance(rgb);
    float shadowLift = uDynamicRange == 1 ? 15.0 / 255.0 : 30.0 / 255.0;
    float highlightCompress = uDynamicRange == 1 ? 0.06 : 0.12;
    float lift = shadowLift * pow(1.0 - lum, 2.0);
    float compress = -highlightCompress * pow(lum, 2.0);
    rgb = quantize(rgb + vec3(lift + compress));
  }

  if (uWbPresetShift.x != 0.0 || uWbPresetShift.y != 0.0) {
    rgb.r += uWbPresetShift.x * 2.5 / 255.0;
    rgb.b += uWbPresetShift.y * 2.5 / 255.0;
    rgb = quantize(rgb);
  }

  if (uUseKelvin) {
    rgb.r *= uKelvinScale.x;
    rgb.b *= uKelvinScale.y;
    rgb = quantize(rgb);
  }

  // === SIMULATION: HaldCLUT or curve-based ===

  if (uUseHaldCLUT) {
    // 3D LUT lookup with half-texel offset for correct sampling
    float lutSize = float(uHaldCLUTSize);
    float scale = (lutSize - 1.0) / lutSize;
    float offset = 0.5 / lutSize;
    rgb = quantize(texture(uHaldCLUT, rgb * scale + offset).rgb);
  } else {
    // 1. Apply curve LUT (fallback)
    if (uUseCurve) {
      rgb.r = texture(uCurveLUT, vec2((rgb.r * 255.0 + 0.5) / 256.0, 0.5)).r;
      rgb.g = texture(uCurveLUT, vec2((rgb.g * 255.0 + 0.5) / 256.0, 0.5)).g;
      rgb.b = texture(uCurveLUT, vec2((rgb.b * 255.0 + 0.5) / 256.0, 0.5)).b;
    }

    // 2. Color balance / split-toning (fallback)
    if (uUseColorBalance) {
      float lum = luminance(rgb);
      float shadowWeight = 1.0 - lum;
      float highlightWeight = lum;

      rgb += uShadowsBalance * shadowWeight / 255.0;
      rgb += uHighlightsBalance * highlightWeight / 255.0;
      rgb = quantize(rgb);
    }

    // 3. Simulation saturation (fallback — only base saturation from simulation)
    if (uSimulationSaturation != 0.0) {
      float gray = luminance(rgb);
      float multiplier = 1.0 + uSimulationSaturation;
      rgb = quantize(vec3(gray) + (rgb - vec3(gray)) * multiplier);
    }
  }

  // === RECIPE SETTINGS (always applied) ===

  // Tone adjustment (highlight/shadow)
  if (uHighlightTone != 0.0 || uShadowTone != 0.0) {
    float lum = luminance(rgb);

    float shadowWeight = pow(1.0 - lum, 2.0);
    float shadowMult = uShadowTone * shadowWeight * 8.0 / 255.0;

    float highlightWeight = pow(lum, 2.0);
    float highlightMult = uHighlightTone * highlightWeight * 8.0 / 255.0;

    rgb = quantize(rgb + vec3(shadowMult + highlightMult));
  }

  if (uRecipeSaturation != 0.0) {
    float gray = luminance(rgb);
    float multiplier = 1.0 + uRecipeSaturation;
    rgb = quantize(vec3(gray) + (rgb - vec3(gray)) * multiplier);
  }

  // White balance shift
  if (uWbShiftRed != 0.0 || uWbShiftBlue != 0.0) {
    float rShift = uWbShiftRed * 2.5 / 255.0;
    float bShift = uWbShiftBlue * 2.5 / 255.0;
    rgb.r += rShift;
    rgb.b += bShift;
    rgb = quantize(rgb);
  }

  // Color Chrome
  if (uColorChrome > 0.0) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float chroma = maxC - minC;

    if (chroma > 15.0 / 255.0) {
      float gray = luminance(rgb);
      float toneFactor = 1.0 - pow(gray, 0.5) * 0.5;
      float boost = 1.0 + uColorChrome * chroma * toneFactor;

      rgb = quantize(vec3(gray) + (rgb - vec3(gray)) * boost);
    }
  }

  // Color Chrome FX Blue
  if (uColorChromeFXBlue > 1.0) {
    float blueRatio = rgb.b / (max(rgb.r, rgb.g) + 1.0 / 255.0);

    if (blueRatio > 1.1 && rgb.b > 50.0 / 255.0) {
      float gray = luminance(rgb);
      float satBoost = uColorChromeFXBlue;
      float deepenFactor = uColorChromeFXBlue < 1.1 ? 0.03 : 0.06;

      rgb = quantize(vec3(gray) + (rgb - vec3(gray)) * satBoost);
      rgb.r -= rgb.r * deepenFactor;
      rgb.g -= rgb.g * deepenFactor * 0.5;
      rgb = quantize(rgb);
    }
  }

  // Clarity (midtone contrast)
  if (uClarity != 0.0) {
    float lum = luminance(rgb);
    float factor = uClarity * 0.08;

    float midtoneFactor = 1.0 - abs(lum - 128.0 / 255.0) / (128.0 / 255.0);
    float adjustedFactor = factor * midtoneFactor;

    float diff = lum - 128.0 / 255.0;
    rgb = quantize(rgb + vec3(diff * adjustedFactor));
  }

  // Grain (applied last)
  if (uGrainStrength > 0.0) {
    float grainIntensity = uGrainStrength * 30.0 / 255.0;

    vec2 grainUv = vUv * uResolution / uGrainSize;

    float noise = (random(grainUv + uTime) - 0.5) * grainIntensity * 2.0;
    rgb += vec3(noise);
  }

  // Clamp to valid range
  rgb = clamp(rgb, 0.0, 1.0);

  fragColor = vec4(rgb, color.a);
}
