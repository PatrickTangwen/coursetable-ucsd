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

---

# Worksheet Desktop Expanded Course Details QA — 2026-07-23

- Source visual truth: `/var/folders/pl/ftltwy057lsgp0vvzr8r96b80000gn/T/codex-clipboard-ab341e73-55bf-464f-b15f-04cc430c5545.png`
- Browser-rendered implementation: `/tmp/coursetable-desktop-card-details-light.png`
- Focused implementation crop: `/tmp/coursetable-desktop-card-details-crop.png`
- Full target/focused comparison: `/tmp/coursetable-card-details-comparison.png`
- Viewport: 1440 × 900 CSS pixels
- State: desktop Worksheet, Calendar view, Regular weeks, CSE-100 card expanded, light theme
- Source pixels: 674 × 580; source CSS size and density are unknown because the supplied reference is a standalone crop
- Implementation pixels: 1440 × 900 at device scale factor 1; the 292 × 326 card crop was scaled uniformly to 584 × 652 for readable side-by-side inspection without changing its aspect ratio

## Evidence

The component-level source is itself the complete visual target, so the focused comparison also serves as the full-target comparison. It confirms the requested expanded information hierarchy: weekly Lecture and Discussion rows, colored dots, weekday chips, time and location metadata, and a dated Final Exam row with semantic color and countdown badge.

The implementation intentionally keeps the existing desktop card header, live course data, and Remove footer. These are outside the requested expanded-information replacement and preserve existing behavior.

## Required fidelity surfaces

- Fonts and typography: existing SunGrid font tokens, weights, line heights, and numeric formatting are reused through the shared Worksheet meeting component; hierarchy matches the reference.
- Spacing and layout rhythm: rows, dot alignment, weekday-chip spacing, metadata gaps, and divider rhythm match the existing Figure 2 component. The desktop sidebar is narrower than the standalone crop but remains readable without overflow.
- Colors and visual tokens: course dots inherit each course color; Final Exam and countdown use existing semantic danger/green tokens in both light and dark themes.
- Image quality and assets: no raster assets or replacement drawings were introduced; the target contains only interface typography and existing controls.
- Copy and content: meeting labels, full exam date, countdown, time, and location are derived from the same worksheet meeting model used by the reference component.

## Interactions tested

- Expanded CSE-100 from its desktop Calendar sidebar card.
- Confirmed Lecture, Discussion, and Final Exam details render together.
- Confirmed the expand control changes to the collapse state.
- Confirmed the existing Remove action remains available.
- Checked light and dark themes.
- Browser console warnings and errors checked: none.

## Findings and comparison history

- First comparison: no actionable P0, P1, or P2 visual differences in the requested expanded-information region.
- No post-comparison visual fix was required.
- P3 follow-up: none.

final result: passed

---

# Worksheet Mobile Header And Navigation QA — 2026-07-20

- Source visual truth (header): `/var/folders/pl/ftltwy057lsgp0vvzr8r96b80000gn/T/codex-clipboard-bafc8288-b72f-4f4c-b25c-20f6e26041e2.png`
- Source visual truth (navigation sheet): `/var/folders/pl/ftltwy057lsgp0vvzr8r96b80000gn/T/codex-clipboard-bb853015-9181-4a00-bddc-858dd4f75049.png`
- Browser-rendered header: `/tmp/coursetable-worksheet-mobile-header-final.png`
- Browser-rendered navigation sheet: `/tmp/coursetable-worksheet-mobile-nav-final.png`
- Full-view comparison: `/tmp/coursetable-worksheet-mobile-nav-full-comparison.png`
- Focused header comparison: `/tmp/coursetable-worksheet-mobile-header-comparison.png`
- Focused navigation comparison: `/tmp/coursetable-worksheet-mobile-nav-focused-comparison.png`
- Viewport: 390 × 844
- State: mobile Worksheet List view, light theme; header closed and site navigation sheet open states captured separately

## Evidence

The full-view comparison confirms the existing navigation-sheet composition, backdrop, rounded top edge, row rhythm, divider, Appearance area, and Light/Dark toggle are preserved. The intentional difference is that Worksheet, rather than Catalog, now uses the blue active icon, label, and dot on the Worksheet route.

The focused header comparison confirms `Options` occupies the former Catalog control position with matching text scale, baseline, spacing, and relationship to the boxed hamburger button. The focused sheet comparison keeps the reference typography, icon containers, alignment, and vertical rhythm without changing Catalog's menu implementation.

## Interactions tested

- `Options` opened Worksheet Options without changing the `/worksheet` URL.
- The hamburger opened the independent Site menu while Worksheet Options remained hidden.
- Worksheet was visibly selected in blue; Catalog was not selected.
- Catalog navigation still reached `/catalog`, where Filters remained available.
- Calendar and List modes both retained the `Options` entry and both Bottom Sheet routes.
- Browser console errors checked: none.

## Findings and comparison history

- First comparison: no actionable P0, P1, or P2 differences. No visual fixes were required after the combined full-view and focused comparisons.
- Image quality and assets: no raster imagery is introduced; the new Options glyph uses the existing icon library and renders sharply at mobile size.
- Typography, spacing, colors, and copy match the established SunGrid mobile navigation tokens. The active-state color change is intentional and route-correct.
- P3 follow-up: none.

final result: passed
