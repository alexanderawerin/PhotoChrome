# Photochrome: code-to-Figma rules

These rules are mandatory whenever translating Photochrome pages or states from code into Figma.

- Treat the repository as the source of truth. Inspect the React components, CSS/Tailwind classes, breakpoints, runtime state, copy, assets, and dependencies before writing to Figma.
- Reproduce the existing interface. Do not redesign it, improve it, invent content, guess runtime-derived sections, or substitute a visually similar solution without explicit user approval.
- Build editable Figma nodes directly with `figma-use`. Do not use Figma's HTML/import capture flow (`generate_figma_design`) unless the user explicitly requests that mechanism.
- Use the real assets and icons shipped with the project. For `lucide-react`, render the exact SVG from the installed package/version. Never draw approximate paths, use emoji, or replace an asset with an improvised gradient or placeholder without approval.
- Preserve exact viewport behavior. Implement each requested state and width separately from the code's responsive rules; do not infer viewport width from browser outer-window dimensions.
- Work on one state/viewport at a time. After each frame, verify it with a Figma screenshot and compare structure, spacing, typography, colors, icons, copy, clipping, and responsive behavior before starting the next frame.
- If a value or runtime state cannot be derived reliably from code, inspect the running application or ask the user. Do not silently guess.
- Do not modify production source merely to make a Figma transfer easier. If temporary instrumentation is unavoidable and authorized, keep it isolated and remove it completely before finishing.
- Do not repeat a failing tool call in a loop. Diagnose once, change the approach, or report the blocker clearly.
- Do not claim completion until every requested state and viewport exists in Figma and has been verified.
- Preserve unrelated user changes in the working tree.

For the current Photochrome deliverable, the target Figma file is `ZDr3uLhnJP768aKz1MelGA`, page `2:2` (`ui`). Requested states are start, preset selection, and preset settings at widths 1600, 1200, and 393.

## Demo start state

- The current first usable Photochrome screen is the functional `Editor` running with `demoMode`, not the older standalone `LandingScreen`.
- It preloads three demo photos. Users can switch between them and apply presets.
- Demo mode must not expose export, tuning/Adjust, Crop, or other full-editor actions.
- The available progression is adding the user's own photos or video; doing so transitions into the full editor with its complete controls.
- Any design, Figma, screenshot, or ImageGen work for the `start` state must preserve this behavior and must be derived from the actual `demoMode` code path.

## Visual-reference boundary

- Generated mockups and external references are style references only unless the user explicitly expands scope.
- The implemented Photochrome UI remains authoritative for its familiar regions, control set, ordering, state-specific availability, interaction flow, and responsive behavior.
- Small shifts and adjustments to padding, gaps, control dimensions, radii, and local visual density are allowed when applying the reference style, provided the information architecture and interaction flow are not radically changed.
- Do not add, remove, regroup, or reorder controls solely to match a reference unless the user explicitly expands scope.
- Try bounded backdrop blur on existing overlay surfaces first. If it harms readability, performance, or browser support, use translucent dimming or localized scrims instead; blur is not a product requirement.

## Test maintenance

- Whenever product behavior or UI structure changes intentionally, update the affected automated tests in the same task and run the narrow relevant E2E suite before reporting completion.
- After any UI/layout refactor, audit shared E2E helpers and repository-wide selectors for assumptions about DOM order, visibility, copy, and accessibility roles; use semantic, uniquely scoped locators instead of positional selectors such as `.first()` when multiple responsive copies can exist.
- Before a push or release-facing handoff, run the CI-equivalent Chromium suite (`npm run test:e2e:chromium`) in addition to lint, unit tests, and the production build.
- Do not push a UI/layout change until that full Chromium suite passes locally; a narrow suite is necessary for iteration but does not replace the CI-equivalent run.
- Do not leave tests asserting UI elements, copy, or accessibility roles that were intentionally removed or relocated.
- Browser codec assertions must reflect runtime capability checks. Require optional codecs such as AAC only when the browser reports that encoder configuration as supported.
