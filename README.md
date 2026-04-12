# Photochrome

Apply legendary Fujifilm film simulations to your photos and videos right in the browser. No uploads, no servers — everything runs locally on your device.

## Features

- **10 film simulations**: Provia, Velvia, Classic Chrome, Classic Neg, Astia, Eterna, Acros, Superia, Pro 400H, Neopan
- **52 ready-made presets**: Community-curated recipes grouped by style
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
