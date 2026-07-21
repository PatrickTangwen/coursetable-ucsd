import { describe, expect, it } from 'vitest';

import { displayedArchiveGpa } from './UcsdSnapshotGradeDistribution';
import type { CoursePlanningPastGrade } from '../../queries/coursePlanningViewModels';

function gradeRecord(
  overrides: Partial<CoursePlanningPastGrade>,
): CoursePlanningPastGrade {
  return {
    subject: 'AWP',
    course: '4A',
    year: '26',
    quarter: 'WI',
    title: 'Analytical Writing A',
    instructor: 'Test Instructor',
    gpa: 0,
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    f: 0,
    w: 0,
    p: 96.7,
    np: 3.3,
    raw: {},
    ...overrides,
  };
}

describe('Past Grades GPA display', () => {
  it('treats the archive zero sentinel as unavailable for P/NP-only records', () => {
    expect(displayedArchiveGpa(gradeRecord({}))).toBeNull();
  });

  it('keeps a real zero GPA when letter grades are present', () => {
    expect(displayedArchiveGpa(gradeRecord({ f: 100, p: 0, np: 0 }))).toBe(0);
  });

  it('keeps regular letter-grade GPAs', () => {
    expect(
      displayedArchiveGpa(
        gradeRecord({ gpa: 2.949, a: 20, b: 40, c: 30, f: 10, p: 0, np: 0 }),
      ),
    ).toBe(2.949);
  });

  it('does not reinterpret a nonzero GPA from the archive', () => {
    expect(displayedArchiveGpa(gradeRecord({ gpa: 3.5 }))).toBe(3.5);
  });
});
