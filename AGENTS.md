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
