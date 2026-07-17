import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addListingToAnonymousWorksheet,
  anonymousWorksheetFromShare,
  anonymousWorksheetHasListing,
  createAnonymousWorksheetShareUrl,
  getAnonymousWorksheetCourses,
  parseAnonymousWorksheetShare,
  readAnonymousWorksheetStorage,
  removeListingFromAnonymousWorksheet,
  resolveAnonymousWorksheetCourses,
  setAnonymousWorksheetCourseColor,
  setAnonymousWorksheetCourseHidden,
  toAnonymousWorksheetShare,
  writeAnonymousWorksheetStorage,
  type AnonymousWorksheetState,
} from './anonymousWorksheet';
import { checkConflict } from './course';
import type { CatalogListing } from '../queries/api';
import type { Crn, Season } from '../queries/graphql-types';
import { createCoursePlanningListingFixture } from '../testFixtures/coursePlanningListing';
import { legacyCatalogListingToWorksheetViewModel } from '../types/legacyWorksheetCourse';

type Meeting = {
  days_of_week: number;
  start_time: string;
  end_time: string;
};

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

function createListing({
  crn,
  sectionId,
  season = 'FA26' as Season,
  meetings = [],
}: {
  crn: number;
  sectionId: string;
  season?: Season;
  meetings?: Meeting[];
}) {
  return {
    crn: crn as Crn,
    course_code: sectionId.includes('MATH') ? 'MATH 20A' : 'CSE 3',
    number: sectionId.includes('MATH') ? '20A' : '3',
    school: 'UCSD',
    subject: sectionId.includes('MATH') ? 'MATH' : 'CSE',
    section_id: sectionId,
    course: {
      season_code: season,
      same_course_id: crn,
      course_meetings: meetings,
      listings: [
        {
          crn: crn as Crn,
          section_id: sectionId,
        },
      ],
    },
  } as unknown as CatalogListing;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('anonymous worksheet behavior', () => {
  it('adds and removes Sections by Published Snapshot Section ID', () => {
    const listing = createCoursePlanningListingFixture(
      'FA26:CSE-TRACER-3',
      'CSE 3',
    );
    const empty: AnonymousWorksheetState = {
      term: 'FA26' as Season,
      coursesByTerm: {},
    };

    const added = addListingToAnonymousWorksheet(empty, listing, '#123456');
    const duplicate = addListingToAnonymousWorksheet(added, listing, '#abcdef');
    const hidden = setAnonymousWorksheetCourseHidden(added, listing, true);
    const recolored = setAnonymousWorksheetCourseColor(
      hidden,
      listing,
      '#abcdef',
    );
    const removed = removeListingFromAnonymousWorksheet(recolored, listing);

    expect(anonymousWorksheetHasListing(added, listing)).toBe(true);
    expect(getAnonymousWorksheetCourses(added, 'FA26' as Season)).toEqual([
      {
        sectionId: 'FA26:CSE-TRACER-3',
        color: '#123456',
        hidden: false,
      },
    ]);
    expect(
      getAnonymousWorksheetCourses(duplicate, 'FA26' as Season),
    ).toHaveLength(1);
    expect(getAnonymousWorksheetCourses(recolored, 'FA26' as Season)).toEqual([
      {
        sectionId: 'FA26:CSE-TRACER-3',
        color: '#abcdef',
        hidden: true,
      },
    ]);
    expect(getAnonymousWorksheetCourses(removed, 'FA26' as Season)).toEqual([]);
  });

  it('allows adding overlapping Sections to an anonymous worksheet', () => {
    const first = createListing({
      crn: 101,
      sectionId: 'FA26:CSE-TRACER-3',
      meetings: [
        {
          days_of_week: 1 << 1,
          start_time: '09:00',
          end_time: '09:50',
        },
      ],
    });
    const second = createListing({
      crn: 202,
      sectionId: 'FA26:MATH-TRACER-2',
      meetings: [
        {
          days_of_week: 1 << 1,
          start_time: '09:30',
          end_time: '10:20',
        },
      ],
    });
    const empty: AnonymousWorksheetState = {
      term: 'FA26' as Season,
      coursesByTerm: {},
    };

    const withFirst = addListingToAnonymousWorksheet(empty, first, '#123456');
    const withSecond = addListingToAnonymousWorksheet(
      withFirst,
      second,
      '#abcdef',
    );

    expect(
      checkConflict(
        [
          {
            crn: first.crn,
            color: '#123456',
            listing: legacyCatalogListingToWorksheetViewModel(first),
            hidden: false,
          },
        ],
        second,
      ),
    ).toEqual([first]);
    expect(
      getAnonymousWorksheetCourses(withSecond, 'FA26' as Season).map(
        (course) => course.sectionId,
      ),
    ).toEqual(['FA26:CSE-TRACER-3', 'FA26:MATH-TRACER-2']);
  });

  it('keeps anonymous worksheet sections keyed by their own terms', () => {
    const fa26 = createListing({
      crn: 101,
      sectionId: 'FA26:CSE-TRACER-3',
      season: 'FA26' as Season,
    });
    const wi27 = createListing({
      crn: 202,
      sectionId: 'WI27:MATH-TRACER-2',
      season: 'WI27' as Season,
    });
    const empty: AnonymousWorksheetState = {
      term: 'FA26' as Season,
      coursesByTerm: {},
    };

    const withFa26 = addListingToAnonymousWorksheet(empty, fa26, '#123456');
    const withBoth = addListingToAnonymousWorksheet(withFa26, wi27, '#abcdef');

    expect(withBoth.term).toBe('FA26');
    expect(getAnonymousWorksheetCourses(withBoth, 'FA26' as Season)).toEqual([
      { sectionId: 'FA26:CSE-TRACER-3', color: '#123456', hidden: false },
    ]);
    expect(getAnonymousWorksheetCourses(withBoth, 'WI27' as Season)).toEqual([
      { sectionId: 'WI27:MATH-TRACER-2', color: '#abcdef', hidden: false },
    ]);
  });

  it('persists the anonymous worksheet in browser localStorage', () => {
    const localStorage = createStorage();
    vi.stubGlobal('window', { localStorage });
    const worksheet: AnonymousWorksheetState = {
      term: 'FA26' as Season,
      coursesByTerm: {
        FA26: [
          {
            sectionId: 'FA26:CSE-TRACER-3',
            color: '#123456',
            hidden: true,
          },
        ],
      },
    };

    writeAnonymousWorksheetStorage(worksheet);

    expect(readAnonymousWorksheetStorage('FA26' as Season)).toEqual(worksheet);
    expect(localStorage.getItem('anonymousWorksheet')).toBe(
      '{"term":"FA26","coursesByTerm":{"FA26":[{"sectionId":"FA26:CSE-TRACER-3","color":"#123456","hidden":true}]}}',
    );
  });

  it('migrates legacy single-term anonymous worksheet storage', () => {
    const localStorage = createStorage();
    vi.stubGlobal('window', { localStorage });
    localStorage.setItem(
      'anonymousWorksheet',
      JSON.stringify({
        term: 'FA26',
        courses: [
          { sectionId: 'FA26:CSE-TRACER-3', color: '#123456', hidden: true },
        ],
      }),
    );

    expect(readAnonymousWorksheetStorage('FA26' as Season)).toEqual({
      term: 'FA26',
      coursesByTerm: {
        FA26: [
          { sectionId: 'FA26:CSE-TRACER-3', color: '#123456', hidden: true },
        ],
      },
    });
  });

  it('encodes share URLs with only the Active Planning Term and Section IDs', () => {
    const share = toAnonymousWorksheetShare('FA26' as Season, [
      'FA26:CSE-TRACER-3',
      'FA26:MATH-TRACER-2',
    ]);
    const url = new URL(
      createAnonymousWorksheetShareUrl('https://example.test', share),
    );

    expect(url.pathname).toBe('/worksheet');
    expect([...url.searchParams.keys()]).toEqual(['t', 'sections']);
    expect(url.searchParams.get('t')).toBe('FA26');
    expect(url.searchParams.get('sections')).toBe(
      'FA26:CSE-TRACER-3,FA26:MATH-TRACER-2',
    );
  });

  it('restores matching Sections from the Published Snapshot and reports missing IDs', () => {
    const cse = createCoursePlanningListingFixture(
      'FA26:CSE-TRACER-3',
      'CSE 3',
    );
    const math = createCoursePlanningListingFixture(
      'FA26:MATH-TRACER-2',
      'MATH 20A',
    );
    const catalog = new Map([
      [cse.section.sectionId, cse],
      [math.section.sectionId, math],
    ]);
    const share = parseAnonymousWorksheetShare(
      new URLSearchParams({
        t: 'FA26',
        sections: 'FA26:CSE-TRACER-3,FA26:STALE-404',
      }),
      'FA26' as Season,
    );

    const worksheet = anonymousWorksheetFromShare(share!, (index) =>
      index === 0 ? '#111111' : '#222222',
    );
    const restored = resolveAnonymousWorksheetCourses(worksheet, catalog);

    expect(restored.missingSectionIds).toEqual(['FA26:STALE-404']);
    expect(restored.courses).toHaveLength(1);
    expect(restored.courses[0]).toMatchObject({
      color: '#111111',
      hidden: false,
      listing: {
        section_id: 'FA26:CSE-TRACER-3',
        course_code: 'CSE 3',
      },
    });
  });
});
