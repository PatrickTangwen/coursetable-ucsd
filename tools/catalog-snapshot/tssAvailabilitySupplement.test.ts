import { describe, expect, it } from 'vitest';

import {
  applyTssAvailabilitySupplement,
  parseTssAvailabilitySupplement,
} from './tssAvailabilitySupplement';

describe('TSS availability supplement parser', () => {
  it('normalizes mixed CSV and tab-delimited blocks', () => {
    const records = parseTssAvailabilitySupplement(`
Subject,Course,Section,Type,Instructor,Seats_Total,Seats_Available
CAT,001,001-000-LE,lecture,Phoebe Bronstein,256,216

Subject\tCourse\tSection Code\tSection Name\tSeats Available\tEnrollment\u202fLimit\tStatus
PH\t045\t001‑000‑LE\tPH 045\t120\t140\tAC

Subject,Course,SectionCode,InstructionType,EnrollmentLimit,Enrolled,SeatsAvailable
POLI,102G,001-000-LE,lecture,104,4,100
`);

    expect(records).toEqual([
      {
        subject: 'CAT',
        course: '1',
        sectionCode: '001-000-LE',
        capacity: 256,
        enrolled: 40,
        availableSeats: 216,
        line: 3,
      },
      {
        subject: 'PH',
        course: '45',
        sectionCode: '001-000-LE',
        capacity: 140,
        enrolled: 20,
        availableSeats: 120,
        line: 6,
      },
      {
        subject: 'POLI',
        course: '102G',
        sectionCode: '001-000-LE',
        capacity: 104,
        enrolled: 4,
        availableSeats: 100,
        line: 9,
      },
    ]);
  });

  it('rejects internally inconsistent enrollment values', () => {
    expect(() =>
      parseTssAvailabilitySupplement(`
Subject,Course,SectionCode,EnrollmentLimit,Enrolled,SeatsAvailable
CAT,001,001-000-LE,100,20,90
`),
    ).toThrow('line 3 enrollment values are inconsistent');
  });

  it('rejects malformed data rows instead of silently dropping them', () => {
    expect(() =>
      parseTssAvailabilitySupplement(`
Subject,Course,Section,Type,Instructor,Seats_Total,Seats_Available
CAT,001
`),
    ).toThrow('line 3 has 2 columns; expected at least 7');

    expect(() =>
      parseTssAvailabilitySupplement(`
Subject,Course,Section,Type,Instructor,Seats_Total,Seats_Available
C@T,001,001-000-LE,lecture,Instructor,100,20
`),
    ).toThrow('line 3 has invalid subject: C@T');
  });

  it('skips explicit notes and ellipsis placeholders between data blocks', () => {
    const records = parseTssAvailabilitySupplement(`
Subject\tCourse\tSection Code\tSection Name\tSeats Available\tEnrollment Limit\tStatus
Notes
Seats Available reflects the number of open seats at extract time.
…\t…\t…\t…\t…\t…\t…
PH\t045\t001-000-LE\tPH 045\t120\t140\tAC
`);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ subject: 'PH', course: '45' });
  });

  it('uses matched supplement values as authoritative and audits unmatched rows', () => {
    const records = parseTssAvailabilitySupplement(`
Subject,Course,Section,Type,Instructor,Seats_Total,Seats_Available
LTWL,500,001-000-DI,discussion,Andrea Mendoza,9999,9999
MUS,095G,002-000-ST,studio,Kenneth Anderson,395,395
`);
    const result = applyTssAvailabilitySupplement(
      [
        {
          courses: [
            {
              course_code: '500',
              tss_course_code: 'LTWL-500',
              booking_choices: [
                {
                  components: [
                    {
                      section_code: '001-000-DI',
                      enrollment: {
                        enrolled: 9999,
                        capacity: null,
                        seats_available: null,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      records,
    );

    expect(result).toMatchObject({
      records: 2,
      matchedRecords: 1,
      updatedComponents: 1,
      overriddenValues: 1,
      unmatchedRecords: 1,
      unmatchedKeys: ['MUS:95G:002-000-ST'],
      overrides: [
        {
          key: 'LTWL:500:001-000-DI',
          field: 'enrolled',
          current: 9999,
          next: 0,
        },
      ],
      responses: [
        {
          courses: [
            {
              booking_choices: [
                {
                  components: [
                    {
                      enrollment: {
                        enrolled: 0,
                        capacity: 9999,
                        seats_available: 9999,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
