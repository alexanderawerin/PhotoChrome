# Dark viewing room implementation

The user selected the **first displayed option from ideation set 3**, with a dark theme. Selection and generation provenance are in [selected-design.json](selected-design.json). The selected target is [dark-viewing-room.png](assets/concepts/selected/dark-viewing-room.png).

The experimental implementation uses the existing Editor, VideoEditor, processing engine, and shared control tree. The header contains Films / Crop / Advanced and Export. A single secondary action appears directly; batch actions use More. Desktop photo navigation sits beside the preview; touch navigation uses swipes. Filename and image-count chrome are removed. Applied color appears inside the actual photo/video at the top-left, and processing status overlays the preview without changing its dimensions.

Films and Recipes use the same FilmOption and FilmThumbnail, including real, lazily processed source thumbnails, selection markers and captions. Their desktop docks fit their content; film arrows appear only when scrolling is needed. Favorites and the obsolete RecipeCard, ThumbnailStrip and favorites hook are removed. Advanced has a two-line film/recipe title, Recipes / Manual on the left and compact Cancel / Apply on the right. Manual uses a container-based grid on desktop. Crop opens in one click, has top-row actions and a desktop width capped at 640 px. Desktop Original has a compact visible pill and matching hit area; touch controls retain 44 px targets, including on wide touch screens.

Advanced and Crop retain their owner-bound reversible drafts and the same mounted controls across responsive widths.

The demo still has only its three photos, Films, navigation and own-media upload. Full editor controls appear after uploading user media.

Responsive refinements include a two-row header at constrained widths or enlarged text, mode icons yielding to labels when space is limited, and a compact Advanced surface for landscape/short windows. Thumbnail resource failures recover with the existing Retry film action. Secondary exports restore focus to the visible More trigger.

## Initial browser evidence (historical)

- [Desktop, 1487×1058](assets/implementation/desktop.png)
- [Touch, 393×852](assets/implementation/touch.png)
- [Tablet, 768×852](assets/implementation/tablet.png)
- [Touch Advanced](assets/implementation/touch-advanced.png), [Manual](assets/implementation/touch-manual.png), [Crop](assets/implementation/touch-crop.png), [More](assets/implementation/touch-menu.png)
- [200% text](assets/implementation/touch-200.png), [short landscape Advanced](assets/implementation/landscape-advanced.png)
- [Source and implementation together](assets/implementation/comparison.png), [header comparison](assets/implementation/comparison-header.png), [film dock comparison](assets/implementation/comparison-films.png)

These actual Playwright Chromium captures document the initial implementation, before the subsequent desktop review rounds. The current code is authoritative. The initial Product Design cloud-browser handoff gate was blocked by unavailable tools; that historical gate report remains in project-root [design-qa.md](../../../design-qa.md).

The current manual review build is available on the separate owner-private [Sites review](https://photochrome-dark-ui-trial-20261002.alexanderawerin1976.chatgpt.site). It matches UI source commit `19dae6f8b948d1c8b01f8a2a4bcce3dcb9649c25`. Later reference-research and documentation commits do not change that application code.

## Validation

- Lint, unused-code checks, E2E types, unit-test types and production build passed.
- Unit tests: **179 passed** across 29 files.
- Full Chromium: **189 passed, 4 skipped**, no failures.
- Full mobile Chrome: **63 passed, 5 skipped**, no failures.
- Local visual QA used Playwright Chromium at 1106, 1440, 393 and 320 px, plus photo/video processing overlays. The Browser plugin was unavailable. No application page errors appeared; video captures produced only Chromium WebGL ReadPixels performance warnings.
- Regressions cover real film-thumbnail pixels, lazy processing, no redundant thumbnail repaint, pointer/keyboard comparison, responsive actions, export focus restoration, shared Films/Recipes dimensions, content-fit docks, Crop geometry and top actions, in-photo metadata, and 44 px controls on wide touch screens.
- A repeated Chromium run exposed the golden engine test racing demo initialization/StrictMode worker cleanup. Its setup now waits for the ready editor before starting independent CPU/worker/WebGL comparisons; parity assertions are unchanged.
- Independent Astra review found no remaining confirmed P0/P1/P2 code issues after overflow focus and thumbnail scrolling fixes.

## Continue locally

Check out the draft PR or branch `codex/ui-experiment-2026-10-02`, run `npm ci`, then `npm run dev`. The entry screen is the functional three-photo demo; upload your own photos or video to exercise Advanced, Crop and export.

Relevant implementation files are `src/components/EditorChrome.tsx`, `FilmOption.tsx`, `FilmThumbnail.tsx`, `AdvancedPanel.tsx`, `TuningPanel.tsx`, `Editor.tsx`, `VideoEditor.tsx`, `Preview.tsx`, `VideoPreview.tsx`, and `src/index.css`. Repository `AGENTS.md` describes UI and test requirements.

Further UI refinement and user-owned real-device Safari/Firefox/audio acceptance remain pending. The Sites review is separate from the primary production app. The PR remains a draft for local continuation; commit messages retain `[skip ci]`. CI workflows contain quality/browser checks rather than deployment, and the primary main branch is not modified by publishing this feature branch.
