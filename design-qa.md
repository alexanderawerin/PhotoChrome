# PhotoChrome mobile correction — design QA

Selected target: the owner's mobile bottom-mode foundation, Halide Quick Edit's focused tool zone, and VSCO's compact same-photo filmstrip. The parent reviewed the six-page audit and explicitly selected this direction before implementation. This is a product-specific adaptation of those screenshots, not a pixel clone of another editor or a generated mockup.

## Source visual truth

- Owner foundation: `d8a143889f0e5de9099c75c42aa098a955b68d64`, running captures in `/workspace/artifacts/photochrome-mobile-research/audit/foundation/`.
- Halide: `docs/research/photochrome-ui-references/images/06-halide-quick-edit.jpg`, https://mobbin.com/screens/298d9809-7e34-4cb6-9c07-4a0fa712c8ba .
- VSCO: `docs/research/photochrome-ui-references/images/01-vsco-films.jpg`, https://mobbin.com/screens/e6aa14d1-453c-476f-9d84-a699915b04b0 .
- Existing main `8d6ccf4` supplies today's product rules, persistent component architecture and correct contained composition. The earlier `2e0d64d` branch remains intact for comparison.

## Rendered evidence

Playwright Chromium was used because no Browser/IAB plugin is available in this environment. The app ran locally; no production deployment occurred. The portrait captures are actual browser content, not device frames or mockups.

- CSS viewport 393×852, deviceScaleFactor 1, captures 393×852.
- CSS viewport 320×740, deviceScaleFactor 1, captures 320×740.
- States: demo, imported portrait Films, Recipes, focused Manual, White Balance, Crop, collection sheet and landscape image.
- Files: `/workspace/artifacts/photochrome-mobile-final/{393,320}-{demo,films,recipes,manual,balance,crop,collection,landscape}.png`.
- Combined comparison inputs: `/workspace/artifacts/photochrome-mobile-final/comparison-manual.png` and `comparison-films.png`. Each places source, owner foundation and current running UI together at 393 px column width. Both reference rasters are 1179×2676; owner and implementation captures are 393×852 at deviceScaleFactor 1. Source reference density is normalized with contain sizing in a 393×852 box; reference device/attribution chrome is retained, not falsely counted as product spacing. Different photo content is intentional. Caption, tool and slider details remain readable in these full-resolution comparison inputs, so a separate enlarged crop was unnecessary.

## Comparison history and fixes

1. P1: initial dock percentage height clipped thumbnails, captions and the focused control, leaving a bottom gap. Changed the bound to viewport units. Fresh captures show complete content and the action row at the viewport edge.
2. P2: Advanced broke across lines at 320 px. Gave mode labels intrinsic minimum width and allowed the mode row to wrap as whole controls for enlarged text. Fresh 320 px capture keeps all three modes on one line at normal size; automated 200% text stress verifies controls remain contained.
3. P2: white-balance selected mode inherited muted text on a mid-gray fill. Added an explicit selected foreground/background pair; retained the existing preset/Kelvin state logic.

## Required fidelity surfaces

- Typography: restrained system sans. File identity 13–14 px, primary controls 13–14 px, film/tool captions 11 px. No serif headings or decorative library titles. At 320 px no split mode labels or horizontal page overflow. All primary touch targets are at least 44 px.
- Spacing/layout: utility header is 60 px rather than the delivered branch's 222 px of accumulated top chrome. Films, Advanced and Crop share one bottom mode tree and fixed action zone. Cancel/Apply or Export have clear unequal emphasis. Manual uses one focused parameter rather than a long phone inspector. Portrait images fill the available stage; landscape images remain fully contained and centered with balanced surrounding space.
- Colors/tokens: neutral #101113 stage, #1a1b1d control surface, #ededee text, #a2a3a6 secondary text, restrained #e8bd77 selection/action accent. No glass layers or decorative gradients. Processing and comparison overlays use small local scrims.
- Image/asset integrity: actual source-derived film previews. Main image remains contain-fit; no cover enlargement that hides composition. Crop geometry and export pipeline are unchanged. Comparison preserves geometry. Collection thumbnails use existing bounded source thumbnails and mount only while the collection is open. Existing Lucide icons are retained; no generated or handcrafted replacement imagery is shipped.
- Copy/content: Original + ten films, Films / Advanced / Crop, film-scoped Recipes / Manual, Apply / Cancel, Done, Export and batch actions remain real controls. Filename/count now opens the collection. The quick guide describes that behavior and no longer advertises removed favorites. Demo still exposes only films, photo switching and upload.

Intentional adaptations: PhotoChrome uses labeled confirmation rather than Halide's icon-only buttons; it retains its own film names, current shared Advanced draft, export formats and media ownership. Recipes have slightly wider previews than base films to accommodate actual names. The owner foundation's obsolete favorites/recommendations and cover-fit preview were not restored.

## Interaction evidence

Fresh browser captures exercised import, film selection, Advanced tabs, tool switching, cancel, crop and collection navigation without application console errors. Automated checks cover independent edits, draft cancellation and commit, focused-control persistence through resize, demo restrictions, late decoder completion after cancel, before/after and actual export. The final handoff report records exact suite totals, source commit and recording verification.

No actionable P0/P1/P2 visual findings remain in the inspected states. Physical Android, iPhone, Safari and device-specific AAC acceptance remain unperformed; browser mobile emulation is not a physical-device check.

final result: passed

## Bottom-panel refinement — 25 October 2026

This section supersedes the v2 icon and always-visible mode-row details above. The owner accepted v2 and requested a focused bottom-panel refinement with actual Iconoteka icons; the overall canvas, palette, typography, filmstrip, persistent media state and export engine remain the accepted target.

### Current audit and decision

Fresh Playwright screenshots were captured before changing code at 393×852 and 320×740. The existing Browser/IAB tool is unavailable, so system Chromium is the capture fallback. Screenshots are actual rendered UI, inspected with `view_image`.

1. **Films:** working labeled modes and one export CTA; selected mode was only distinguished by color and a short underline. Keep labels; add a subtle selected surface and precise icons.
2. **Recipes:** working draft, but full mode navigation remained immediately above Cancel/Apply. Some modes were disabled; another could discard the draft. Hide mode navigation until the temporary edit is resolved explicitly.
3. **Manual:** useful focused adjustment, crowded by the repeated navigation row below it. Retain its tool chooser and slider; use the compact transaction footer to return 40 px to the image.
4. **Crop:** working geometry and reversible state; mode row added competing destinations beside confirmation. Use the same transaction footer, with Crop identified centrally and Cancel/Done at thumb corners.
5. **Cancel/confirmation:** preserve the existing owner-bound draft model. Move focus into Recipes on entry; after Cancel/Apply restore the original mode trigger. Navigation remains mounted for stable focus identity.
6. **Narrow/safe area:** inspect 320 px with a 34 px bottom, 12 px side and 24 px top inset through Chromium CDP. Actions remain inside safe bounds, with 44 px minimum targets and no page overflow. This is emulation, not physical-device verification.

References inspected again: [Halide Quick Edit](https://mobbin.com/screens/298d9809-7e34-4cb6-9c07-4a0fa712c8ba) for separated confirmation corners; [Apple Photos Crop](https://mobbin.com/screens/5bcf365a-c53b-471d-95e5-08dc4d9fa79d) for labeled tool choices and consistent selected-state emphasis. Their actual reference pixels remain in `docs/research/photochrome-ui-references/images/`. This refinement adapts those patterns to PhotoChrome; it does not copy their full UI.

### Icon provenance and fidelity

Read the official [about page](https://iconoteka.com/about.html), [developer documentation](https://iconoteka.com/dev.html) and [repository](https://github.com/iconoteka/iconoteka). Integrated only 25 Regular / Stroke geometries from release `02.01.00`, with no runtime network dependency or MCP configuration. Each path was independently compared with its version-pinned official SVG and matched exactly. The MIT notice is shipped in `public/licenses/iconoteka.txt`. Source mapping and component notes are in `src/components/icons/`.

Visual inspection caught a naming trap: Iconoteka's `check` is a bank cheque. Replaced it with the actual `checkmark` glyph before final capture. No approximated icon geometry is shipped.

### Final visual comparison

- **Composition:** same contained photograph; no cover crop or canvas trick. Draft footer is 68 px including the default bottom padding, replacing the prior 108 px combination of navigation/actions.
- **Hierarchy:** one amber primary confirmation, quieter labeled cancel, centered current task; mode controls reappear when the draft ends. Idle mode order and batch/export availability stay intact.
- **Typography/copy:** existing system font and visible labels preserved. Only the centered current-task label is added. Guide explains resolving a draft before choosing another mode. No new decorative text.
- **Icons:** genuine Regular Stroke, 20 px for mode/action/crop controls and 24 px in the tool picker; inherited currentColor, decorative SVGs hidden from accessibility names. The non-editor utility/dialog icons remain out of scope.
- **Selection:** mode and manual tool selections use the same amber foreground, restrained fill and thin inset border; selection is also exposed through existing ARIA state.
- **Responsive/safe area:** 393/320 captures inspected, including enlarged text and emulated inset coverage. No clipped primary controls or horizontal page overflow in inspected states.
- **Behavior:** choosing another mode now follows explicit Apply/Done or Cancel. This intentional interaction change prevents an implicit mode click from discarding a draft. Existing shortcuts, media-owned drafts, recipe/manual sharing, composition and real exports are retained.

Before/after screenshots, fresh walkthrough and exact verification results are in `docs/review/2026-10-25-bottom-panel/`. No material visual mismatches remain against the accepted v2 design and the scoped refinement. Physical Android, iPhone, Safari and optional device AAC acceptance are not claimed.

## 25 October — guideline-led refinement

The accepted dark editor and Iconoteka assets are retained. A fresh audit of running film, recipe, manual, crop and ratio states is mapped to current official Apple HIG and Google/Android guidance in [the guideline audit](docs/review/2026-10-25-guidelines/AUDIT.md).

The idle footer now has one row of document actions (Adjust, Crop, More, Export); the filmstrip supplies film selection without a repeated Films destination. This replaces the earlier two-row pattern described above. Batch commands are under More. Temporary edits still replace this row with Cancel / task / Apply or Done. Keyboard popup dismissal respects the current crop transaction, and batch color application has visible polite status feedback. Mobile targets are 48 CSS px, with safe-area content insets and clearer manual labels. Icon paths and MIT provenance are unchanged.

Final verification counts, recording source commit and new screenshots will be recorded in [the review delivery](docs/review/2026-10-25-guidelines/README.md). Older review evidence is preserved as history, not presented as new device verification.
