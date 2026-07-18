import { describe, expect, it } from 'vitest';

import { getCatalogConflictCourses } from './catalogWorksheetContext';
import type { SavedWorksheet } from '../queries/api';
import type { WorksheetCourse } from '../types/worksheetCourse';

const activeWorksheetCourses = [{ crn: 1 }] as WorksheetCourse[];
const legacyCourses = [{ crn: 2 }] as WorksheetCourse[];

describe('Catalog worksheet context', () => {
  it('uses active worksheet courses for Saved Worksheet conflict filtering', () => {
    expect(
      getCatalogConflictCourses(
        false,
        { id: 1 } as SavedWorksheet,
        activeWorksheetCourses,
        legacyCourses,
      ),
    ).toBe(activeWorksheetCourses);
  });

  it('uses active worksheet courses for anonymous conflict filtering', () => {
    expect(
      getCatalogConflictCourses(
        true,
        undefined,
        activeWorksheetCourses,
        legacyCourses,
      ),
    ).toBe(activeWorksheetCourses);
  });

  it('keeps inherited worksheet conflict filtering behind legacy data', () => {
    expect(
      getCatalogConflictCourses(
        false,
        undefined,
        activeWorksheetCourses,
        legacyCourses,
      ),
    ).toBe(legacyCourses);
  });
});
