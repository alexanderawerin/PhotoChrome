# PhotoChrome — bottom-panel refinement

The accepted mobile v2 stays intact. This pass refines the action dock and integrates genuine Iconoteka icons, on the existing `codex/mobile-darkroom-2026-10-25` review branch.

## Actual interface recording

[Play / download the 48-second mobile walkthrough](PhotoChrome-bottom-panel-walkthrough.mp4)

Recorded application source: `58db71659202b73f77ec3af7fd89ba892636696f`. Subsequent commits change test readiness and review files only, not the running application. The production build ran in Chromium 151.0.7922.173, mobile/touch emulation at 393×852 CSS pixels. H.264 MP4, 786×1784, 48.12 seconds, 9,942,808 bytes. Russian chapter captions are below the interface; the first identifies browser emulation. This is a continuous recording of the working UI, with startup trimmed. No slideshow, desktop inserts or simulated exports.

| Final panel state | Screenshot |
| --- | --- |
| Films, labeled modes, selected state, batch actions and Export | [Films](PhotoChrome-panel-films.png) |
| Recipe selection with explicit draft completion | [Recipes](PhotoChrome-panel-recipes.png) |
| Focused Shadow adjustment, Cancel and Apply | [Adjustment](PhotoChrome-panel-adjustment.png) |
| Real 3:4 crop, Cancel and Done | [Crop](PhotoChrome-panel-crop.png) |
| 320×740 with emulated top/side/bottom safe areas | [Safe area](PhotoChrome-panel-safe-area.png) |

## Audit and design rationale

Fresh before captures are included: [Films](before-films.png), [Manual](before-manual.png), [Crop](before-crop.png). The main issue was the repeated mode row above temporary Cancel/Apply actions: disabled destinations added noise, and changing modes could silently discard a draft.

The footer now has two clear states. Browsing retains Films / Advanced / Crop and export actions. An open draft replaces that navigation with Cancel, a quiet current-task label, and Apply/Done. It requires an explicit decision before another mode is chosen, and returns 40 px to the image during editing. Navigation stays mounted so focus returns to the same trigger. Recipes receives focus when Advanced opens. All control labels and the existing draft/geometry/export models remain intact.

The existing neutral palette, contained image, filmstrip, collection and typography are preserved. Selected modes and manual tools share a restrained fill/border treatment, beyond color alone. Primary targets are at least 44 px. Safe-area padding keeps actions clear of emulated device insets.

Visual sources inspected: [Halide Quick Edit](https://mobbin.com/screens/298d9809-7e34-4cb6-9c07-4a0fa712c8ba), for confirmation at thumb corners; [Apple Photos Crop](https://mobbin.com/screens/5bcf365a-c53b-471d-95e5-08dc4d9fa79d), for labeled tool choices and clear selection. These are interaction references, not claims about the latest product versions. Their actual screenshots and the v2 baseline were compared against the rendered result. See [`design-qa.md`](../../../design-qa.md) for the comparison ledger.

## Iconoteka

Read the supplied [official about page](https://iconoteka.com/about.html), [developer documentation](https://iconoteka.com/dev.html), and [official repository](https://github.com/iconoteka/iconoteka). Integrated 25 genuine Regular / Stroke paths from pinned release `02.01.00`. Every path was downloaded from the version-pinned official SVG and compared with the vendored geometry: all matched exactly. No approximations, whole-library dependency, runtime CDN or persistent MCP setup.

- [Per-icon source mapping](../../../src/components/icons/sources.json)
- [Independent geometry verification](icon-verification.json)
- [MIT license shipped with the app](../../../public/licenses/iconoteka.txt)

The Iconoteka identity `check` means a bank cheque; visual review caught this and replaced it with the proper `checkmark` before the final recording. Editor action icons use 20 px; manual tool icons use 24 px. Unrelated utility/dialog icons are outside this focused change.

## Walkthrough health

1. **Import and film selection — passed.** Two photos import; Provia selection is reflected in the actual image.
2. **Recipes and manual adjustment — passed.** Recipe and focused controls update one shared draft.
3. **Cancel — passed.** Exact pre-draft canvas pixels return; mode navigation and trigger focus are restored.
4. **Apply — passed.** The recipe and manual change persist with exact draft pixels.
5. **Crop Cancel — passed.** A rotation is discarded without losing committed color/composition.
6. **Crop Done — passed.** A 3:4 crop commits and remains exportable.
7. **JPEG and batch ZIP exports — passed.** Both downloads succeeded and completion dialogs appeared; subsequent Back to editor returned normally.

The downloaded JPEG decodes at 1200×1600. ZIP integrity passed and both JPEG entries decode: edited Old-town at 1200×1600 and Original Evening-tide at 1600×1066. No application page errors during capture. The MP4 fully decodes with FFmpeg; browser playback advanced, five seeks rendered distinct frames, and no media error occurred. All deliverable screenshots and representative playback frames were visually inspected.

## Verification results

Passed on the final application code:

- Lint, unused-code/dependency checks, application build and E2E/unit TypeScript checks.
- 179 unit tests in 29 files.
- [Full Chromium suite](chromium.log): **199 passed, 4 skipped** (4.4 minutes).
- [Mobile Chrome emulation](mobile-chrome.log): **73 passed, 5 skipped** (1.7 minutes).
- Fresh 393×852, 320×740 and 1440×900 visual inspection, including safe-area emulation. Four new regression cases check 320/393 widths, with/without 34 px bottom inset, actual pixel restoration, repeated Cancel/Apply, crop cancellation and JPEG export.
- Browser playback/seek and full FFmpeg decode of the final recording; successful real JPEG/ZIP output inspection.

**No unresolved failed checks.** Chromium skips are two mobile-only completion cases, demo Crop by product restriction, and the supported-source AAC round-trip when the runtime encoder configuration is unavailable. Mobile skips are five desktop-only completion cases covered in Chromium. Existing accessibility, 200% text, reduced-motion, shared-tree resize, loading/error recovery, photo/video export and media ownership checks passed.

GitHub CI is configured for main pushes and pull requests. This standalone review branch does not trigger that workflow; an absent run is not a green CI result.

Known limitations: the pre-existing large JavaScript chunk warning remains. Physical Android/iPhone/Safari checks were not performed. Firefox and WebKit binaries are unavailable in this environment. Supported-device AAC acceptance remains deferred; optional AAC encoding is skipped when this browser reports that configuration unsupported. Browser emulation does not establish physical-device compatibility.

Earlier runs exposed stale tests that still clicked now-hidden mode controls, plus a new test that sampled Original before Provia finished rendering. The test paths and readiness condition were corrected; no application defect was hidden by weakening the expected pixel-restoration result.

## Delivery and branch safety

The current Library batch helper failed before preparation or upload with:

`library upload failed: hosted apps tools/list request failed: network`

No Library file was created and no `library_file_id` exists for these new artifacts. The downloadable branch files are the authorized fallback for parent delivery. No repository visibility, credentials, access configuration, main branch, PR, merge or production deployment was changed. Earlier v2 artifacts are preserved in their original review directory. `sha256.json` records exact file sizes and hashes.
