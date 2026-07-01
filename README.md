# Photochrome

Apply legendary Fujifilm film simulations to your photos and videos right in the browser. No uploads, no servers — everything runs locally on your device.

Development toward Photochrome 2.0 is tracked in the [project roadmap](docs/ROADMAP.md).

## Features

- **10 film simulations**: Provia, Velvia, Classic Chrome, Classic Neg, Astia, Eterna, Acros, Superia, Pro 400H, Neopan
- **100 ready-made presets**: Community-curated recipes grouped by style
- **Editor's Choice**: 10 curated top picks by the community
- **White Balance Kelvin**: Fine-tune color temperature from 2500K to 10000K
- **Send feedback**: Report bugs or request features directly from the Help dialog
- **Live preview**: Instant preview of all presets on your photo
- **Editing tools**: Rotate, crop with draggable frame, fine-tune any parameter
- **Video support**: Apply simulations to videos up to 30 seconds
- **GPU-accelerated**: WebGL2 with 3D LUT lookup for fast processing
- **EXIF metadata**: Recipe settings saved in exported JPEG
- **Privacy-first**: All processing happens in the browser, your photos never leave your device

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Testing

```bash
npx playwright install chromium firefox  # Install browsers (once)
npm run test:e2e                         # All tests (Chromium + Firefox + Mobile)
npm run test:e2e:chromium                # Chromium only (fast feedback)
npm run test:e2e:ui                      # Interactive UI mode
```

## Project Structure

```
src/
├── engine/              # Image processing engine (framework-agnostic)
│   ├── processor.ts     # Main processing pipeline
│   ├── haldclut.ts      # 3D LUT parser and lookup
│   ├── curves.ts        # Tone curves
│   ├── color.ts         # Color correction
│   ├── grain.ts         # Film grain
│   ├── effects.ts       # Clarity, sharpness, color chrome
│   ├── transform.ts     # Rotate and crop
│   └── webgl/           # GPU-accelerated processing (WebGL2)
├── presets/
│   ├── simulations/     # Fujifilm film simulations (JSON + HaldCLUT PNG)
│   └── recipes/         # Ready-made presets
├── components/          # React UI components
└── hooks/               # React hooks with business logic
```

## How Film Simulations Work

Photochrome uses a **hybrid processing pipeline** that combines 3D color lookup tables with parametric effects:

1. **Color transform (HaldCLUT)** — A [HaldCLUT](https://rawpedia.rawtherapee.com/Film_Simulation) is a PNG image that encodes a complete 3D color lookup table. Each input RGB color maps to an output RGB color through trilinear interpolation. Our HaldCLUTs are Level 8 (512x512 PNG, 64 colors per channel) converted from Level 12 originals sourced from real Fujifilm XTrans III camera profiles. On the GPU, the HaldCLUT is repacked into a WebGL2 3D texture (`sampler3D`) with hardware trilinear interpolation.

2. **Parametric effects** — Applied on top of the LUT: highlight/shadow recovery, white balance shift, color chrome, grain, clarity, sharpness. These remain adjustable per-recipe.

Simulations without a HaldCLUT (Classic Neg, Eterna) fall back to a curve-based approach using 1D tone curves + split-toning color balance.

| Simulation | Source | Method |
|---|---|---|
| Provia, Velvia, Astia, Classic Chrome, Acros | Fuji XTrans III camera profiles | HaldCLUT |
| Neopan, Superia, Pro 400H | Film stock emulations | HaldCLUT |
| Classic Neg, Eterna | Manual curve approximation | Curve-based |

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **WebGL2** with `sampler3D` for GPU LUT lookup
- **Canvas API** + **Web Workers** for image processing
- **Playwright** for E2E testing

## License

GPL-3.0 — see [LICENSE](LICENSE)

HaldCLUT assets from [cedeber/hald-clut](https://github.com/cedeber/hald-clut) (GPL-3.0).

## Disclaimer

This app is not affiliated with, endorsed by, or connected to FUJIFILM Corporation. Film simulation names are used for reference purposes only.
