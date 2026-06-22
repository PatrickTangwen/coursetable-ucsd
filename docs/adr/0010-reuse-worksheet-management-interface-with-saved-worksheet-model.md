# Reuse Worksheet Management Interface With Saved Worksheet Model

UCSD Saved Worksheet Management should reuse the familiar CourseTable worksheet
management interface pattern, including the top worksheet selector, create,
rename, delete, and compact Summary layout, but new UCSD product logic must use
the Saved Worksheet model owned by App User ID and Section IDs. We are not
reviving the legacy CourseTable `worksheetNumber`/`netId`/`crn` ownership model,
because that would conflict with the Beta-1 UCSD identity and App DB decisions.

**Considered Options**

- Reuse the existing `WorksheetNumberDropdown` and legacy worksheet APIs
  directly.
- Build a UCSD Saved Worksheet dropdown and management flow that borrows the
  original interface pattern while using `savedWorksheets` APIs.

The second option keeps the user experience familiar without reintroducing Yale
data semantics into the UCSD planner.

**UI Reuse Guidance**

Implementation should reuse existing CourseTable UI interaction components,
styling, and behavior wherever they fit the UCSD Saved Worksheet model. New UI
components should be introduced only when the existing interaction is coupled to
legacy worksheet-number APIs, Yale-specific semantics, or unsupported product
surfaces.
