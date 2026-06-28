# Handoff: SunGrid — Catalog List View & Course Detail Modal

## Overview

This handoff covers the **Catalog List View** page and the **Course Detail Modal** for **SunGrid**, a university course scheduling tool (similar to UCSD's WebReg / CourseTable). The catalog page lets students browse, search, filter, and sort available course sections, then click into a modal to see full details and add courses to their worksheet.

## About the Design Files

The files in this bundle are **design references created in HTML** (Design Component `.dc.html` format) — prototypes showing intended look, layout, and interactive behavior. They are **not production code**. The task is to **recreate these designs in your target codebase** (React/Next.js, Vue, etc.) using its established patterns, component library, and data layer.

To preview the designs locally, open the `.dc.html` files in a browser (they require the bundled `support.js`).

## Fidelity

These mocks are **high-fidelity (hifi)**. Every color, font size, weight, spacing, radius, shadow, and interaction is intentional and should be matched exactly. Use the values specified below.

---

## Design Tokens

### Typography

| Token                 | Value                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Font family (primary) | `'Inter', system-ui, -apple-system, sans-serif`                                                                 |
| Font family (logo)    | `'Cormorant Garamond', serif`                                                                                   |
| Google Fonts import   | `Inter:wght@400;500;600;700` and `Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700` |

### Colors

**Brand / Primary**
| Name | Hex | Usage |
|---|---|---|
| Primary Blue | `#1a56db` | Buttons, links, active tab, icons, selected radio |
| Primary Blue Hover | `#1548b8` | Button hover states |
| Primary Blue Light | `#e8f0fe` | Active tab background, icon hover bg |
| Primary Blue Chip BG | `#eef3ff` | Active filter chip background |
| Blue Tint | `#fafbff` | Selected card bg, button footer bg |
| Blue Border | `#bfdbfe` | Selected card border |
| Blue Badge BG | `#dbeafe` | LE badge, section badge bg |
| Blue Badge Text | `#1e40af` | LE badge, section badge text |
| Blue Info BG | `#eef2ff` | Units chip bg |
| Blue Info Text | `#3b52a8` | Units chip text |
| Selected Row BG | `#edf4ff` | Selected discussion row |

**Text**
| Name | Hex | Usage |
|---|---|---|
| Text Primary | `#1a1a2e` | Headings, course codes, bold text |
| Text Secondary | `#33354d` | Title text, time text |
| Text Tertiary | `#4a4d68` | Descriptions, tab text |
| Text Muted | `#5a5d7a` | Instructors, location, sub-labels |
| Text Placeholder | `#8b8fa3` | Placeholder text, labels, result count |
| Text Light | `#9a9db4` | Course code in modal header, summary text |
| Text Disabled | `#b0b3be` | Scroll hint |
| Text Very Light | `#c5c8d6` | Inactive day dot text, unselected radio border |

**Backgrounds**
| Name | Hex | Usage |
|---|---|---|
| White | `#ffffff` | Main background |
| Alt Row | `#fafbfc` | Alternating row, expanded parent bg, sub-row bg |
| Input BG | `#f8f9fb` | Search input bg |
| Group Header BG | `#f5f7fa` | Offering group card header |
| Anchor Row BG | `#f8fafd` | Lecture row bg in modal |

**Borders**
| Name | Hex | Usage |
|---|---|---|
| Border | `#e8e9ef` | Nav border, dividers, table header |
| Border Light | `#dcdee6` | Input border, filter button border |
| Border Subtle | `#e2e4ea` | Card border (default) |
| Row Separator | `#f0f1f5` | Between table rows |
| Row Separator Light | `#eeeff3` | Sub-dividers, button footer borders |
| Row Separator Lightest | `#f3f4f7` | Meeting row bottom border |

**Status / Semantic**
| Name | Hex | Usage |
|---|---|---|
| Danger Red | `#e8446a` | Reset button, near-full seats bar |
| Danger Red Hover | `#d63a5e` | Reset button hover |
| Danger Text | `#be123c` | Near-full seats text, "Upper Division" chip, "FULL" avail |
| Red Chip BG | `#fff1f2` | Upper Division / Dept Stamp chip bg |
| Full Red | `#dc2626` | FULL availability text |
| Green Text | `#166534` | Low enrollment seats text, DI badge text |
| Green Bar | `#22c55e` | Low enrollment seats bar |
| Green Badge BG | `#dcfce7` | DI badge bg |
| Purple | `#6d28d9` | Prerequisites text |
| Purple Dark | `#5b21b6` | LA badge text |
| Purple Light BG | `#f5f3ff` | Prerequisites chip bg |
| Purple Active BG | `#ede9fe` | Prerequisites chip expanded / LA badge bg |
| Purple Border | `#e9e5f5` | Prerequisites panel border |
| Purple Panel BG | `#faf8ff` | Prerequisites panel bg |
| Yellow Badge BG | `#fef9c3` | FI/MI badge bg |
| Yellow Badge Text | `#854d0e` | FI/MI badge text |
| Day Dot Active BG | `#334155` | Active day of week |
| Day Dot Inactive BG | `#f0f1f5` | Inactive day of week |

**Logo**
| Part | Styles |
|---|---|
| "Sun" | `font-family: 'Cormorant Garamond'`, `font-weight: 600`, `font-style: italic`, `color: #0e9ae9` |
| "Grid" | `font-family: 'Cormorant Garamond'`, `font-weight: 700`, `color: #182b50` |
| Logo size | `font-size: 20px` |

### Shadows

| Token          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Expanded group | `0 0 0 1px #e0e2e8, 0 2px 8px rgba(0,0,0,0.04)`             |
| Modal          | `0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)` |
| FAB            | `0 4px 16px rgba(26,86,219,0.35)`                           |
| Backdrop       | `rgba(0,0,0,0.42)` overlay                                  |

### Animations

| Name             | Keyframes                                                 | Duration / Easing        |
| ---------------- | --------------------------------------------------------- | ------------------------ |
| `modalFadeIn`    | `opacity: 0 → 1`, `transform: scale(0.97) → scale(1)`     | `0.25s ease-out`         |
| `backdropFadeIn` | `opacity: 0 → 1`                                          | `0.2s ease-out`          |
| `popoverFadeIn`  | `opacity: 0, translateY(6px) → opacity: 1, translateY(0)` | (for future popover use) |
| Chevron rotate   | `transform: rotate(0deg) ↔ rotate(180deg)`                | `transition: 0.2s`       |
| Row hover        | `background` transition                                   | `0.1s`                   |
| Card border      | `border-color` transition                                 | `0.2s`                   |

---

## Screen 1: Catalog List View

### Layout

Full-viewport flex column (`height: 100vh`), three zones stacked vertically:

```
┌──────────────────────────────────────────┐
│  Top Navigation Bar (fixed height)       │
├──────────────────────────────────────────┤
│  Filter Bar (fixed height)               │
├──────────────────────────────────────────┤
│                                          │
│  Scrollable Table                        │
│  (flex: 1, overflow-y: scroll)           │
│                                          │
│                                          │
└──────────────────────────────────────────┘
                              [FAB Button] ← fixed position bottom-right
```

### 1.1 Top Navigation Bar

- **Container**: `padding: 14px 24px`, `display: flex`, `align-items: center`, `gap: 16px`, `border-bottom: 1px solid #e8e9ef`
- **Logo**: "SunGrid" — see Logo tokens above. `flex-shrink: 0`, `white-space: nowrap`
- **Search Input**:
  - Container: `flex: 1`, `max-width: 560px`, `position: relative`
  - Search icon (magnifying glass SVG): `position: absolute`, `left: 12px`, `top: 50%`, `transform: translateY(-50%)`, `color: #9a9db4`, 16×16px
  - Input: `width: 100%`, `padding: 10px 14px 10px 36px`, `border: 1px solid #dcdee6`, `border-radius: 10px`, `font-size: 14px`, `background: #f8f9fb`, `color: #1a1a2e`
  - Placeholder: `"Search by course code, title, instructor, or description"`
- **Result count**: `font-size: 13px`, `color: #8b8fa3`, `white-space: nowrap`. Format: `"Showing N results"`
- **Spacer**: `flex: 1`
- **Right actions** (`display: flex`, `gap: 6px`):
  - Settings icon button: `34×34px`, `border-radius: 8px`, `color: #5a5d7a`, gear/sun SVG, hover `background: #f0f0f5`
  - **Catalog** button (active): `padding: 6px 14px`, `font-size: 13.5px`, `font-weight: 600`, `color: #1a56db`, hover `background: #e8f0fe`
  - **Worksheet** button (inactive): `padding: 6px 14px`, `font-size: 13.5px`, `font-weight: 500`, `color: #4a4d68`, hover `background: #f0f0f5`
  - Avatar button: `34×34px`, `border-radius: 50%`, `background: #e4e5eb`, `color: #6b6e85`, person icon

### 1.2 Filter Bar

- **Container**: `padding: 10px 24px`, `display: flex`, `align-items: center`, `gap: 10px`, `flex-wrap: wrap`
- **Filter dropdowns** (Subject, Areas/Skills):
  - `padding: 7px 12px`, `border: 1px solid #dcdee6`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 500`, `color: #4a4d68`
  - Chevron down icon (10×10 SVG) appended
  - Hover: `background: #f8f9fb`
- **Active filter chips** (removable):
  - `padding: 6px 10px 6px 12px`, `background: #eef3ff`, `border-radius: 20px`, `font-size: 12.5px`, `font-weight: 500`, `color: #1a56db`
  - × close button: `18×18px`, hover `background: rgba(26,86,219,0.12)`, `border-radius: 50%`
- **Reset button**:
  - `padding: 7px 16px`, `background: #e8446a`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`, `color: #fff`
  - Hover: `background: #d63a5e`
- **"Updated" label** (right-aligned):
  - `font-size: 12.5px`, `color: #8b8fa3`, clock icon (13×13px) + "Updated 2 days ago"

### 1.3 Table

#### Table Header Row (sticky)

- `position: sticky`, `top: 0`, `background: #fff`, `z-index: 10`
- `border-bottom: 2px solid #e8e9ef`
- `font-size: 11px`, `font-weight: 600`, `color: #8b8fa3`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- Column widths (flex row):

| Column          | Width                         | Sortable | Notes                               |
| --------------- | ----------------------------- | -------- | ----------------------------------- |
| + button spacer | `44px` fixed                  | No       | Empty header cell                   |
| Code            | `140px` fixed                 | Yes      | Sort indicator `▼` in `#1a56db`     |
| Title           | `flex: 1`, `min-width: 120px` | Yes      | Sort indicator `▼` in `#1a56db`     |
| Instructors     | `165px` fixed                 | No       |                                     |
| Meets           | `220px` fixed                 | Yes      | Sort indicator `½` (half-sort icon) |
| Location        | `90px` fixed                  | No       |                                     |
| Seats           | `90px` fixed                  | No       |                                     |

#### Single-Section Row

A course with only 1 section renders as a flat row. **The entire row is clickable** — opens the Course Detail Modal.

- `display: flex`, `align-items: center`, `cursor: pointer`
- `border-bottom: 1px solid #f0f1f5`
- Background alternates: odd rows `#fff`, even rows `#fafbfc`
- Hover: `background: #f4f6fa`, transition `0.1s`

Cell details:

| Cell           | Width     | Styles                                                                                                     |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| **+ icon**     | `44px`    | Blue plus SVG (`stroke: #1a56db`), 18×18px. Acts as "add to worksheet" button.                             |
| **Code**       | `140px`   | Code bold: `font-weight: 700`, `color: #1a1a2e`. Section ID muted: `color: #8b8fa3`, `margin-left: 4px`.   |
| **Title**      | `flex: 1` | `font-weight: 500`, `color: #33354d`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` |
| **Instructor** | `165px`   | `font-size: 12.5px`, `color: #5a5d7a`, ellipsis overflow                                                   |
| **Meets**      | `220px`   | Day dots + time (see Day Dots spec below)                                                                  |
| **Location**   | `90px`    | `font-size: 12.5px`, `color: #5a5d7a`                                                                      |
| **Seats**      | `90px`    | Seat count text + micro progress bar (see Seats spec below)                                                |

**Font size for all row text**: `13.5px` unless noted otherwise.

#### Day Dots Component (List View)

A row of 5 tiny rectangles for M, Tu, W, Th, F:

- Each dot: `width: 17px`, `height: 15px`, `border-radius: 3px`, `font-size: 8.5px`, `font-weight: 700`
- Active: `background: #334155`, `color: #fff`
- Inactive: `background: #f0f1f5`, `color: #c5c8d6`
- Container: `display: flex`, `gap: 1px`
- Followed by time text: `font-size: 12.5px`, `font-weight: 500`, `color: #33354d`
- When schedule is "TBA": hide day dots, show "TBA" as time text

**Day string parsing logic**: Parse strings like `"MTWTh"`, `"MW"`, `"TTh"` into individual day flags. Two-char days (`Tu`, `Th`) take precedence — e.g. `T` alone means Tuesday.

**Time formatting**: Convert `"11:00am–12:20pm"` to `"11:00 AM – 12:20 PM"`. If start and end share AM/PM, only show it once at end: `"11:00 – 12:20 PM"`.

#### Seats Display

- Text: `"enrolled/total"` — e.g. `"38/50"`
- `font-size: 12.5px`, `font-weight: 500`
- Micro progress bar: `width: 28px`, `height: 4px`, `border-radius: 2px`, bg track `#eef0f4`
- Color thresholds based on percentage (enrolled/total):
  - **≥ 90%** (nearly full): text `#be123c`, bar `#e8446a`
  - **≥ 60%** (filling): text `#33354d`, bar `#1a56db`
  - **< 60%** (available): text `#166534`, bar `#22c55e`

#### Multi-Section Parent Row

A course with 2+ sections renders as an expandable parent + child rows.

**Parent row**:

- Same column widths as single-section row
- `+ icon` column: empty (no add button on parent)
- **Code column**: Course code bold + **section count badge**:
  - `padding: 2px 8px`, `border-radius: 10px`, `background: #dbeafe`, `color: #1e40af`, `font-size: 10px`, `font-weight: 600`
  - Text: `"N sections"` + chevron SVG (8×8px)
  - Chevron rotates 180° when expanded
  - **Clicking this badge toggles expand/collapse**
- **Title column**: clicking the title opens the modal (same as single-section)
- **Instructor/Meets/Location columns**: show summary text instead of actual values
  - `font-size: 12px`, `color: #9a9db4`
  - `"N instructors"`, `"Multiple schedules"`, `"N locations"`
- **Seats column**: empty for parent

**Collapsed state**: Normal flat row with `border-bottom: 1px solid #f0f1f5`

**Expanded state**: Parent + children wrapped in a container:

- `border-radius: 10px`, `overflow: hidden`
- `box-shadow: 0 0 0 1px #e0e2e8, 0 2px 8px rgba(0,0,0,0.04)`
- No external border-bottom
- Parent bg becomes `#fafbfc`

**Child sub-rows** (inside scrollable container):

- Container: `max-height: 132px`, `overflow-y: auto`, `border-top: 1px solid #eef0f4`
- Each sub-row: `background: #fafbfc`, `border-bottom: 1px solid #eef0f4`, hover `background: #f3f4f6`, `font-size: 13px`
- **Clicking a sub-row opens the modal** with that section pre-selected
- **+ icon**: smaller 16×16px blue plus (adds that specific section)
- **Section badge**: `padding: 2px 8px`, `border-radius: 4px`, `background: #dbeafe`, `color: #1e40af`, `font-size: 10.5px`, `font-weight: 700`
- **LE badge**: `padding: 2px 7px`, `border-radius: 4px`, `background: #f0f1f5`, `color: #5a5d7a`, `font-size: 10px`, `font-weight: 600`, `letter-spacing: 0.03em`
- **Seats**: inline text (`font-size: 12px`) + wider progress bar (`width: 48px`, `height: 4px`)
- **Instructor, Meets (day dots + time), Location**: same as single-section but slightly smaller font

**Scroll hint** (if > 3 sections):

- `padding: 5px 16px`, `background: #fafbfc`, `text-align: center`, `font-size: 10px`, `color: #b0b3be`
- Text: `"↓ scroll for more sections"`
- `border-top: 1px solid #eef0f4`

### 1.4 FAB Button

- `position: fixed`, `bottom: 28px`, `right: 28px`
- `width: 56px`, `height: 56px`, `border-radius: 50%`
- `background: #1a56db`, `color: #fff`
- `box-shadow: 0 4px 16px rgba(26,86,219,0.35)`
- `z-index: 200`
- Hover: `transform: scale(1.06)`
- Icon: Calendar SVG (24×24px)

---

## Screen 2: Course Detail Modal

The modal opens when a user clicks a course row (or sub-row) in the catalog table. It displays full course details, schedule options, and an "Add to Worksheet" action.

### Layout

```
┌──────────────────────────────────────────┐
│  Header (fixed)                          │
│  ├─ Title + Term + Code + Close button   │
│  ├─ Section pills (if multi-section)     │
│  ├─ Tab bar + Action buttons             │
│  └─ Separator line                       │
├──────────────────────────────────────────┤
│  Scrollable Content                      │
│  ├─ Description text                     │
│  ├─ Meta chips (Units, tags, prereqs)    │
│  ├─ "Schedule Options" heading           │
│  ├─ Offering Group Card 1               │
│  ├─ Offering Group Card 2               │
│  └─ ...                                 │
└──────────────────────────────────────────┘
```

### 2.0 Modal Overlay & Container

- **Backdrop**: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.42)`, `z-index: 1000`
  - Clicking the backdrop **closes the modal**
  - Animation: `backdropFadeIn 0.2s ease-out`
- **Modal box**: `background: #fff`, `border-radius: 14px`
  - `width: calc(100% - 56px)`, `max-width: 780px`
  - `height: calc(100% - 56px)`, `max-height: 860px`
  - `box-shadow: 0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)`
  - Animation: `modalFadeIn 0.25s ease-out`
  - Click inside modal calls `e.stopPropagation()` to prevent backdrop close

### 2.1 Modal Header

- **Container**: `padding: 24px 28px 0 28px`, `flex-shrink: 0`

**Title line**:

- `font-size: 21px`, `line-height: 1.35`, `letter-spacing: -0.01em`
- Course title: `font-weight: 700`, `color: #1a1a2e`
- Term suffix: `font-weight: 400`, `color: #8b8fa3` — e.g. `"(Summer Session 1 2026)"`

**Course code**: `margin-top: 5px`, `font-size: 16px`, `font-weight: 500`, `color: #9a9db4`, `letter-spacing: 0.02em`

**Close button**: `36×36px`, `border-radius: 8px`, `color: #9a9db4`, X SVG (20×20, `stroke-width: 2.2`), hover `background: #f0f0f5`, `color: #5a5d7a`

#### Section Pills (multi-section courses only)

- `display: flex`, `gap: 6px`, `margin-top: 12px`, `flex-wrap: wrap`
- Each pill: `padding: 4px 12px`, `border-radius: 6px`, `font-size: 11.5px`, `font-weight: 600`
- **Active pill**: `background: #1a56db`, `color: #fff`, `border: 1px solid #1a56db`
  - Instructor sub-text: `color: rgba(255,255,255,0.7)`, `font-weight: 400`, `font-size: 10.5px`
- **Inactive pill**: `background: #fff`, `color: #4a4d68`, `border: 1px solid #dde3f0`
  - Instructor sub-text: `color: #9a9db4`
  - Hover: `background: #f4f6fa`
- Clicking a pill switches the active section context (highlights the corresponding offering group card)

#### Tab Bar

- `margin-top: 14px` (with pills) or `18px` (without pills)
- Left side — two tabs:
  - **Overview** (active): `padding: 7px 16px`, `border-radius: 8px`, `background: #e8f0fe`, `color: #1a56db`, `font-size: 13.5px`, `font-weight: 600`
  - **Past Grades** (inactive): same padding/radius, `background: transparent`, `color: #4a4d68`, `font-weight: 500`, hover `background: #f4f4f8`
- Right side — 3 icon buttons (`34×34px`, `border-radius: 8px`, `color: #1a56db`, hover `background: #e8f0fe`):
  1. **Add (+)**: Plus icon (18×18, `stroke-width: 2.2`)
  2. **Share**: Upload/share icon (17×17)
  3. **More (...)**: Three dots icon (17×17, `fill: currentColor`)

**Separator**: `height: 1px`, `background: #e8e9ef`, `margin-top: 12px`

### 2.2 Modal Content (Scrollable)

- `flex: 1`, `overflow-y: auto`, `padding: 22px 28px 32px 28px`

#### Course Description

- `font-size: 14.5px`, `line-height: 1.65`, `color: #4a4d68`, `margin-bottom: 14px`, `text-wrap: pretty`

#### Meta Chips

- `display: flex`, `gap: 8px`, `align-items: center`, `flex-wrap: wrap`, `margin-bottom: 8px`
- All chips: `padding: 4px 10px`, `border-radius: 6px`, `font-size: 12px`

| Chip                   | Background | Color     | Weight |
| ---------------------- | ---------- | --------- | ------ |
| Units (e.g. "4 Units") | `#eef2ff`  | `#3b52a8` | `600`  |
| Upper Division         | `#fff1f2`  | `#be123c` | `500`  |
| Dept Stamp Required    | `#fff1f2`  | `#be123c` | `500`  |

#### Prerequisites (Expandable Chip)

- **Chip**: `background: #f5f3ff` (collapsed) / `#ede9fe` (expanded), `color: #6d28d9`, `font-size: 12px`, `font-weight: 500`
  - Chevron icon appended (10×10px), rotates 180° when expanded
  - Hover: `background: #ede9fe`
  - Clickable — toggles the panel below
- **Panel** (visible when expanded):
  - `padding: 11px 14px`, `background: #faf8ff`, `border: 1px solid #e9e5f5`, `border-radius: 8px`, `margin-bottom: 8px`
  - Label: `"Prereqs:"` in `font-weight: 600`, `color: #6d28d9`
  - Body text: `font-size: 13px`, `color: #33354d`, `line-height: 1.55`
  - Close (×) button top-right: `color: #8b8fa3`, hover `color: #6d28d9`

#### Catalog Link Chip

- `background: #f0f9ff`, `color: #1a56db`, `font-size: 12px`, `font-weight: 500`
- External link icon (10×10px)
- Hover: `background: #dbeafe`
- Opens course in university catalog (external link)

#### Schedule Options Section

- **Header**: `margin-top: 14px`, `margin-bottom: 14px`
  - Left: `"Schedule Options"` — `font-size: 15px`, `font-weight: 700`, `color: #1a1a2e`
  - Right: `"N offering groups"` — `font-size: 12.5px`, `color: #8b8fa3`

### 2.3 Offering Group Cards

Each offering group represents one possible schedule combination (Lecture + Discussion + Final).

**Card container**:

- `border-radius: 10px`, `overflow: hidden`, `margin-bottom: 16px`
- Default: `border: 1px solid #e2e4ea`, `background: #fff`
- Active/selected (matches active section pill): `border: 1px solid #bfdbfe`, `background: #fafbff`

#### Card Header

- `padding: 13px 18px`, `background: #f5f7fa`, `border-bottom: 1px solid #e8e9ef`
- Left side:
  - Section name: `font-size: 14px`, `font-weight: 700`, `color: #1a1a2e` — e.g. `"Section A"`
  - Sublabel: `font-size: 12px`, `color: #8b8fa3`, `margin-top: 2px` — e.g. `"Morning schedule"` or `"Schedule TBA"`
- Right side: Instructor name — `font-size: 13px`, `font-weight: 500`, `color: #5a5d7a`

#### Meeting Rows

Each offering group contains multiple meeting rows of different **roles**:

| Role         | Type Codes                            | Behavior                                          |
| ------------ | ------------------------------------- | ------------------------------------------------- |
| `anchor`     | LE (Lecture)                          | Static, not clickable, bg `#f8fafd`, no radio     |
| `selectable` | DI (Discussion), LA (Lab)             | Clickable, has radio button, user must select one |
| `info`       | FI (Final), MI (Midterm), RE (Review) | Static, dimmed (`opacity: 0.55`), not clickable   |

**Row layout**: `display: flex`, `align-items: center`, `gap: 10px`, `padding: 9px 18px`, `border-bottom: 1px solid #f3f4f7`

**Section separators** appear between role transitions (e.g. anchor → selectable):

- `padding: 10px 18px 5px 54px`, `font-size: 10.5px`, `font-weight: 600`, `color: #8b8fa3`, `text-transform: uppercase`, `letter-spacing: 0.07em`
- Label: `"Choose discussion"` (when transitioning to selectable rows)
- `border-top: 1px solid #eeeff3`

**Row cells** (left to right):

1. **Radio / Spacer** (18×18px):
   - Selectable rows: radio circle `16×16px`, `border-radius: 50%`
     - Unselected: `border: 2px solid #c5c8d6`, `background: #fff`
     - Selected: `border: 2px solid #1a56db`, `background: #1a56db`, `box-shadow: inset 0 0 0 3px #fff`
   - Non-selectable: empty spacer

2. **Type Badge + Label** (`width: 100px`):
   - Badge: `padding: 2px 7px`, `border-radius: 4px`, `font-size: 10.5px`, `font-weight: 700`, `letter-spacing: 0.04em`
   - Badge colors by type:

   | Type                 | Background | Text Color |
   | -------------------- | ---------- | ---------- |
   | LE                   | `#dbeafe`  | `#1e40af`  |
   | DI                   | `#dcfce7`  | `#166534`  |
   | LA                   | `#ede9fe`  | `#5b21b6`  |
   | FI/MI                | `#fef9c3`  | `#854d0e`  |
   | RE                   | `#f3f4f6`  | `#4b5563`  |
   | (info role override) | `#f0f0f2`  | `#777`     |
   - Label: `font-size: 12px`, `color: #8b8fa3`, `font-weight: 500` — e.g. `"Lecture"`, `"Discussion"`, `"Final"`

3. **Section Code** (`width: 44px`): `font-size: 13px`, `font-weight: 600`, `color: #33354d`

4. **Day Dots + Time** (`flex: 1`):
   - Day dots in modal are slightly larger: `22×19px`, `border-radius: 4px`, `font-size: 9.5px`, `gap: 2px`
   - Same active/inactive colors as list view
   - Time: `font-size: 13px`, `font-weight: 500`, `color: #33354d`

5. **Location** (`width: 80px`): `font-size: 12.5px`, `color: #5a5d7a`

6. **Availability** (`min-width: 68px`): `font-size: 11.5px`, `font-weight: 600`, `text-align: right`
   - Available: `color: #9a9db4` — e.g. `"87 seats"`
   - Full: `color: #dc2626` — e.g. `"FULL · WL(1)"`

**Selected row styling**:

- `background: #edf4ff`
- `border-left: 3px solid #1a56db` (replaces transparent 3px border)
- Hover: stays `#edf4ff`

**Selectable row hover** (not selected): `background: #eef4ff`

#### Add to Worksheet Button

Appears at card bottom **only when a selectable row (e.g. Discussion) has been chosen**:

- Container: `padding: 14px 18px`, `border-top: 1px solid #eeeff3`, `background: #fafbff`
- Button: `width: 100%`, `padding: 11px 16px`, `background: #1a56db`, `color: #fff`, `border-radius: 8px`
- `font-size: 13.5px`, `font-weight: 600`
- Plus icon (14×14px) before text
- Hover: `background: #1548b8`
- Label format: `"Add A00 + A01 to Worksheet"` (lecture section + selected discussion section)

#### No Selection Hint

Appears instead of the Add button **when no selectable row has been chosen**:

- `padding: 12px 18px`, `border-top: 1px solid #f3f4f7`, `text-align: center`
- `font-size: 12.5px`, `color: #9a9db4`
- Text: `"Select a discussion section to add this group"`

---

## Interactions & Behavior

### Catalog List View

| #   | Interaction                        | Behavior                                                                                                               |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **Search**                         | Filters courses by code, title, instructor, or description. Updates result count.                                      |
| 2   | **Filter dropdown click**          | Opens popover with checkboxes (Subject, Areas/Skills). Not fully implemented in prototype — build as dropdown/popover. |
| 3   | **Active filter chip ×**           | Removes that filter and refreshes results.                                                                             |
| 4   | **Reset button**                   | Clears all active filters.                                                                                             |
| 5   | **Column header click** (sortable) | Sorts table by that column. Toggle ascending/descending.                                                               |
| 6   | **Single-section row click**       | Opens Course Detail Modal for that course.                                                                             |
| 7   | **Multi-section badge click**      | Toggles expand/collapse of child sections. Chevron rotates.                                                            |
| 8   | **Multi-section title click**      | Opens Course Detail Modal for that course.                                                                             |
| 9   | **Sub-row click**                  | Opens Course Detail Modal with that section pre-selected (active pill).                                                |
| 10  | **+ button click**                 | Adds the specific section to the worksheet. Should `stopPropagation` to not trigger row click.                         |
| 11  | **FAB button**                     | Navigates to calendar/worksheet view.                                                                                  |
| 12  | **Row hover**                      | Background changes to `#f4f6fa` with `0.1s` transition.                                                                |

### Course Detail Modal

| #   | Interaction                            | Behavior                                                                                     |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Backdrop click**                     | Closes the modal.                                                                            |
| 2   | **Close (×) button**                   | Closes the modal.                                                                            |
| 3   | **Section pill click**                 | Switches the active section. Highlights the corresponding offering group card (blue border). |
| 4   | **Tab click** (Overview / Past Grades) | Switches modal content tab. Only Overview is designed; Past Grades is a placeholder.         |
| 5   | **Prerequisites chip click**           | Toggles the prerequisites detail panel open/closed. Chevron rotates.                         |
| 6   | **Prerequisites panel × click**        | Collapses the prerequisites panel.                                                           |
| 7   | **Catalog chip click**                 | Opens course in university catalog (external link).                                          |
| 8   | **Discussion row click**               | Selects that discussion via radio button. Enables the "Add to Worksheet" button.             |
| 9   | **Add to Worksheet button**            | Adds the lecture + selected discussion combination to the user's worksheet.                  |
| 10  | **Header action buttons**              | + (quick add), Share, More (...) — hook up as needed.                                        |

### Keyboard & Accessibility

- `Escape` key should close the modal.
- Focus trap inside the modal when open.
- Radio buttons should be keyboard-navigable (arrow keys to switch, Enter/Space to select).
- All interactive elements need proper `aria-label` attributes.

---

## State Management

### Catalog List View State

```typescript
interface CatalogState {
  // Search & Filters
  searchQuery: string;
  activeFilters: {
    subject: string[];
    areasSkills: string[];
    term: string | null;
    level: string | null;
    // ... other filter dimensions
  };

  // Sort
  sortColumn: 'code' | 'title' | 'meets' | null;
  sortDirection: 'asc' | 'desc';

  // Expand/Collapse (multi-section courses)
  expandedCourses: Record<string | number, boolean>; // courseId → expanded

  // Modal
  modalOpen: boolean;
  modalCourseId: string | null; // which course to show
  modalActiveSection: string | null; // which section tab is active (e.g. "A00")
}
```

### Course Detail Modal State

```typescript
interface ModalState {
  // Section navigation (multi-section courses)
  activeSection: string; // e.g. "A00", "B00"

  // Discussion selection per offering group
  selectedDiscussions: Record<string, string | null>; // groupId → selected section code
  // e.g. { "A": "A01", "B": null }

  // UI toggles
  prereqExpanded: boolean;
  activeTab: 'overview' | 'pastGrades';
}
```

### State Transitions

1. **Row click → Modal open**: Set `modalOpen: true`, `modalCourseId`, `modalActiveSection` (default to first section or the clicked sub-row's section)
2. **Section pill click**: Update `activeSection`, which controls card highlight
3. **Discussion radio click**: Update `selectedDiscussions[groupId]` to the clicked section code
4. **Expand toggle**: Flip `expandedCourses[courseId]`
5. **Modal close**: Set `modalOpen: false`

---

## Data Model

### Course

```typescript
interface Course {
  code: string; // e.g. "CSE 110"
  title: string; // e.g. "Software Engineering"
  description: string; // Full course description text
  units: number; // e.g. 4
  level: string; // e.g. "Upper Division"
  prerequisites?: string; // Prerequisite text
  deptStampRequired?: boolean;
  sections: Section[];
}

interface Section {
  id: string; // e.g. "A00", "B01"
  instructor: string; // e.g. "Powell, Thomas Allan"
  meets: string; // e.g. "MTWTh 8:00am–9:20am" or "TBA"
  location: string; // e.g. "RWAC 0103" or "TBA"
  enrolled: number;
  total: number; // seat capacity
  // In the modal, sections are grouped into offering groups,
  // each containing an LE (lecture) + DI (discussion) rows + FI (final)
}

// For the modal's richer schedule view:
interface OfferingGroup {
  id: string; // e.g. "A", "B"
  headerLabel: string; // e.g. "Section A"
  headerSublabel: string; // e.g. "Morning schedule"
  instructor: string;
  meetings: Meeting[];
}

interface Meeting {
  type: 'LE' | 'DI' | 'LA' | 'FI' | 'MI' | 'RE';
  label: string; // e.g. "Lecture", "Discussion", "Final"
  section: string; // e.g. "A00", "A01", "12/09"
  days: string; // e.g. "MTWTh", "W", ""
  time: string; // e.g. "8:00am–9:20am", "TBA"
  location: string;
  role: 'anchor' | 'selectable' | 'info';
  availability?: string; // e.g. "87 seats", "FULL · WL(1)"
}
```

---

## Sample Data

The prototype includes 12 courses. Here's the full dataset used:

```json
[
  {
    "code": "CSE 100",
    "title": "Advanced Data Structures",
    "sections": [
      {
        "id": "A00",
        "instructor": "Gillespie, Gary N.",
        "meets": "MTWTh 11:00am–12:20pm",
        "location": "CENTR 109",
        "enrolled": 38,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 105",
    "title": "Theory of Computability",
    "sections": [
      {
        "id": "A00",
        "instructor": "Minnes, Mia",
        "meets": "MTWTh 9:30am–10:50am",
        "location": "WLH 2001",
        "enrolled": 12,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 110",
    "title": "Software Engineering",
    "sections": [
      {
        "id": "A00",
        "instructor": "Powell, Thomas Allan",
        "meets": "MTWTh 2:00pm–3:20pm",
        "location": "PCYNH 106",
        "enrolled": 45,
        "total": 50
      },
      {
        "id": "B00",
        "instructor": "Ochoa, Benjamin L.",
        "meets": "MW 6:30pm–7:50pm",
        "location": "GH 242",
        "enrolled": 22,
        "total": 50
      },
      {
        "id": "C00",
        "instructor": "Powell, Thomas Allan",
        "meets": "TTh 3:30pm–4:50pm",
        "location": "CENTR 109",
        "enrolled": 31,
        "total": 50
      },
      {
        "id": "D00",
        "instructor": "Ochoa, Benjamin L.",
        "meets": "MWF 10:00am–10:50am",
        "location": "WLH 2001",
        "enrolled": 48,
        "total": 50
      },
      {
        "id": "E00",
        "instructor": "Staff",
        "meets": "TBA",
        "location": "TBA",
        "enrolled": 0,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 120",
    "title": "Principles of Computer Operating Systems",
    "sections": [
      {
        "id": "A00",
        "instructor": "Voelker, Geoffrey M.",
        "meets": "TTh 12:30pm–1:50pm",
        "location": "CENTR 115",
        "enrolled": 35,
        "total": 45
      },
      {
        "id": "B00",
        "instructor": "Pasquale, Joseph C.",
        "meets": "MWF 3:00pm–3:50pm",
        "location": "WLH 2001",
        "enrolled": 18,
        "total": 45
      },
      {
        "id": "C00",
        "instructor": "Voelker, Geoffrey M.",
        "meets": "TTh 5:00pm–6:20pm",
        "location": "PCYNH 106",
        "enrolled": 40,
        "total": 45
      }
    ]
  },
  {
    "code": "CSE 130",
    "title": "Programming Languages",
    "sections": [
      {
        "id": "A00",
        "instructor": "Jhala, Ranjit",
        "meets": "MWF 1:00pm–1:50pm",
        "location": "YORK 2622",
        "enrolled": 28,
        "total": 40
      },
      {
        "id": "B00",
        "instructor": "Lerner, Sorin",
        "meets": "TTh 9:30am–10:50am",
        "location": "CENTR 109",
        "enrolled": 15,
        "total": 40
      }
    ]
  },
  {
    "code": "CSE 131",
    "title": "Compiler Construction",
    "sections": [
      {
        "id": "A00",
        "instructor": "Politz, Joe Gibbs",
        "meets": "TTh 3:30pm–4:50pm",
        "location": "RWAC 0103",
        "enrolled": 33,
        "total": 40
      }
    ]
  },
  {
    "code": "CSE 132A",
    "title": "Database System Principles",
    "sections": [
      {
        "id": "A00",
        "instructor": "Deutsch, Alin",
        "meets": "MTWTh 8:00am–9:20am",
        "location": "CENTR 109",
        "enrolled": 42,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 134B",
    "title": "Web Client Languages",
    "sections": [
      {
        "id": "A01",
        "instructor": "Powell, Thomas Allan",
        "meets": "MTWTh 8:00am–9:20am",
        "location": "RWAC 0103",
        "enrolled": 25,
        "total": 35
      }
    ]
  },
  {
    "code": "CSE 199",
    "title": "Independent Study for Undergraduates",
    "sections": [
      {
        "id": "001",
        "instructor": "Staff",
        "meets": "TBA",
        "location": "TBA",
        "enrolled": 3,
        "total": 20
      }
    ]
  },
  {
    "code": "CSE 140",
    "title": "Components & Design for Digital Systems",
    "sections": [
      {
        "id": "A00",
        "instructor": "Swanson, Steven",
        "meets": "MWF 10:00am–10:50am",
        "location": "WLH 2001",
        "enrolled": 47,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 141",
    "title": "Intro to Computer Architecture",
    "sections": [
      {
        "id": "A00",
        "instructor": "Porter, Leo R.",
        "meets": "TTh 9:30am–10:50am",
        "location": "CENTR 115",
        "enrolled": 30,
        "total": 50
      }
    ]
  },
  {
    "code": "CSE 150A",
    "title": "Introduction to AI: Probabilistic Reasoning",
    "sections": [
      {
        "id": "A00",
        "instructor": "Dasgupta, Sanjoy",
        "meets": "MWF 2:00pm–2:50pm",
        "location": "PCYNH 106",
        "enrolled": 36,
        "total": 50
      },
      {
        "id": "B00",
        "instructor": "Eldridge, Justin",
        "meets": "TTh 5:00pm–6:20pm",
        "location": "WLH 2001",
        "enrolled": 19,
        "total": 50
      }
    ]
  }
]
```

### Modal-Specific Data (CSE 134B Example — with LE + DI + FI structure)

```json
[
  {
    "id": "A",
    "headerLabel": "Section A",
    "headerSublabel": "Morning schedule",
    "instructor": "Powell, Thomas Allan",
    "meetings": [
      {
        "type": "LE",
        "label": "Lecture",
        "section": "A00",
        "days": "MTWTh",
        "time": "8:00am–9:20am",
        "loc": "RWAC 0103",
        "role": "anchor"
      },
      {
        "type": "DI",
        "label": "Discussion",
        "section": "A01",
        "days": "W",
        "time": "10:00am–11:50am",
        "loc": "RWAC 0103",
        "role": "selectable",
        "avail": "FULL · WL(1)"
      },
      {
        "type": "DI",
        "label": "Discussion",
        "section": "A02",
        "days": "F",
        "time": "2:00pm–3:50pm",
        "loc": "CENTR 115",
        "role": "selectable",
        "avail": "87 seats"
      },
      {
        "type": "FI",
        "label": "Final",
        "section": "12/09",
        "days": "Tu",
        "time": "8:00am–10:59am",
        "loc": "RWAC 0103",
        "role": "info"
      }
    ]
  },
  {
    "id": "B",
    "headerLabel": "Section B",
    "headerSublabel": "Evening schedule",
    "instructor": "Ochoa, Benjamin L.",
    "meetings": [
      {
        "type": "LE",
        "label": "Lecture",
        "section": "B00",
        "days": "MW",
        "time": "6:30pm–7:50pm",
        "loc": "GH 242",
        "role": "anchor"
      },
      {
        "type": "DI",
        "label": "Discussion",
        "section": "B01",
        "days": "Th",
        "time": "8:00pm–8:50pm",
        "loc": "GH 242",
        "role": "selectable",
        "avail": "87 seats"
      },
      {
        "type": "DI",
        "label": "Discussion",
        "section": "B02",
        "days": "",
        "time": "TBA",
        "loc": "TBA",
        "role": "selectable"
      },
      {
        "type": "FI",
        "label": "Final",
        "section": "12/08",
        "days": "M",
        "time": "7:00pm–9:59pm",
        "loc": "GH 242",
        "role": "info"
      }
    ]
  }
]
```

---

## Utility Functions to Implement

### Day String Parser

Parse meeting day strings (e.g. `"MTWTh"`, `"TTh"`, `"MWF"`) into individual day flags for the 5-day display.

```
Input:  "MTWTh"
Output: { M: true, Tu: false, W: true, Th: true, F: false }
```

**Key rule**: Two-character days `Tu` and `Th` take priority. A lone `T` maps to Tuesday.

### Time Formatter

Convert raw time strings to display format:

```
Input:  "11:00am–12:20pm"
Output: "11:00 AM – 12:20 PM"

Input:  "2:00pm–3:20pm"    (same period)
Output: "2:00 – 3:20 PM"

Input:  "TBA"
Output: "TBA"
```

### Seats Color Logic

```
percentage = enrolled / total * 100

if percentage >= 90:
  textColor = "#be123c", barColor = "#e8446a"    // danger
elif percentage >= 60:
  textColor = "#33354d", barColor = "#1a56db"    // filling
else:
  textColor = "#166534", barColor = "#22c55e"    // available
```

---

## Files in This Package

| File                              | Description                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `README.md`                       | This handoff document                                                               |
| `Catalog List View-New.dc.html`   | Full interactive prototype of the catalog list page + embedded modal                |
| `Course Detail Modal-New.dc.html` | Standalone Course Detail Modal prototype (CSE 134B example with LE+DI+FI structure) |
| `support.js`                      | Runtime required to open `.dc.html` files in a browser                              |

### How to preview

Open either `.dc.html` file directly in a browser. They are self-contained interactive prototypes.

- **`Catalog List View-New.dc.html`**: Full page with table rows. Click any row to open the modal. Click the "5 sections" badge on CSE 110 to see expand/collapse.
- **`Course Detail Modal-New.dc.html`**: Standalone modal showing the richer offering group structure with radio selection for discussions, prerequisites panel, and availability labels.

---

## Implementation Notes

1. **Two modal variants exist**: The catalog list view has a simpler modal (LE-only sections, section pills for multi-section courses). The standalone modal file shows the richer structure with LE + DI + FI rows and radio selection. **Use the standalone modal as the canonical, more complete design** — it represents the full feature set.

2. **Day dots are reused** in both the list view and modal, but with slightly different sizes (17×15px in list, 22×19px in modal).

3. **The expanded multi-section rows** have a `max-height: 132px` scrollable container for sub-rows. This accommodates ~3 visible rows before scrolling.

4. **Section pills** in the modal header only appear for courses with multiple sections. They let users quickly switch context between offering groups.

5. **The "Add to Worksheet" flow**: User must first select a Discussion (DI) row via radio button. Only then does the button appear. The button label dynamically shows both the lecture and discussion codes: `"Add A00 + A01 to Worksheet"`.

6. **Courses with single sections** (like CSE 100, CSE 105) show a simpler modal without section pills or radio selection — just a single offering group with a direct "Add to Worksheet" button.

7. **The FAB button** (blue circle, bottom-right) is a navigation shortcut to the worksheet/calendar view.
