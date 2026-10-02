# Dark viewing room implementation

The user selected the **first displayed option from ideation set 3**, with a dark theme. Selection and generation provenance are in [selected-design.json](selected-design.json). The selected target is [dark-viewing-room.png](assets/concepts/selected/dark-viewing-room.png).

The experimental implementation uses the existing Editor, VideoEditor, processing engine, and shared control tree. Modes sit above the contained photo/video; contextual controls sit below it. Export is in the header, with batch actions and Help in More. The filename opens the desktop batch picker. Film cards show real, lazily processed source thumbnails rather than simulated CSS colors. Advanced and Crop retain their owner-bound reversible drafts and the same mounted controls across responsive widths.

The demo still has only its three photos, Films, navigation and own-media upload. Full editor controls appear after uploading user media.

Responsive refinements include a two-row header at constrained widths or enlarged text, mode icons yielding to labels when space is limited, and a compact Advanced surface for landscape/short windows. Thumbnail resource failures recover with the existing Retry film action. Secondary exports restore focus to the visible More trigger.

## Browser evidence

- [Desktop, 1487×1058](assets/implementation/desktop.png)
- [Touch, 393×852](assets/implementation/touch.png)
- [Tablet, 768×852](assets/implementation/tablet.png)
- [Touch Advanced](assets/implementation/touch-advanced.png), [Manual](assets/implementation/touch-manual.png), [Crop](assets/implementation/touch-crop.png), [More](assets/implementation/touch-menu.png)
- [200% text](assets/implementation/touch-200.png), [short landscape Advanced](assets/implementation/landscape-advanced.png)
- [Source and implementation together](assets/implementation/comparison.png), [header comparison](assets/implementation/comparison-header.png), [film dock comparison](assets/implementation/comparison-films.png)

These are actual Playwright Chromium captures from the existing app. They are not a hosted or interactive cloud preview. The Product Design cloud-browser handoff gate remains blocked because its callable browser/Node REPL tool is unavailable in this session; see project-root [design-qa.md](../../../design-qa.md).

## Validation

- Lint, unused-code checks, E2E types, unit-test types and production build passed.
- Unit tests: **179 passed** across 29 files.
- Full Chromium: **174 passed, 3 skipped**, no failures.
- Full mobile Chrome: **62 passed, 6 skipped**, no failures.
- Added five regressions covering real film-thumbnail pixels, lazy processing, no redundant thumbnail repaint on selection/focus, pointer/keyboard comparison, responsive primary/overflow actions and export focus restoration. The LUT error/retry regression now verifies thumbnail recovery too.
- A repeated Chromium run exposed the golden engine test racing demo initialization/StrictMode worker cleanup. Its setup now waits for the ready editor before starting independent CPU/worker/WebGL comparisons; parity assertions are unchanged.
- Independent Astra review found no remaining confirmed P0/P1/P2 code issues after overflow focus and thumbnail scrolling fixes.

Real-device Safari/Firefox/audio checks previously assigned to the user remain pending. No production, main, Sites, GitHub Actions or deployment changes are part of this implementation. Work stays on `codex/ui-experiment-2026-10-02`; commit messages retain `[skip ci]`.
