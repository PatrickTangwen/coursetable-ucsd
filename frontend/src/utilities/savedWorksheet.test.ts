import { describe, expect, it } from 'vitest';

import { resolveLegacyWorksheet } from './legacyAnonymousWorksheet';
import {
  buildSaveAnonymousWorksheetPayload,
  buildRestoredAnonymousWorksheet,
  canRestoreSavedWorksheet,
  canSaveAnonymousWorksheet,
  getDefaultSavedWorksheetName,
  type SavedWorksheetAuthStatus,
} from './savedWorksheet';
import type { CatalogListing } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';

const testTerm = 'FA26' as Season;

function createListing({ crn, sectionId }: { crn: number; sectionId: string }) {
  return {
    crn: crn as Crn,
    course_code: sectionId.includes('MATH') ? 'MATH 20A' : 'CSE 3',
    number: sectionId.includes('MATH') ? '20A' : '3',
    school: 'UCSD',
    subject: sectionId.includes('MATH') ? 'MATH' : 'CSE',
    section_id: sectionId,
    course: {
      season_code: testTerm,
      same_course_id: crn,
      listings: [
        {
          crn: crn as Crn,
          section_id: sectionId,
        },
      ],
    },
  } as unknown as CatalogListing;
}

describe('saved worksheet helpers', () => {
  it('builds the default saved worksheet name from the term', () => {
    expect(getDefaultSavedWorksheetName(testTerm)).toBe('FA26 Worksheet');
  });

  it('gates protected saved worksheet APIs to signed-in users', () => {
    const statuses = new Map<SavedWorksheetAuthStatus, boolean>([
      ['unauthenticated', false],
      ['loading', false],
      ['initializing', false],
      ['authenticated', true],
    ]);

    for (const [status, expected] of statuses)
      expect(canSaveAnonymousWorksheet(status)).toBe(expected);
    for (const [status, expected] of statuses)
      expect(canRestoreSavedWorksheet(status)).toBe(expected);
  });

  it('preserves anonymous worksheet fields for the save payload', () => {
    expect(
      buildSaveAnonymousWorksheetPayload('  My worksheet  ', {
        term: testTerm,
        coursesByTerm: {
          FA26: [
            { sectionId: 'FA26-123', color: '#55aaff', hidden: false },
            { sectionId: 'FA26-456', color: '#ee6677', hidden: true },
          ],
        },
      }),
    ).toEqual({
      name: 'My worksheet',
      term: 'FA26',
      courses: [
        { sectionId: 'FA26-123', color: '#55aaff', hidden: false },
        { sectionId: 'FA26-456', color: '#ee6677', hidden: true },
      ],
    });
  });

  it('builds anonymous worksheet state from a saved worksheet detail', () => {
    expect(
      buildRestoredAnonymousWorksheet({
        id: 12,
        name: 'Saved Plan',
        term: testTerm,
        createdAt: 1,
        updatedAt: 2,
        private: true,
        sourceSectionCount: 3,
        savedSectionCount: 2,
        sections: [
          { sectionId: 'FA26:CSE-TRACER-3', color: '#55aaff', hidden: false },
          { sectionId: 'FA26:MATH-TRACER-2', color: '#ee6677', hidden: true },
        ],
      }),
    ).toEqual({
      term: testTerm,
      coursesByTerm: {
        FA26: [
          { sectionId: 'FA26:CSE-TRACER-3', color: '#55aaff', hidden: false },
          { sectionId: 'FA26:MATH-TRACER-2', color: '#ee6677', hidden: true },
        ],
      },
    });
  });

  it('restores saved worksheets through the Catalog Snapshot and reports missing Section IDs', () => {
    const cse = createListing({
      crn: 101,
      sectionId: 'FA26:CSE-TRACER-3',
    });
    const catalog = new Map<Crn, CatalogListing>([[cse.crn, cse]]);
    const worksheet = buildRestoredAnonymousWorksheet({
      id: 12,
      name: 'Saved Plan',
      term: testTerm,
      createdAt: 1,
      updatedAt: 2,
      private: true,
      sourceSectionCount: 2,
      savedSectionCount: 2,
      sections: [
        { sectionId: 'FA26:CSE-TRACER-3', color: '#55aaff', hidden: false },
        { sectionId: 'FA26:STALE-404', color: '#ee6677', hidden: true },
      ],
    });

    const restored = resolveLegacyWorksheet(worksheet, catalog);

    expect(restored.missingSectionIds).toEqual(['FA26:STALE-404']);
    expect(restored.worksheets.get(testTerm)?.get(0)?.courses).toEqual([
      {
        crn: 101,
        color: '#55aaff',
        hidden: false,
        sameCourseId: 101,
      },
    ]);
  });
});
