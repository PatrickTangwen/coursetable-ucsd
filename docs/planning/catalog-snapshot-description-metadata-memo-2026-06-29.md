# Catalog Snapshot Description Metadata Memo

Date: 2026-06-29

Status: implementation memo for the UCSD catalog snapshot description metadata
rules. This records the source behavior observed while fixing missing
descriptions in `api/static/catalogs/public/*.json`.

## Context

Course modals do not fetch UCSD General Catalog descriptions live. They display
the `description` field already present in the published snapshot JSON served by:

- API route: `/api/catalog/public/:term`
- Files: `api/static/catalogs/public/*.json`
- Modal fallback text: `No description available.`

So missing modal descriptions usually mean the snapshot generation/enrichment
step did not attach General Catalog metadata to the schedule course row.

## Fixed Rules

The General Catalog parser now handles these source patterns:

1. Slash-R aliases

   UCSD General Catalog may write a course as `DSC 20/R`, while Schedule of
   Classes may expose `DSC:20` and/or `DSC:20R`.

   Parser rule:
   - `20/R` -> `20`
   - `20/R` -> `20R`
   - `40B/R` -> `40B`
   - `40B/R` -> `40BR`

2. Classless description paragraphs

   Most catalog descriptions are in:

   ```html
   <p class="course-descriptions">...</p>
   ```

   Some current catalog rows, such as DSC 40B/R, use a plain `<p>` after the
   `course-name` paragraph. The parser now takes the paragraph immediately after
   `course-name` as the description unless it is another course name or anchor.

3. Missing period after course number

   Some catalog rows are shaped like:

   ```text
   COMM 114M CSI: Communication and the Law (4)
   ```

   rather than:

   ```text
   COMM 114M. CSI: Communication and the Law (4)
   ```

   The parser accepts both.

4. Grouped subject code in parentheses

   Some grouped catalog pages write the display title before the subject code:

   ```text
   Linguistics/American Sign Language (LISL) 1A. ...
   ```

   The parser now reads the official subject code from the parentheses.

5. Cross-listed rows

   A single General Catalog row can represent multiple schedule course IDs.
   The parser now expands these patterns:
   - `BENG/BIMM/CSE 181` -> `BENG:181`, `BIMM:181`, `CSE:181`
   - `BENG 242/MATS 257/NANO 257` -> `BENG:242`, `MATS:257`, `NANO:257`
   - `CSE 256/LING 256` -> `CSE:256`, `LING:256`
   - `BENG 191/291` -> `BENG:191`, `BENG:291`

6. Anchor selection

   When multiple anchors precede one course row, the parser prefers the anchor
   matching `${subject}${courseNumber}`. Example:
   - `BENG:191` -> `#beng191`
   - `BENG:291` -> `#beng291`

## Code Touchpoints

- `tools/catalog-snapshot/generalCatalog.ts`
  - Parses UCSD General Catalog HTML.
  - Expands aliases and cross-listed rows.
  - Extracts description, prerequisites, restrictions, units, and catalog URL.

- `tools/catalog-snapshot/scheduleOfClasses.ts`
  - Normalizes schedule-side course numbers consistently with catalog-side `/R`
    handling.

- `tools/catalog-snapshot/generalCatalog.test.ts`
  - Covers `/R` aliases, classless description paragraphs, missing-period rows,
    grouped subject rows, cross-listed rows, and multi-number rows.

## Data Update Summary

After applying the parser fixes and targeted enrichment to existing published
snapshots:

- DSC `/R` examples such as `DSC:10R`, `DSC:20R`, `DSC:40AR`, `DSC:30R`,
  `DSC:40BR`, and `DSC:80R` now have General Catalog descriptions.
- Cross-listed examples such as `BENG:181`, `BENG:242`, `BENG:247A`,
  `CSE:256`, `MATS:257`, and `NANO:247A` were also filled where current General
  Catalog rows supported them.
- Remaining missing descriptions are currently:
  - `2789` term-course rows
  - `921` unique courses

Remaining unique-course breakdown:

| Category                | Count | Meaning                                                                           |
| ----------------------- | ----: | --------------------------------------------------------------------------------- |
| `no_catalog_url`        |   449 | Schedule of Classes did not provide a catalog link.                               |
| `registrar_cnd`         |   160 | Registrar points to `studentlink/cnd.html`.                                       |
| `other_url`             |    39 | Link points outside General Catalog, such as pharmacy pages.                      |
| `catalog_url_unmatched` |   273 | Catalog URL exists, but current catalog did not produce a matching described row. |

## Why Some Courses Still Cannot Be Filled

1. Registrar CND

   If the schedule link is `http://registrar.ucsd.edu/studentlink/cnd.html`, the
   registrar itself says the course is not described in the General Catalog.
   These should not be filled by guessing.

2. No catalog URL

   Many medical/professional/clinical courses have no General Catalog URL in the
   Schedule of Classes snapshot. Without another official source, the snapshot
   cannot faithfully attach a catalog description.

3. Non-General-Catalog URL

   Some courses point to non-catalog pages, for example pharmacy current-student
   pages. Those are not parsed by the General Catalog parser.

4. Current catalog mismatch

   Some old schedule rows have catalog anchors that no longer exist in the
   current General Catalog page. These may require historical catalog pages to
   fill accurately.

5. Official row has no description text

   Some official catalog rows exist but only contain prerequisites or standing
   requirements before the `Prerequisites:` label. Examples observed:
   - `CHEM:299`
   - `MATS:296`
   - `SE:296`

## Useful Audit Commands

Count remaining missing descriptions:

```bash
node --input-type=module - <<'NODE'
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'api/static/catalogs/public';
const rows = [];
const unique = new Map();

for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json')).sort()) {
  const term = file.replace('.json', '');
  const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
  for (const course of data.courses ?? []) {
    if (course.description && !/^No description available\.?$/u.test(course.description)) continue;
    rows.push({ term, course_id: course.course_id, subject: course.subject, title: course.title, catalog_url: course.catalog_url });
    if (!unique.has(course.course_id)) unique.set(course.course_id, course);
  }
}

console.log({ missing_rows: rows.length, missing_unique_courses: unique.size });
NODE
```

Verify a specific term/course after enrichment:

```bash
node --input-type=module - <<'NODE'
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile('api/static/catalogs/public/S126.json', 'utf8'));
const course = data.courses.find((row) => row.course_id === 'DSC:20R');
console.log({
  course_id: course?.course_id,
  title: course?.title,
  has_description: Boolean(course?.description),
  catalog_url: course?.catalog_url,
});
NODE
```

## Verification Commands Used

```bash
bun run test:snapshot
bun run typecheck
bun run lint:check
bun run format:check
```

`lint:check` currently passes with existing repository warnings unrelated to the
snapshot description parser work.
