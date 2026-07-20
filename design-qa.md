# Worksheet Options Mobile Design QA

- Source visual truth: `/var/folders/pl/ftltwy057lsgp0vvzr8r96b80000gn/T/codex-clipboard-27f81339-891f-4ded-887c-b362440c8165.png`
- Browser-rendered implementation: `/tmp/coursetable-worksheet-options-final.png`
- Full-view comparison: `/tmp/coursetable-worksheet-options-full-comparison.png`
- Focused sheet comparison: `/tmp/coursetable-worksheet-options-comparison.png`
- Viewport: 390 × 844
- State: mobile Worksheet, Calendar view, Regular weeks, Summer Session 1 2026, options sheet open, light theme

## Evidence

The full-view comparison confirms the same bottom-anchored composition, dimmed backdrop, rounded top corners, header treatment, row dividers, and fixed two-button footer as the Catalog Filters reference. The Worksheet sheet is intentionally taller because it contains two segmented controls in addition to the Term row.

The focused comparison confirms readable and consistent title hierarchy, close button, padding, dividers, Term row/chevron, Reset/Apply dimensions, and primary-button styling. The source and implementation differ only in the requested business content.

## Interactions tested

- Opened the sheet from both Calendar and List views.
- Confirmed View, Weeks, and Term changes remain draft-only before Apply.
- Entered the Term picker, selected Spring 2026, returned to the main sheet, then applied all three changes together.
- Confirmed Reset restores Calendar, Regular, and the current default term without changing the page before Apply.
- Confirmed close-button and backdrop dismissal.
- Confirmed the Catalog Filters sheet still opens and retains its existing content and styling.
- Downward-close recognition has focused unit coverage; a physical touch-device gesture remains a residual manual test gap.
- Browser console errors checked: none.

## Findings and comparison history

- Initial P2: the visible 4 px drag handle also served as the full gesture target, making a downward swipe unnecessarily difficult to start. Fixed by keeping the 36 × 4 px visual handle while expanding its invisible touch target to 72 × 22 px, capturing the pointer, and recognizing the gesture during movement as well as release.
- Post-fix evidence: the refreshed implementation and focused comparison preserve the reference handle appearance and surrounding spacing while improving the interaction target. No actionable P0, P1, or P2 visual findings remain.
- P3 follow-up: confirm the downward-close gesture once on physical iOS/Android touch hardware.

final result: passed
