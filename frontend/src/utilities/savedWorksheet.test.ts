import { describe, expect, it } from 'vitest';

import {
  buildSaveAnonymousWorksheetPayload,
  buildRestoredAnonymousWorksheet,
  canRestoreSavedWorksheet,
  canSaveAnonymousWorksheet,
  getDefaultSavedWorksheetName,
  resolveSavedWorksheetCourses,
  type SavedWorksheetAuthStatus,
} from './savedWorksheet';
import type { Season } from '../queries/graphql-types';
import { createCoursePlanningListingFixture } from '../testFixtures/coursePlanningListing';

const testTerm = 'FA26' as Season;

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

  it('restores saved worksheets through owned Course Planning listings and reports missing Section IDs', () => {
    const cse = createCoursePlanningListingFixture(
      'FA26:CSE-TRACER-3',
      'CSE 3',
    );
    const worksheet = {
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
    };

    const restored = resolveSavedWorksheetCourses(
      worksheet,
      new Map([[cse.section.sectionId, cse]]),
    );

    expect(restored.missingSectionIds).toEqual(['FA26:STALE-404']);
    expect(restored.courses).toHaveLength(1);
    expect(restored.courses[0]).toMatchObject({
      color: '#55aaff',
      hidden: false,
      listing: {
        section_id: 'FA26:CSE-TRACER-3',
        course_code: 'CSE 3',
      },
    });
  });
});
