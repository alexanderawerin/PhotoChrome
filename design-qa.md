# Dark viewing room — design QA

> Historical report for the initial image-to-code iteration. Its screenshots, counts and formal Product Design gate status describe that iteration. The current desktop review build, behavior and validation are recorded in [implementation.md](docs/design-experiments/2026-10-02/implementation.md); current application code is authoritative. This report does not claim that the previously unavailable Product Design cloud-browser gate was subsequently passed.

## Gate status

**final result: blocked**

The remaining blocker is the Product Design **interactive cloud browser** handoff requirement, not an unresolved browser-test failure. The session exposes no callable cloud Browser/Node REPL `js` tool, and no `sites-preview` runtime. Tool discovery and the installed Browser skill setup instructions were inspected. Playwright Chromium is available and was used for the actual app screenshots and interactions below; these do not provide an interactive cloud preview for the user.

The exact controlling instruction is in `skill://Plugin_fa77aec24fc08191bc6e57f377126d76/image-to-code/SKILL.md`: “If the cloud browser cannot be used, report verification as blocked.” The implementation is saved as experimental work, not handed off as a Product Design prototype that passed this gate. No Sites/production deployment was requested for this selection or performed.

## Comparison target and evidence

- User selection: **first displayed image from ideation set 3, in a dark theme**. Provenance: [selected-design.json](docs/design-experiments/2026-10-02/selected-design.json).
- Source visual truth: [dark-viewing-room.png](docs/design-experiments/2026-10-02/assets/concepts/selected/dark-viewing-room.png).
- Rendered implementation: [desktop.png](docs/design-experiments/2026-10-02/assets/implementation/desktop.png).
- Both source and implementation are **1487×1058 pixels**. Implementation CSS viewport **1487×1058**, `deviceScaleFactor: 1`; no downsampling or device frame was used for comparison.
- State: own-media full photo editor, `Coast.jpg`, first of three photos, Provia applied, Films active, dark theme. The imported media are the actual existing coast and two other photo assets. The initial demo state is a separate, deliberately restricted product state.
- Full view together, source left and implementation right: [comparison.png](docs/design-experiments/2026-10-02/assets/implementation/comparison.png), **2974×1058**.
- Focused comparisons: [header](docs/design-experiments/2026-10-02/assets/implementation/comparison-header.png), **2974×184**, and [film dock](docs/design-experiments/2026-10-02/assets/implementation/comparison-films.png), **2774×144**. Both were opened along with the combined full view; separate image views were not treated as a side-by-side comparison.
- Additional real browser captures: [touch](docs/design-experiments/2026-10-02/assets/implementation/touch.png), [Advanced](docs/design-experiments/2026-10-02/assets/implementation/touch-advanced.png), [Manual](docs/design-experiments/2026-10-02/assets/implementation/touch-manual.png), [Crop](docs/design-experiments/2026-10-02/assets/implementation/touch-crop.png), [More](docs/design-experiments/2026-10-02/assets/implementation/touch-menu.png), [tablet](docs/design-experiments/2026-10-02/assets/implementation/tablet.png), [200% text](docs/design-experiments/2026-10-02/assets/implementation/touch-200.png), [short landscape](docs/design-experiments/2026-10-02/assets/implementation/landscape-advanced.png).

## Findings and comparison history

1. **P2, resolved — header status and reset action competed with the primary composition.** In [first comparison](docs/design-experiments/2026-10-02/assets/implementation/compare-first.png), the base-film status/reset row pushed modes and image downward. The base-film status remains accessible but occupies no space while quiet. Restore base film appears for detailed recipes or modified settings. The widened mode capsule and adjusted vertical spacing are visible in [second comparison](docs/design-experiments/2026-10-02/assets/implementation/compare-second.png) and the final comparison.
2. **P2, resolved — mobile More panel left the viewport.** The panel was anchored to the More circle rather than the whole header action group. It now anchors to the group; [touch More](docs/design-experiments/2026-10-02/assets/implementation/touch-menu.png) and the 320/393px layout tests show contained actions at ordinary and enlarged text sizes.
3. **P2, resolved — Advanced content collapsed in a short window.** The heading/restore controls now share a row, tab padding is smaller, and short-screen spacing is reduced. At 852×393 the fitted photo measures approximately **110×83** with an independently scrollable recipe region. [Short landscape](docs/design-experiments/2026-10-02/assets/implementation/landscape-advanced.png) and the 1200×480 lazy-recipe regression confirm usable preview/recipe content.
4. **P2, resolved — 200% text made mode icons squeeze labels and shrink the preview.** [Earlier enlarged text](docs/design-experiments/2026-10-02/assets/implementation/touch-200-first.png) showed the excessive mode height. Container queries now yield decorative icons to text and reserve a wider middle mode. At enlarged text the redundant Advanced heading also yields space to the current film and Restore control. The final [200% capture](docs/design-experiments/2026-10-02/assets/implementation/touch-200.png) verifies that text, preview, and Apply/Cancel remain visible; Manual content scrolls independently.
5. **P2, resolved — constrained desktop header compressed Add photos.** A 768px inspection found Add label crowding. The header now wraps filename navigation onto a second row at constrained width or enlarged type; Add retains its label for assistive technology and uses its icon in the compact layout. [Tablet](docs/design-experiments/2026-10-02/assets/implementation/tablet.png) verifies the correction.
6. **P2, resolved — secondary export focus could return into a closed popup.** More now focuses its visible summary before invoking actions. A regression tests current/batch secondary exports at desktop and touch widths and verifies focus restoration after completion.

The final ordinary-size full view and focused header/dock comparison show no remaining actionable P0/P1/P2 visual mismatches within the product constraints below. The formal gate remains blocked by the cloud-browser requirement.

## Required fidelity surfaces

- **Fonts and typography:** existing system sans stack is the closest match to the mock's compact sans UI. Brand uses 600 weight and restrained negative tracking; labels use medium weight, muted secondary text, and rem sizes that respond to 200% text. Font rasterization varies by platform; no remote font dependency was introduced. Large text remains readable without overlapping the Restore action.
- **Spacing and layout rhythm:** centered modes above a contained image, rounded film dock below, header Export, and Original anchored to the actual image corner match the selected composition. One shared DOM is retained across widths. Advanced/Crop replace the bottom context rather than introducing a permanent right inspector. Short/landscape and enlarged-text captures were reviewed in addition to 393/768/1487px screens.
- **Colors and tokens:** neutral graphite `#17191d`, restrained charcoal surfaces, off-white primary action/selection, subtle white borders, and muted gray labels. Film selection uses a light outline and dot. Loading indicators now inherit monochrome foreground rather than random recipe-card colors. Existing error colors remain semantic.
- **Image quality and asset fidelity:** the existing coast photograph and actual processing engine remain authoritative. Real film thumbnails are resized before processing, displayed as raster canvases, cached with a bounded cache and generated only when visible. Existing Lucide outline icons match the visual family. No placeholder photos, CSS film filters, fake colors, custom SVG drawings, or generated replacement source photos were used.
- **Copy and content:** film names, file name/count, Films/Advanced/Crop, Original and Export are preserved. “Add photos” accurately describes the existing photo editor input; the initial demo upload can also accept video. Export all and Apply to all retain existing batch behavior through More, with Export all primary on touch.

## Expected product/source differences

- The generated mock expands/repaints the coast and depicts a wider image ratio. The implementation contains the **real 4150×2766 photo**, preserving its natural ratio and actual Provia output; it does not distort the user photo or modify the engine to reproduce generated pixels. Consequently the main photo is narrower and the thumbnail colors differ from ImageGen's approximations.
- Original comparison is disabled while no film is applied or processing owns the preview. Film-scroll arrows reflect actual scroll availability rather than being permanently enabled like the mock.
- The demo intentionally exposes Films/upload only; the screenshot comparison uses the own-media full editor. There is no duplicated hidden desktop/touch editor tree.

## Functional and console evidence

Tested upload/demo progression, image navigation/batch preservation, film selection and real thumbnails, pointer/keyboard comparison, More/Escape/outside click, reversible Advanced/Crop drafts, responsive DOM/focus preservation, recipe visibility, export/error/retry/completion/focus, and video geometry/audio capability paths.

Validation: lint, unused-code checks, E2E/unit test types, build, **179 unit tests**, full Chromium **174 passed / 3 skipped**, mobile Chrome **62 passed / 6 skipped**. Optional media/browser cases are explicitly skipped based on capability. Independent Astra code review found no remaining confirmed P0/P1/P2 issues.

A repeated full run exposed a golden-test setup race with demo initialization: Editor StrictMode cleanup disposed a worker while the independent engine assertion was already running. The test now waits for the ready editor before starting its CPU/worker/WebGL work. The processing implementation and parity assertions are unchanged; subsequent golden and full-suite results are used for the final validation.

The capture sessions produced **no application page errors**. The sole console resource error was the existing external Yandex Metrika script blocked by the environment network (`ERR_TUNNEL_CONNECTION_FAILED`); no editor resource/rendering error appeared. Raw evidence is in [browser-evidence.json](docs/design-experiments/2026-10-02/assets/implementation/browser-evidence.json).

## Implementation checklist and follow-up

- [x] Selected dark target recorded and source/implementation compared in combined inputs.
- [x] Shared implementation and affected tests updated; functional/browser suites passed.
- [x] Actual desktop/touch/Advanced/Crop/large-text/short-window captures saved.
- [ ] Product Design interactive cloud-browser verification, blocked by unavailable tool.
- [ ] User-owned real-device Safari/Firefox/audio acceptance checks from the earlier work.

P3 follow-up: inspect platform-specific font rendering and personal preference for dock thumbnail density when an interactive preview is available. No further polish loop or deployment is implied.

**final result: blocked**
