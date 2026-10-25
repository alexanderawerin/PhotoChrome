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
