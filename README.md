# Photochrome

Edit photos and short videos with 10 Fujifilm-inspired film simulations and 100 presets right in the browser. Try the three-photo demo, save favorite presets, get local Smart Picks, and export individual photos, photo ZIPs, or processed video. Media processing runs locally on your device, without uploading files to a processing server.

Development toward Photochrome 2.0 is tracked in the [project roadmap](docs/ROADMAP.md). Technical health work and the latest maintenance check are tracked in the [audit fix plan](docs/audit-2026-07-02-fix-plan-ru.md).

## Features

- **Playable demo**: Start with three demo photos; add your own media to unlock Adjust, Crop, and export
- **Smart Picks and Favorites**: Local photo recommendations and saved favorite presets
- **Batch export**: Export photos with presets as a ZIP; untouched photos are skipped
- **10 film simulations**: Provia, Velvia, Classic Chrome, Classic Neg, Astia, Eterna, Acros, Superia, Pro 400H, Neopan
- **100 ready-made presets**: Community-curated recipes grouped by style
- **Editor's Choice**: 10 curated top picks by the community
- **White Balance Kelvin**: Fine-tune color temperature from 2500K to 10000K
- **Send feedback**: Report bugs or request features directly from the Help dialog
- **Live preview**: Instant preview of all presets on your photo
- **Editing tools**: Rotate, crop with draggable frame, fine-tune any parameter
- **Video support**: Apply simulations to videos up to 30 seconds
- **Hybrid processing**: CPU LUT processing for photos, Web Workers for photo export, and WebGL2 for video and eligible curve-based photo previews
- **EXIF metadata**: Recipe settings saved in exported JPEG
- **Privacy-first**: All processing happens in the browser, your photos never leave your device

## Getting Started

Use Node.js 22, matching CI.

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

Build output is written to `out/`. Use `npm run preview` to serve the build locally.

## Asset maintenance

- `npm run process-cards` regenerates `public/cards/` from the JPEG sources in `img/` with randomized grading. Those source photos are still needed by the generator.
- `npm run generate-seo` regenerates favicons and `public/og-image.jpg` using the template in `scripts/generate-seo-assets.mjs` and sorted photos from `public/cards/`. The recipe count is read from the JSON presets; the committed social image uses this template.
- `npm run convert-luts` is an optional source-asset tool. It requires Level 12 RGB PNGs in `src/presets/simulations/lut-originals/`, which are not included in this repository, and overwrites matching Level 8 PNGs in `src/presets/simulations/lut/`. Normal builds use the committed Level 8 assets and do not need this step.
- `npm run generate-fixtures` regenerates the committed E2E JPEGs and MP4. It requires `ffmpeg` (or `FFMPEG_PATH`) for the H.264/AAC video. Browser tests use the committed fixtures and do not need this step.

## Testing

Checks that do not launch a browser:

```bash
npm run lint
npm run check:unused                   # Unused files, exports, types, and dependencies
npm run test:types                     # Type-check application source and unit tests
npm run test:e2e:types                  # Type-check E2E helpers, specs, and config
npm test                               # Engine and preset unit tests
npm run build
```

Browser checks (require installed browsers):

```bash
npx playwright install chromium firefox  # Install browsers (once)
npm run test:e2e                         # All tests (Chromium + Firefox + Mobile)
npm run test:e2e:chromium                # Desktop Chromium, matching main CI
npm run test:e2e:ui                      # Interactive UI mode
```

Main CI runs lint, unused-code analysis, unit/E2E type checks, unit tests, build, and desktop Chromium E2E. Firefox and the selected mobile specs run in a separate weekly/manual workflow. `mobile-chrome` emulates a Pixel 7; it does not verify real mobile hardware. WebKit/Safari is not configured. Type checks run without launching browsers; unit tests use the ES2023 library available in Node.js 22, while the application build keeps its ES2020 library.

Playwright uses its managed Chromium by default. To use an existing installation for the Chromium projects, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its absolute path, for example:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:chromium -- --workers=1
```

`npm run check:unused` uses Knip. Package scripts declare the asset/fixture generators as entry points, and `knip.json` resolves the Vite `/src/` imports used by browser tests. No unused-code categories are suppressed.

The app has a web manifest but no service worker, offline support, or OS share-target handler. Add files through the app's upload controls.

The page includes Yandex.Metrika analytics in `index.html` (including Webvisor, clickmap, and link tracking). Local media processing does not mean the page makes no network requests.

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
│   ├── editor-sessions.ts # Photo-owned temporary editing drafts
│   ├── media-session.ts # Media loading, replacement, cancellation, and retry
│   ├── media-loading.ts # Photo/video decoding and demo loading
│   ├── video/           # Video capabilities, decoding, audio, muxing, and export
│   ├── recommend/       # Local Smart Picks analysis and scoring
│   ├── batch-export.ts  # Photo ZIP export
│   └── webgl/           # GPU-accelerated processing (WebGL2)
├── presets/
│   ├── simulations/     # Fujifilm film simulations (JSON + HaldCLUT PNG)
│   └── recipes/         # Ready-made presets
├── components/          # React UI components
└── hooks/               # React hooks with business logic
```

## How Film Simulations Work

Committed photo edits live in `ImageItem`. `useEditorSession` owns one temporary Adjust, desktop tuning, or Crop draft, bound to the photo and preset; Apply/Done commits it, while Cancel or switching owners discards it. Export snapshots the visible draft. Preset preview caches use immutable `ImageData` object identity, so new photos and transformed buffers cannot share an entry accidentally.

`MediaSession` owns loading, retry, and loaded media. A pending or failed replacement retains the previous editor; Retry repeats the original replace/append/video/demo request. Cancellation and operation identity reject late decoder results, and video resources are released when their ownership ends. `useMediaSession` connects this lifecycle to React; `useVideoExport` owns video export separately. Native decoder and browser behavior still require E2E checks beyond the unit-tested state transitions.

Smart Picks analyzes photo pixels in a Web Worker and caches recommendations by photo ID. The JPEG EXIF reader currently extracts ISO only. The scorer accepts an optional color temperature, but reading camera-specific Kelvin metadata is not implemented; that requires extending `extractExif` with format-specific handling and test fixtures.

Photochrome uses a **hybrid processing pipeline** that combines 3D color lookup tables with parametric effects:

1. **Color transform (HaldCLUT)** — A [HaldCLUT](https://rawpedia.rawtherapee.com/Film_Simulation) is a PNG image that encodes a complete 3D color lookup table. Each input RGB color maps to an output RGB color through trilinear interpolation. Our HaldCLUTs are Level 8 (512x512 PNG, 64 colors per channel) converted from Level 12 originals sourced from real Fujifilm XTrans III camera profiles. Photo previews use CPU LUT lookup; full-size photo export runs the CPU pipeline in a Web Worker. Video uses the LUT as a WebGL2 3D texture (`sampler3D`) with hardware trilinear interpolation. Eligible curve-based photo previews also use WebGL2, with a CPU fallback.

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
- **Vitest** for unit tests; **Playwright** for E2E testing

## License

GPL-3.0 — see [LICENSE](LICENSE)

HaldCLUT assets from [cedeber/hald-clut](https://github.com/cedeber/hald-clut) (GPL-3.0).

## Disclaimer

This app is not affiliated with, endorsed by, or connected to FUJIFILM Corporation. Film simulation names are used for reference purposes only.
