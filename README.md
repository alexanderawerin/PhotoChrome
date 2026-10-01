# Photochrome

Edit photos and videos up to 30 seconds in your browser. Start with Original, choose one of ten Fujifilm-inspired base films, optionally crop or rotate, then export. Advanced settings keeps all 100 existing recipes and manual color controls available within their film. Media processing runs locally on your device, without uploading files to a processing server.

The current delivery and remaining verification gates are tracked in the [project roadmap](docs/ROADMAP.md). Earlier maintenance evidence is recorded in the [audit fix plan](docs/audit-2026-07-02-fix-plan-ru.md).

## Features

- **Three-photo demo**: Switch photos, try films and compare with Original; add your own photos or video to unlock geometry, Advanced settings and export.
- **Original and ten base films**: Provia, Velvia, Astia, Pro 400H, Superia, Acros, Neopan, Eterna, Classic Chrome and Classic Neg. New media starts as Original; choosing a film clears earlier color overrides while preserving geometry.
- **100 Advanced recipes**: Recipes and Manual share one temporary preview. Apply commits the profile and settings together; Cancel, Escape or changing media/film discards the draft. Favorite recipe IDs are shared between photo and video, with favorites first within their film.
- **Manual color**: Existing tone, color, grain and detail controls, white-balance presets and 2500–10000 K temperature. Parameter reset uses the selected recipe or base-film value.
- **Photo and video geometry**: Free/fixed crop, positioning, zoom, quarter turns, fine angle and horizontal reflection. Geometry stays independent of color; comparison disables color while keeping the composition and video playback position.
- **JPEG, ZIP and MP4 export**: Save applied edits, including Original and geometry-only results. Export all includes every loaded photo; partial failures are reported and zero-success exports produce no success archive.
- **Apply color to all photos**: Copy the applied film, recipe and effective color settings, including Original, while preserving each photo's geometry.
- **Video sound**: Preserve source audio when the actual browser export configuration supports it. Otherwise, silent output requires an explicit **Export without sound** choice; Cancel leaves the edit available. MP4 support is checked at runtime.
- **Local processing**: CPU/worker processing for photos and WebGL2 for video and eligible photo previews. Required film resources must be ready before applying or exporting a processed result.
- **EXIF and feedback**: JPEG export metadata and GitHub feedback from Help remain available.

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
- `npm run generate-fixtures` regenerates the committed E2E JPEGs and asymmetric MP4 fixtures, including silent, audio-offset, variable-timing and rotated sources. It requires `ffmpeg` (or `FFMPEG_PATH`) for the H.264/AAC video. Browser tests use the committed fixtures and do not need this step.

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
│   ├── editor-sessions.ts # Media-owned color and geometry drafts
│   ├── media-session.ts # Media loading, replacement, cancellation, and retry
│   ├── media-loading.ts # Photo/video decoding and demo loading
│   ├── video/           # Video capabilities, decoding, audio, muxing, and export
│   ├── batch-export.ts  # Photo ZIP export
│   └── webgl/           # GPU-accelerated processing (WebGL2)
├── presets/
│   ├── simulations/     # Fujifilm film simulations (JSON + HaldCLUT PNG)
│   └── recipes/         # Ready-made presets
├── components/          # React UI components
└── hooks/               # React hooks with business logic
```

## How Film Simulations Work

Committed photo color and geometry live in each `ImageItem`; video retains its own committed color and transform. The shared editor-session contract owns one temporary Advanced or Crop draft bound to its media and committed profile. Apply commits the complete draft, while Cancel or changing ownership discards it. Export snapshots the applied state and is unavailable during a draft. Retry reuses the failed request rather than reading a newly selected profile or export mode. Preview caches use immutable `ImageData` identity.

`MediaSession` owns loading, exact-request Retry and loaded media. A pending or failed replacement retains the previous editor; cancellation and operation identity reject stale decoder results. Video URLs and decoder/encoder resources are released when ownership ends. `useMediaSession` connects loading to React, while `useVideoExport` owns video export cancellation and explicit sound consent.

Video export decodes source frames with their presentation timestamps and durations, composes the shared geometry and encodes MP4. Codec dimensions are checked after composition; an odd dimension receives at most one pixel of padding rather than image stretching. Browser support and device behavior require actual runtime verification; the roadmap lists outstanding gates.

Photochrome uses a **hybrid processing pipeline** that combines 3D color lookup tables with parametric effects:

1. **Color transform (HaldCLUT)** — A [HaldCLUT](https://rawpedia.rawtherapee.com/Film_Simulation) is a PNG image that encodes a complete 3D color lookup table. Each input RGB color maps to an output RGB color through trilinear interpolation. Our HaldCLUTs are Level 8 (512x512 PNG, 64 colors per channel) converted from Level 12 originals sourced from real Fujifilm XTrans III camera profiles. Photo previews use CPU LUT lookup; full-size photo export runs the CPU pipeline in a Web Worker. Video uses the LUT as a WebGL2 3D texture (`sampler3D`) with hardware trilinear interpolation. Eligible curve-based photo previews also use WebGL2, with a CPU fallback.

2. **Parametric effects** — Applied on top of the LUT: highlight/shadow recovery, white balance shift, color chrome, grain, clarity, sharpness. These remain adjustable per-recipe.

Classic Neg and Eterna intentionally use a curve-based approach using 1D tone curves + split-toning color balance.

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
