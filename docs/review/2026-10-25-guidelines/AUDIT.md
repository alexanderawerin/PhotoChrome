# Mobile editing refinement — Apple and Google guidance

Reviewed 25 October 2026 against `a32fc7af80e2be720c80b9f971bfbd46f467e16c`. This is a refinement of the accepted dark editor and official Iconoteka Regular/Stroke icons, not a new visual direction. Screenshots were captured from the running app in this audit; no generated product screens.

## Findings and decisions

| Official source | Finding in PhotoChrome | Applied change / deliberate choice |
| --- | --- | --- |
| [Apple HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Films looked like a destination even though the filmstrip was already visible. Batch actions consumed a second row. | One bottom action row: Adjust, Crop, More, Export. Remove the redundant Films button; reserve More for batch commands. Only Export or the current draft's confirmation receives primary emphasis. Keep labels because photo-editing symbols alone are ambiguous. |
| [Material 3: Toolbars](https://m3.material.io/components/toolbars/guidelines) | A navigation-like strip and an action strip occupied the same compact area. | Group document tools and relevant actions in one compact surface. About 40 CSS px less footer height in the two-photo view. These are native buttons in named web groups, not page navigation or an ARIA toolbar without its expected arrow-key behavior. |
| [Apple HIG: Modality](https://developer.apple.com/design/human-interface-guidelines/modality) | Existing reversible drafts were sound. The crop-ratio popup had no local Escape handler in its portal. | Preserve one short editing transaction with explicit Cancel and Apply/Done. Escape now dismisses the ratio popup first, retains the crop draft and restores focus. A second Escape cancels the draft. No extra modal or nested sheet for routine editing. |
| [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility), [Google web tap targets](https://web.dev/articles/accessible-tap-targets) | Many controls were 44 CSS px; keyboard focus could leave More open. | Use at least 48 CSS px for the mobile bottom actions, tabs, crop buttons and manual controls; retain label, outline and selection cues. More closes on focus leaving, outside tap or Escape, restoring focus when appropriate. |
| [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Small tool labels and the term Advanced added reading/interpretation cost. Red/Blue obscured the white-balance meaning. | Plain Adjust label, 12px-equivalent rem tool labels with wider cells, WB Red / WB Blue. Keep the full current adjustment label and value beside its control. Preserve the system sans-serif hierarchy; test enlarged text. |
| [Android edge-to-edge](https://developer.android.com/design/ui/mobile/guides/layout-and-content/edge-to-edge), [Android layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics) | Bottom padding already respected safe areas, but contextual controls needed the same side protection. | Inset actionable content using CSS `env(safe-area-inset-*)`; backgrounds continue to the edge. Test 320/393px widths with 0/34px bottom and 12px side insets. Keep the photograph contained, never enlarge it by cropping. |
| [Android accessibility semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics#alerts-and-pop-ups) | Applying color to the batch finished without persistent visible confirmation. | Brief nonblocking “Color applied to N photos” feedback in a polite live region. Repeating the action restarts the feedback. No additional confirmation tap. |

Apple's current accessibility table lists 44×44 **pt** as the iOS/iPadOS default control size and 28×28 pt as the minimum; Android/Material recommends 48×48 **dp** touch targets. Those are native units, not a claim that one CSS pixel equals either. This web implementation deliberately uses 48 CSS px targets at a correctly configured viewport. Compact labels do not pretend to implement Dynamic Type. Browser text scaling and keyboard navigation are tested separately.

We retain an opaque dock instead of native Liquid Glass or Material floating/FAB styling: stable image contrast and composition space matter more here. Batch commands take one additional tap under More; per-photo Export remains direct. Draft actions stay at the thumb edge rather than adopting a native sheet's top action bar. Genuine Iconoteka assets and their bundled MIT license remain unchanged.

## Captured flow

1. **Film selection — improved:** contained portrait, same-photo previews, four clear actions. The previous stacked toolbar is the main space problem.
2. **Recipes — retained:** film-scoped thumbnails and Recipes/Manual share one reversible draft. No duplicate navigation while editing.
3. **Manual adjustment — improved:** larger labeled targets, clear current value and reset, one Apply action. Full labels remain available even when the horizontal tool list scrolls.
4. **Crop and ratio chooser — improved:** dedicated geometry tools, explicit confirmation/cancellation, correct popup-first Escape behavior.
5. **More / batch feedback — improved:** secondary commands appear on demand, usable by touch and keyboard, with visible completion feedback.
6. **Export — retained:** actual JPEG and ZIP downloads, completion state and return to editor.

Screenshots demonstrate layout and hierarchy, not screen-reader or physical-device certification. See README for final automated outcomes, mobile-emulation evidence and deliverables.
