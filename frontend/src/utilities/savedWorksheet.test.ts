import { describe, expect, it } from 'vitest';

import {
  buildSaveAnonymousWorksheetPayload,
  canSaveAnonymousWorksheet,
  getDefaultSavedWorksheetName,
  type SavedWorksheetAuthStatus,
} from './savedWorksheet';
import type { Season } from '../queries/graphql-types';

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
  });

  it('preserves anonymous worksheet fields for the save payload', () => {
    expect(
      buildSaveAnonymousWorksheetPayload('  My worksheet  ', {
        term: testTerm,
        courses: [
          { sectionId: 'FA26-123', color: '#55aaff', hidden: false },
          { sectionId: 'FA26-456', color: '#ee6677', hidden: true },
        ],
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
});
