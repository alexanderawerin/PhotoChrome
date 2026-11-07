# Photochrome: film-first editor

> Historical specification agreed on 2026-10-01. The core film-first implementation is now in main. Current implementation evidence, remaining acceptance gates, and performance results are maintained in [ROADMAP.md](ROADMAP.md), [film-first-acceptance.md](film-first-acceptance.md), and [film-first-performance.md](film-first-performance.md). Future-tense and baseline statements below describe the original agreement, not the current implementation status.

Date: 2026-10-01. Status: agreed specification, ready for implementation. Product decisions and the testing approach were confirmed by the user. This document describes the target behavior; implementation and runtime acceptance are pending.

Tracking issue: [PhotoChrome #4](https://github.com/alexanderawerin/PhotoChrome/issues/4), labeled ready-for-agent.

Implementation tickets: [published task index](./film-first-editor-tasks-2026-10-01.md). The full issue bodies, native parent links, and blocking dependencies are available in GitHub.

## Problem Statement

Photochrome exposes 100 recipes, recommendation groups, random choices, and many settings before a user has made the simple decision they came for: which film character suits their photo or video. A film is currently a group of recipes rather than an independently selectable base result. Users must understand recipe variations before they can complete a basic edit.

The photo and video editors also have different editing rules. Video lacks crop, rotation, and reflection. Existing audit scenarios exposed export before a required LUT was ready, shortcuts bypassing demo and modal restrictions, and inconsistent CPU/worker/WebGL processing. Passing the existing suite did not cover these failures.

## Solution

The main workflow is: add a photo or video → choose Original or one of ten base films → optionally adjust geometry → export. New media starts as Original. Mobile and desktop, photo and video use the same product rules with layouts suited to their screens.

Detailed recipes and manual color controls move to a separate Advanced settings panel for the selected film. All 100 existing recipes remain available there. Recipes and Manual share one temporary preview with Apply and Cancel. The main editor makes the applied film, recipe, and manual changes visible.

Random, Randomize settings, Smart Picks, and Editor's Choice are removed. Favorite recipes remain available within their film. Crop, rotation, and horizontal reflection are supported for both photos and video in this delivery. Processing stays local to the user's browser.

## User Stories

1. As a new user, I want to start with a functional three-photo demo, so that I can try film rendering before selecting my own files.
2. As a demo user, I want to switch between the three demo photos and try base films, so that I can compare their character on different subjects.
3. As a demo user, I want to compare the current result with Original, so that I can understand the film's effect.
4. As a demo user, I want adding my own photo or video to open the full editor, so that I can continue the same workflow with my media.
5. As a demo user, I want editing and export restrictions to apply to shortcuts as well as buttons, so that demo behavior is consistent.
6. As a photo or video user, I want newly loaded media to appear as Original, so that no color treatment is applied without my choice.
7. As a photo or video user, I want one main choice per base film, so that I can choose among ten film characters without browsing recipe variations.
8. As a photo or video user, I want a base film to have a repeatable result, so that network timing and random settings do not change its appearance.
9. As a photo or video user, I want to select Original after choosing a film, so that I can remove color treatment without losing geometry.
10. As a photo or video user, I want the main editor to focus on film, geometry, comparison, and export, so that detailed color controls do not compete with basic actions.
11. As a photo or video user, I want to open Advanced settings for the selected film, so that detailed editing remains available when I need it.
12. As an advanced user, I want all existing recipes for that film to remain available, so that simplification does not remove the looks I use.
13. As an advanced user, I want favorite recipes to appear first within their film, so that I can find them quickly without mixing films.
14. As a returning user, I want existing favorite recipe identities to remain valid, so that the redesign preserves my saved choices.
15. As a photo and video user, I want favorites to use the same saved collection, so that a favorite is available in either editor.
16. As an advanced user, I want Recipes and Manual to be separate tabs sharing one draft, so that I can choose a recipe and then adjust it without losing work between tabs.
17. As an advanced user, I want to tune the base film without first selecting a detailed recipe, so that a recipe is optional.
18. As an advanced user, I want all existing manual parameters and ranges, so that moving them out of the main editor does not reduce editing control.
19. As an advanced user, I want white-balance presets and Kelvin temperature to have coherent mutually exclusive behavior, so that conflicting settings do not silently override each other.
20. As an advanced user, I want opening Advanced settings to preserve the current result, so that opening a panel is not itself an edit.
21. As an advanced user, I want recipe and manual changes to appear in a temporary live preview, so that I can evaluate them before applying.
22. As an advanced user, I want Apply to save the complete draft, so that the chosen recipe and manual changes become my committed result together.
23. As an advanced user, I want Cancel to restore the previously applied result, so that experimentation is reversible.
24. As an advanced user, I want closing the panel or pressing Escape without Apply to cancel the draft, so that unconfirmed changes never persist silently.
25. As a multi-photo user, I want changing media or film to discard an unfinished draft, so that it cannot leak into a different editing context.
26. As an advanced user, I want selecting a different recipe to replace the previous color settings and clear manual overrides, so that recipes have a predictable starting point.
27. As a photo or video user, I want changing film to begin from its base result, so that a previous film's recipe and manual settings are not carried over.
28. As a photo or video user, I want film changes to preserve geometry, so that choosing a color treatment does not undo my composition.
29. As a photo or video user, I want returning to a previously used film to select its base result, so that hidden per-film settings do not unexpectedly reappear.
30. As a photo or video user, I want the main editor to show the applied film and recipe, so that I know which look produced the image.
31. As a photo or video user, I want a Modified marker when effective manual settings differ from the active profile, so that custom color changes remain visible after closing Advanced settings.
32. As an advanced user, I want resetting a parameter to restore its recipe or base-film value, so that Reset has a meaningful reference.
33. As a photo or video user, I want Restore base film to remove recipe and manual color changes while preserving geometry, so that I can return to the film's standard look.
34. As a photo user, I want crop, fixed and free aspect ratios, quarter-turn rotation, fine-angle adjustment, and horizontal reflection, so that existing composition tools remain available.
35. As a video user, I want the same geometry operations, so that I can compose a clip without leaving Photochrome.
36. As a photo or video user, I want geometry editing to use reversible preview and commit behavior, so that I can cancel a composition experiment.
37. As a photo or video user, I want comparison to retain current geometry, so that I can assess color without the frame changing shape or position.
38. As a video user, I want comparison to use the same source frame and playback position, so that motion does not confound the color comparison.
39. As a multi-photo user, I want each photo to retain its own applied color and geometry state, so that switching photos restores the correct edit.
40. As a multi-photo user, I want Apply to all to copy the current film, recipe, and effective color settings while preserving each photo's geometry, so that a shared look does not overwrite individual compositions.
41. As a photo or video user, I want export to work for Original and geometry-only edits, so that a film is optional for saving my composition.
42. As a photo user, I want a JPEG of the applied visible result, so that the saved file represents my edit.
43. As a multi-photo user, I want Export all to include every loaded photo in a ZIP, including photos without color changes, so that its name matches its scope.
44. As a multi-photo user, I want a clear report of successful and failed files, so that partial export does not appear to be complete success.
45. As a multi-photo user, I want a zero-success export to report failure without an empty success download, so that I know nothing was saved.
46. As a video user, I want an MP4 of the applied color and geometry state, so that the exported clip matches the edit I approved.
47. As a video user, I want geometry and color editing to preserve timing, duration, and playback rate, so that editing the image does not retime the clip.
48. As a video user, I want source audio preserved when the browser can export it, so that processing does not silently remove sound.
49. As a video user, I want an explicit Export without sound choice when source audio cannot be preserved, so that silent output requires my informed choice.
50. As a video user, I want unsupported export capabilities to produce an actionable error, so that I do not receive a corrupt or mislabeled file.
51. As an exporting user, I want cancellation to prevent a late or partial download, so that Cancel remains effective until file delivery.
52. As an exporting user, I want Retry to repeat the failed export reliably, so that recovery does not switch to another media item or export mode.
53. As an exporting user, I want completion previews and counts to describe the actual saved files, so that feedback agrees with the download.
54. As a user loading media, I want failed replacement or batch addition to preserve the previous working session, so that an import failure does not destroy my edit.
55. As a user loading media, I want Retry to use my original request and stale operations to be ignored, so that late results cannot replace newer media.
56. As a keyboard user, I want demo, loading, editing, Help, and export restrictions to apply consistently, so that shortcuts cannot bypass the interface's rules.
57. As a keyboard or assistive-technology user, I want named controls, correct focus behavior, and inactive panels removed from navigation, so that I can operate the editor without a pointer.
58. As a mobile user, I want usable controls and readable layouts on narrow screens and with enlarged text, so that editing remains practical without horizontal overflow.
59. As a desktop user, I want the same film choices, draft semantics, and export outcomes as mobile, so that changing viewport does not change product rules.
60. As a user waiting for processing, I want clear readiness and error feedback, so that a required LUT failure cannot be mistaken for a successfully applied film.
61. As a user viewing the result, I want preview and export to use consistent color processing and orientation, so that saving does not unexpectedly change the image.
62. As a user with transparent input, I want processing to preserve alpha until the selected output format's normal flattening step, so that sharpening does not introduce opaque pixels internally.

## Implementation Decisions

### Product scope and catalog

- Deliver the new model for photo and single-video editing on mobile and desktop. Video geometry is part of this delivery, not a deferred feature. Internal implementation slices may be sequential; a photo-only or mobile-only result does not complete the specification.
- Keep ten base simulations and all 100 recipe records with their existing identities and metadata. Original is a separate color state, not an eleventh film.

| Base film | Existing recipes retained |
| --- | ---: |
| Provia | 8 |
| Velvia | 12 |
| Astia | 8 |
| Pro 400H | 8 |
| Superia | 8 |
| Acros | 10 |
| Neopan | 8 |
| Eterna | 9 |
| Classic Chrome | 15 |
| Classic Neg | 14 |
| Total | 100 |

- A base film is its existing LUT or curve simulation with neutral additional parameters, not a selected flagship recipe. Provia, Velvia, Astia, Pro 400H, Superia, Acros, Neopan, and Classic Chrome require their shipped LUTs. Eterna and Classic Neg intentionally use the existing curve approximation.
- Normalize neutral settings consistently: numeric color/tone/sharpness/clarity/WB-shift additions are zero; dynamic range is DR100; grain, Color Chrome, and Color FX Blue are off; grain size is small; white balance is Auto; Kelvin temperature is absent. The existing 5500 K UI fallback is not a forced base-film temperature.
- Remove both Random mechanisms, Smart Picks, Editor's Choice, and their unused processing or UI paths. Remove obsolete grouping branches when no consumer remains. Keep full recipe metadata and valid favorite IDs.
- Main controls cover Original/film selection, geometry, comparison, export, and entry to Advanced settings. Existing Add, Help, photo switching, and video playback remain available in their appropriate contexts.
- Demo keeps three photos, film selection, comparison, and Add. Geometry, Advanced settings, batch application, and export require user media; the same restriction applies to shortcuts.

### Applied state, drafts, and transitions

- Extend the existing media-owned editing model instead of introducing a parallel editor state store. Represent Original, base film, or a recipe with manual overrides, plus independently owned geometry. Maintain one source of truth; avoid independent film/recipe/settings copies that can disagree.
- Keep base-film selection distinct from detailed recipe selection in the domain and UI. Processing may adapt a base profile to the existing plan contract where that is the smallest implementation. Original has an explicit color pass-through path and does not require a fake LUT.
- Each photo retains its committed state. Video has one committed state for the currently loaded clip. Per-film histories and automatic recovery of prior color settings are excluded.
- Recipes and Manual share one owner-bound temporary color draft containing the selected profile and manual overrides. Ownership includes the current media and committed editing context. Selecting a recipe inside this draft changes the draft, not the underlying committed owner.
- Opening Advanced settings copies the applied state without changing it. Both tabs preserve the same draft. Apply commits the selected profile and settings together; Cancel writes no color changes.
- Dismissal, Escape, or changing the external media/film context discards an unapplied draft without a confirmation dialog. Late preview or processing results from the old context are rejected. Help or another modal must not enable background editing commands.
- The photo session behavior is the basis for video transactions. Video must not retain an old settings snapshot after switching profile and then use Cancel to inject that snapshot into a different profile.

| Action | Color/profile outcome | Geometry outcome |
| --- | --- | --- |
| Load new user media | Original; no manual overrides | Default geometry |
| Select a different base film | New film's neutral base; recipe and overrides cleared | Preserved |
| Select Original | Color pass-through; recipe and overrides cleared | Preserved |
| Select recipe in Advanced settings | Draft selects that recipe; draft overrides cleared | Preserved |
| Change manual parameter | Current draft profile remains; parameter changes | Preserved |
| Reset manual parameter | Active draft recipe or base-film value restored | Preserved |
| Apply Advanced settings | Entire draft color state committed | Preserved |
| Cancel or dismiss Advanced settings | Previously committed color state restored | Preserved |
| Restore base film | Current film's neutral base; recipe and overrides cleared | Preserved |
| Apply to all photos | Applied profile and effective color settings copied to every photo | Each photo's geometry preserved |

- Advanced settings requires a selected film. Manual tuning of a base film is supported without a detailed recipe. Choosing Original intentionally clears color tuning.
- Show the applied film and detailed recipe name when applicable. Modified denotes effective manual differences from the active recipe/base profile, not crop or rotation. Returning every parameter to its reference value clears this marker.
- Favorites remain recipe IDs in the existing shared local collection for photo and video. Only favorites belonging to the selected film appear in that film's Recipes tab; favorite recipes precede its other recipes without duplication. Favoriting is collection metadata and is independent of committing a color draft.
- Retain all existing manual controls and ranges: Highlight/Shadow −2…4; Color/Sharpness −4…4; Clarity −5…5; WB Shift Red/Blue −9…9; Grain Effect and Grain Size; Color Chrome and Color FX Blue; DR100/200/400; existing white-balance presets; Temperature 2500…10000 K. Kelvin and white-balance preset selection remain mutually exclusive.

### Geometry and comparison

- Reuse the existing non-destructive geometry semantics: free/fixed crop, aspect ratio, crop positioning/zoom, quarter turns, fine angle, and horizontal reflection. Geometry remains a separate temporary session with Apply/Cancel behavior where editing is contextual.
- Add that geometry state to video preview and export. Apply the same transform to each frame; preserve source timing, frame rate, and audio synchronization. Export dimensions and orientation follow the transformed frame rather than the original dimensions.
- Keep transform ordering consistent across preview and export. Adapt output dimensions to actual codec requirements without stretching the image or silently dropping requested geometry. Unsupported output configurations report an error.
- Comparison disables color treatment while keeping current geometry. Video comparison uses the same frame/playback position and leaves committed state unchanged. Release comparison on pointer/key release, context change, loading, and modal entry.

### Processing, commands, and export

- Extend the existing ProcessingPlan preparation boundary to await every required resource for preview and single, batch, and video export. Missing required LUTs block a successful result and expose Retry; intentionally curve-based simulations remain valid without a LUT.
- Preserve a ready processing snapshot for the selected profile, effective parameters, geometry, and output size. Stale resource completion cannot apply to a newer selection. A loading or failed film must not be presented or exported as a successfully applied fallback look.
- Share the CPU processing implementation between direct and worker execution; align WebGL effect order, ranges, orientation, and alpha handling with that contract. Avoid a new processing engine or stack replacement.
- Use one small command-availability policy for buttons and shortcuts across demo, loading, active editing sessions, modal dialogs, and export. Export and Apply to all require a resolved applied editing state; they must not silently commit a draft or save a different state from the visible approved result.
- Single export supports Original, geometry-only, base-film, recipe, and manually modified states. JPEG is the photo output; ZIP contains JPEGs; MP4 is the video output. Original means no color treatment, not a promise of byte-identical source-file copying. Existing export settings and JPEG metadata behavior remain in effect.
- Export all considers every loaded photo regardless of selected film or whether it was changed. The old rule that skipped photos without a recipe is intentionally removed. Invalid or failed outputs are reported; partial success is distinguished from full success, and zero success produces no successful archive download.
- Apply to all is a photo-batch action only. It transfers applied color/profile state, including Original, while preserving each photo's geometry. It does not copy an unfinished draft or create video-batch functionality.
- Snapshot the applied state at export start. Completion counts and previews derive from actual saved files. Keep existing cancellation, Retry, download-error recovery, and cleanup guarantees, including cancellation immediately before delivery.
- If the source video contains audio and the browser can preserve it, include it. If preservation is unavailable, require an explicit Export without sound choice before generating silent output. Dismissing that choice leaves the edit available. An already silent source does not need this choice. Optional AAC support is determined by the actual encoder configuration and export path, not by browser name alone.
- Unsupported MP4 export is an actionable failure rather than an implicit format change. Keep the existing 30-second video limit and supported input formats. Keep current photo limits until the separate memory work has measured and justified a change.
- Preserve MediaSession's atomic loading, exact-request Retry, operation identity, cancellation, and resource ownership. Reject stale decode results and release video URLs, frames, canvas/encoder resources, and worker resources on every completion/error/cancellation path.

## Testing Decisions

- The user confirmed one primary acceptance boundary: existing editor E2E workflows and the actual downloaded JPEG/ZIP/MP4 files. Retain targeted regressions at the existing processing boundary for resource readiness and CPU/worker/WebGL output. Introduce no test-only public editor API.
- Good tests assert observable state transitions, available commands, visible preview, emitted files, reported failures, and cleanup outcomes. Avoid assertions about component decomposition, DOM position, removed snapshots, or the chosen internal state representation.
- Reuse existing media-upload fixtures and editor helpers. Scope semantic locators uniquely, audit shared helpers and repository-wide selectors after layout changes, and account for multiple responsive instances without positional selection.
- Extend existing tuning and multi-image scenarios to cover an optional base profile, recipe selection inside a shared draft, Manual/Recipes tab changes, Apply/Cancel, dismissal, film/media switching, per-parameter reset, base reset, and restoration of the previously applied profile. Cover the equivalent video flow.
- Replace recommendation/Random/Editor's Choice scenarios with the ten-film main selection and film-scoped advanced catalog. Assert that all 100 recipe identities remain accessible, favorite IDs survive, and removed controls/workers no longer participate in the editor.
- Extend existing transform/crop scenarios using asymmetric fixtures so reflection, rotation, and crop mistakes are observable. Test combined geometry plus color; video output frame geometry and dimensions must match preview while duration, packet timing, and audio stay correct.
- Extend existing photo export, batch export, and completion scenarios to include Original, geometry-only, base film, recipe, and manual overrides. Decode saved JPEGs, enumerate actual ZIP members, and inspect MP4 tracks/frames rather than treating a download event as proof of correctness.
- Delay a real required LUT request, then fail it and retry. Single, batch, and video export must wait or fail explicitly, never download a substitute look. Cover stale LUT completion after a film/media change and legitimate curve-based films.
- Extend existing keyboard and accessibility scenarios for demo, Help, loading, active drafts, export, and completion. Confirm unavailable actions cannot execute through shortcuts; comparison and focus recover when context changes.
- Expand the existing processing golden checks to include real LUTs, sharpness, clarity, tone, saturation, white balance, effect combinations, edge settings, asymmetric geometry, and varying alpha. Alpha must be preserved exactly before format flattening. CPU and worker must match for deterministic inputs. Retain existing GPU tolerances as the starting regression bounds, report RGB deltas, and do not relax them to accommodate an incorrect effect order.
- Use Grain Off for exact deterministic output comparisons and validate grain separately without requiring identical random pixels across different preview/export sizes. A transparent processing fixture tests engine alpha; JPEG's expected opacity is a separate output-format contract.
- Extend the existing video fixture with supported/unsupported audio-encoder configurations, source clips with and without audio, the explicit silent-export choice, partial initialization failure, cancellation, and Retry. Require AAC only when that configuration is supported, and validate the retained audio signal/timing when audio is exported.
- Preserve existing loading/recovery tests for failed replacement, failed batch append, exact-request Retry, stale operations, and cleanup. Preserve existing late-cancellation and zero-success export coverage while updating the changed batch eligibility rule.
- Verify mobile at 320 and 393 CSS pixels and desktop at 1200 and 1600 CSS pixels, with 200% text, reduced motion, keyboard/focus use, and accessibility checks. Browser execution requires authorization under the project's working agreements; any unperformed check remains pending.
- Before a UI push or release handoff, run lint, unused-code/dependency checks, unit/E2E type checks, unit tests, production build, and the full CI-equivalent Chromium suite. Narrow affected E2E suites are required during each implementation slice. Firefox, Safari, and real mobile-device behavior require separate actual evidence, especially video geometry, audio, cancellation, and export compatibility.
- Performance and memory measurements form a later workstream. A passing build, static screenshot, or existing test count is not evidence for new runtime performance or physical-device acceptance.

## Out of Scope

- New films or recipe reduction/curation. The agreed first catalog is ten base films plus all 100 existing recipes in Advanced settings.
- Random selection/settings, Smart Picks, Editor's Choice, use-case grouping, and favorite base-film categories.
- Video batch editing/export, trimming, timeline editing, retiming, longer clips, or new output formats.
- Persisted per-film edit histories, a new undo/redo system, accounts, cloud sync, or server-side media processing.
- A new frontend stack, a replacement processing engine, unrelated abstractions/dependencies, or a broad rewrite of the loading/session foundations.
- A full preview scheduler, lazy original decoding, or a redesigned memory budget as prerequisites for the first complete film-first delivery. These remain explicit later stages; removing obsolete recommendation work and avoiding processing inactive panels belong to the feature cleanup.
- Implementing this feature as part of writing the specification. The issue describes work to perform and checks to execute.

## Further Notes

### Delivery sequence and acceptance

| Stage | Result required before moving on |
| --- | --- |
| 1. Processing and command correctness | LUT readiness/errors/Retry, command restrictions, alpha, and processing parity regressions are covered at existing boundaries. Preserve the cleanup already merged in PR #3. |
| 2. Shared film/profile model | Original and all ten neutral base films work consistently with existing media ownership, processing snapshots, and geometry. |
| 3. Main and Advanced editors | Photo and video, mobile and desktop expose the agreed main controls; all recipes/manual parameters, favorites, drafts, markers, resets, and context changes obey this specification. |
| 4. Video geometry and complete export | Photo and video preview/export include geometry; JPEG/ZIP/MP4 support Original and geometry-only output; photo batches include every loaded photo; audio fallback requires explicit user choice. |
| 5. Cleanup and release acceptance | Removed features and their unused code/test assumptions are deleted; README, Help, roadmap, and affected metadata reflect the new primary workflow while retaining the advanced recipe count. Required automated, browser, and device checks are reported with evidence. |
| 6. Preview and memory optimization | Measure interaction time, long tasks, processed buffer sizes, and realistic batches; then prioritize current preview, coalesce changes, right-size thumbnails, and introduce a measured memory budget or on-demand original decoding where needed. |

Stages 2–4 may overlap in implementation, but final feature acceptance requires both media types and both responsive layouts. Performance optimization is separate from the feature acceptance; processing correctness and video geometry are required.

### Provenance and current baseline

- The product direction came from the chat “Проанализировать проект” (thread 01a0f5cf-1e9d-7445-a3e3-c3ceeb02606d) and was finalized in this conversation through Q1–Q20 and the user's final confirmation. The testing boundary was also explicitly confirmed.
- The earlier cloud plan favored 3–5 recipes and deferred video geometry; those proposals are superseded. The agreed spec retains all recipes and includes video geometry in the current delivery.
- Read-only inspection found local main at a31b91df9a1fc7a17de27b6b3e06ace845d82cf8 and remote main at 18d5672a648d1b89f4cc79d7d6b8de0793135e72. Implementation must account for the newer merged baseline, including [PR #3](https://github.com/alexanderawerin/PhotoChrome/pull/3), rather than repeating its cleanup or restoring removed session fields. The earlier refactor branch exists in the source chat's cloud checkout; it was not found among remote branches.
- The source audit reported 106 unit tests and 99 passed / 4 skipped Chromium tests, followed by successful maintenance checks after PR #3. It separately reproduced LUT, shortcut, alpha, and color-processing defects. These are historical results from the source conversation, not validation of this specification's future implementation.
- Existing seams and behaviors were inspected directly. No browser or application UI was operated while preparing this document. Release evidence must identify what was actually run and which browser/device paths remain unverified.
