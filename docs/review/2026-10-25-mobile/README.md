# Mobile-first PhotoChrome review

Actual running production build, recorded from source commit `a2cb0e89fb3f11fa0275163ebea5a2d9fee2b031`. The subsequent review-artifact commit changes no application code. The earlier photographic-workspace branch remains available for comparison.

[Play / download the mobile walkthrough](PhotoChrome-mobile-first-walkthrough.mp4)

59.04 seconds, H.264 MP4, 786×1784, about 9.4 MB. The app ran at a 393×852 CSS viewport in Chromium 151.0.7922.173 with touch/mobile emulation. Captions sit below the interface. This is a continuous actual-interface recording with startup trimmed, not a mockup or slideshow. It is not a recording from a physical phone.

Demonstrated: importing three photos; film and recipe selection; touch before/after; manual adjustment; 3:4 crop; collection navigation with independent edits; real JPEG and ZIP export.

- [Films / portrait photograph](PhotoChrome-mobile-films.png)
- [Focused manual adjustment](PhotoChrome-mobile-adjustments.png)
- [Landscape photograph](PhotoChrome-mobile-landscape.png)

## Verification

Passed on the final application code:

- Lint and unused-code/dependency checks.
- Application, E2E and unit-test TypeScript checks.
- 179 unit tests in 29 files.
- Production build (existing large-chunk warning remains).
- Full Chromium suite: 195 passed, 4 skipped.
- Mobile Chrome project: 69 passed, 5 skipped.
- Actual mobile visual QA at 393×852 and 320×740, with portrait and landscape assets; combined comparison with the selected Halide/VSCO references and the owner's mobile foundation. See the root `design-qa.md`.
- MP4 full decode with FFmpeg; browser playback advanced, five sought timestamps rendered distinct frames, no media error.
- Recording actions asserted actual pixel changes/restoration and downloaded output. The edited JPEG decodes at 1200×1600; ZIP integrity passed and all three JPEG entries decode with their own expected dimensions. No application page errors during capture.

Skipped / unavailable:

- Chromium skips: two completion tests assigned to the mobile project, demo Crop by product restriction, supported-source AAC round-trip because this browser does not support that encoder configuration.
- Mobile skips: five desktop-only completion cases, covered by Chromium.
- Firefox and WebKit binaries are unavailable here. No physical Android, iPhone, Safari or supported physical-device AAC acceptance was performed.
- GitHub CI is configured for main pushes and pull requests, not this standalone branch. No PR, merge or production deployment is requested.

Earlier failed checks were obsolete layout selectors and a resize measurement race; they were corrected and the full suite rerun successfully. The initial recording script requested an unsupported 4:5 ratio; its replacement uses the existing 3:4 ratio. No application code change was needed for recording.

## Transfer status

The current Library batch-upload helper failed during hosted tool discovery with a network error, before creating any file. One retry outside the sandbox failed identically. No native Library file ID was produced. These committed artifacts provide an exact retrievable fallback for the parent to download and deliver; local cloud paths are not assumed to exist in another executor.
