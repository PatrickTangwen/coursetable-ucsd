import { describe, expect, it } from 'vitest';
import {
  checkConflict,
  formatWorksheetSectionSuffix,
  getWorksheetConflicts,
  shouldHideConflictingListing,
} from './course';
import type { CatalogListing } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';
import { legacyCatalogListingToWorksheetViewModel } from '../types/legacyWorksheetCourse';
import type { WorksheetCourse } from '../types/worksheetCourse';

type Meeting = {
  days_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
};

const dayMask = (...days: number[]) =>
  days.reduce((mask, day) => mask | (1 << day), 0);

function makeListing({
  courseCode,
  crn,
  meetings,
  season = 'FA26' as Season,
}: {
  courseCode: string;
  crn: number;
  meetings: Meeting[];
  season?: Season;
}): CatalogListing {
  const [subject = 'CSE', number = '1'] = courseCode.split(' ');
  return {
    crn: crn as Crn,
    course_code: courseCode,
    number,
    school: 'UCSD',
    subject,
    course: {
      season_code: season,
      title: `${courseCode} title`,
      section: 'A00',
      course_meetings: meetings,
      listings: [
        {
          crn: crn as Crn,
          course_code: courseCode,
          school: 'UCSD',
          subject,
        },
      ],
    },
  } as unknown as CatalogListing;
}

function worksheetCourse(listing: CatalogListing): WorksheetCourse {
  return {
    crn: listing.crn,
    color: '#123456',
    listing: legacyCatalogListingToWorksheetViewModel(listing),
    hidden: false,
  };
}

describe('course conflict detection', () => {
  it('shows UCSD worksheet section codes without changing legacy section suffixes', () => {
    expect(
      formatWorksheetSectionSuffix({
        school: 'UCSD',
        course: { section: 'A01' },
      }),
    ).toBe(' A01');
    expect(
      formatWorksheetSectionSuffix({
        school: 'YC',
        course: { section: 'A' },
      }),
    ).toBe(' 0A');
    expect(
      formatWorksheetSectionSuffix({
        school: 'YC',
        course: { section: 'A01' },
      }),
    ).toBe('');
  });

  it('detects overlapping timed Meetings in selected Sections', () => {
    const selected = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      meetings: [
        {
          days_of_week: dayMask(1, 3),
          start_time: '09:00',
          end_time: '09:50',
        },
      ],
    });
    const candidate = makeListing({
      courseCode: 'MATH 20A',
      crn: 202,
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '09:30',
          end_time: '10:20',
        },
      ],
    });

    expect(checkConflict([worksheetCourse(selected)], candidate)).toEqual([
      legacyCatalogListingToWorksheetViewModel(selected),
    ]);
  });

  it('does not treat back-to-back timed Meetings as conflicts', () => {
    const selected = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      meetings: [
        {
          days_of_week: dayMask(2),
          start_time: '10:00',
          end_time: '10:50',
        },
      ],
    });
    const candidate = makeListing({
      courseCode: 'MATH 20A',
      crn: 202,
      meetings: [
        {
          days_of_week: dayMask(2),
          start_time: '10:50',
          end_time: '11:40',
        },
      ],
    });

    expect(checkConflict([worksheetCourse(selected)], candidate)).toEqual([]);
  });

  it('checks every timed Meeting on multi-meeting Sections', () => {
    const selected = makeListing({
      courseCode: 'CSE 11',
      crn: 303,
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '08:00',
          end_time: '08:50',
        },
        {
          days_of_week: dayMask(4),
          start_time: '14:00',
          end_time: '15:50',
        },
      ],
    });
    const candidate = makeListing({
      courseCode: 'PHYS 2A',
      crn: 404,
      meetings: [
        {
          days_of_week: dayMask(4),
          start_time: '15:00',
          end_time: '16:20',
        },
      ],
    });

    expect(checkConflict([worksheetCourse(selected)], candidate)).toEqual([
      legacyCatalogListingToWorksheetViewModel(selected),
    ]);
  });

  it('ignores TBA and arranged Meetings during conflict detection', () => {
    const timed = makeListing({
      courseCode: 'CSE 12',
      crn: 505,
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '13:00',
          end_time: '13:50',
        },
      ],
    });
    const tba = makeListing({
      courseCode: 'CSE 15L',
      crn: 606,
      meetings: [],
    });
    const arranged = makeListing({
      courseCode: 'CSE 99',
      crn: 707,
      meetings: [
        {
          days_of_week: 0,
          start_time: '13:00',
          end_time: '13:50',
        },
      ],
    });

    expect(
      checkConflict([worksheetCourse(tba), worksheetCourse(arranged)], timed),
    ).toEqual([]);
    expect(checkConflict([worksheetCourse(timed)], tba)).toEqual([]);
    expect(checkConflict([worksheetCourse(timed)], arranged)).toEqual([]);
  });

  it('returns conflict pairs for worksheet visibility', () => {
    const selected = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '09:00',
          end_time: '09:50',
        },
      ],
    });
    const conflicting = makeListing({
      courseCode: 'MATH 20A',
      crn: 202,
      meetings: [
        {
          days_of_week: dayMask(1),
          start_time: '09:30',
          end_time: '10:20',
        },
      ],
    });
    const tba = makeListing({
      courseCode: 'CSE 99',
      crn: 303,
      meetings: [],
    });

    expect(
      getWorksheetConflicts([
        worksheetCourse(selected),
        worksheetCourse(conflicting),
        worksheetCourse(tba),
      ]),
    ).toEqual([
      {
        courses: [
          legacyCatalogListingToWorksheetViewModel(selected),
          legacyCatalogListingToWorksheetViewModel(conflicting),
        ],
      },
    ]);
  });

  it('filters only catalog Sections that conflict with the current worksheet', () => {
    const selected = makeListing({
      courseCode: 'CSE 3',
      crn: 101,
      meetings: [
        {
          days_of_week: dayMask(3),
          start_time: '09:00',
          end_time: '09:50',
        },
      ],
    });
    const alreadySelectedConflict = makeListing({
      courseCode: 'MATH 20A',
      crn: 202,
      meetings: [
        {
          days_of_week: dayMask(3),
          start_time: '09:30',
          end_time: '10:20',
        },
      ],
    });
    const catalogConflict = makeListing({
      courseCode: 'PHYS 2A',
      crn: 303,
      meetings: [
        {
          days_of_week: dayMask(3),
          start_time: '09:15',
          end_time: '10:05',
        },
      ],
    });
    const tba = makeListing({
      courseCode: 'CSE 99',
      crn: 404,
      meetings: [],
    });
    const nonConflict = makeListing({
      courseCode: 'BILD 1',
      crn: 505,
      meetings: [
        {
          days_of_week: dayMask(5),
          start_time: '12:00',
          end_time: '12:50',
        },
      ],
    });
    const worksheetData = [
      worksheetCourse(selected),
      worksheetCourse(alreadySelectedConflict),
    ];
    const catalog = [
      alreadySelectedConflict,
      catalogConflict,
      tba,
      nonConflict,
    ];

    const visible = catalog.filter(
      (listing) =>
        !shouldHideConflictingListing(
          worksheetData,
          listing,
          listing === alreadySelectedConflict,
        ),
    );

    expect(visible.map((listing) => listing.course_code)).toEqual([
      'MATH 20A',
      'CSE 99',
      'BILD 1',
    ]);
  });
});
