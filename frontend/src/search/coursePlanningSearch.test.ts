import { describe, expect, it } from 'vitest';

import {
  createCoursePlanningSearchIndex,
  filterCoursePlanningSearchIndex,
  type CoursePlanningSearchContext,
} from './coursePlanningSearch';
import { defaultFilters } from './searchConstants';
import type { Filters } from './searchTypes';
import {
  flattenCoursePlanningCatalog,
  type CoursePlanningCatalog,
  type CoursePlanningListing,
} from '../queries/coursePlanningViewModels';

const catalog: CoursePlanningCatalog = {
  supportedTerm: 'FA26',
  termLabel: 'Fall 2026',
  generatedAt: '2026-07-17T12:00:00.000Z',
  termDateRange: null,
  sourceTimestamps: {
    scheduleOfClasses: '2026-07-17T10:00:00.000Z',
    generalCatalog: null,
    instructorGradeArchive: null,
  },
  coverage: { complete: true, continuationNeeded: false },
  courses: [
    {
      courseId: 'CSE:10',
      subject: 'CSE',
      courseNumber: '10',
      courseCode: 'CSE 10',
      title: 'Computing Concepts',
      units: '4',
      description: 'Second matching course',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
    {
      courseId: 'CSE:2',
      subject: 'CSE',
      courseNumber: '2',
      courseCode: 'CSE 2',
      title: 'Programming Foundations',
      units: '4',
      description: 'First matching course',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
    {
      courseId: 'MATH:20A',
      subject: 'MATH',
      courseNumber: '20A',
      courseCode: 'MATH 20A',
      title: 'Calculus',
      units: '4',
      description: 'Different subject',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
    {
      courseId: 'CSE:200',
      subject: 'CSE',
      courseNumber: '200',
      courseCode: 'CSE 200',
      title: 'Research Seminar',
      units: '4',
      description: null,
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
    {
      courseId: 'CAT:1',
      subject: 'CAT',
      courseNumber: '1',
      courseCode: 'CAT-001',
      title: 'Culture, Art, and Technology 1',
      units: '4',
      description: null,
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    },
  ],
};

for (const course of catalog.courses) {
  course.sections.push({
    sectionId: `FA26:${course.courseId}`,
    courseId: course.courseId,
    supportedTerm: 'FA26',
    sectionCode: 'A00',
    meetingType: 'Lecture',
    instructors: [{ name: 'Ada Lovelace' }],
    meetings: [
      {
        days: ['Monday'],
        date: null,
        startTime: '09:00',
        endTime: '09:50',
        building: 'CENTR',
        room: '101',
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'M',
        rawTime: '9:00-9:50',
        rawLocation: 'CENTR 101',
      },
    ],
    availability: {
      enrolled: 80,
      capacity: 100,
      availableSeats: 20,
      capacityKind: 'bounded',
      waitlistCount: 0,
      snapshotTimestamp: '2026-07-17T10:00:00.000Z',
    },
    sourceNote: 'UCSD Schedule of Classes',
  });
}

function filterListings(
  listings: CoursePlanningListing[],
  filters: Filters,
  context: CoursePlanningSearchContext = {},
) {
  return filterCoursePlanningSearchIndex(
    createCoursePlanningSearchIndex(listings),
    filters,
    context,
  );
}

describe('Course Planning Catalog search', () => {
  it('reuses indexed search fields across submitted queries', () => {
    const [listing] = flattenCoursePlanningCatalog(structuredClone(catalog));
    let currentTitle = listing!.course.title;
    let titleReads = 0;
    Object.defineProperty(listing!.course, 'title', {
      configurable: true,
      get() {
        titleReads += 1;
        return currentTitle;
      },
      set(value: string) {
        currentTitle = value;
      },
    });

    const index = createCoursePlanningSearchIndex([listing!]);
    titleReads = 0;

    expect(
      filterCoursePlanningSearchIndex(index, {
        ...defaultFilters,
        searchText: 'computing',
      }),
    ).toEqual([listing]);
    expect(
      filterCoursePlanningSearchIndex(index, {
        ...defaultFilters,
        searchText: 'missing',
      }),
    ).toEqual([]);
    expect(titleReads).toBe(0);
  });

  it('matches the FA26 TSS display code', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const results = filterListings(listings, {
      ...defaultFilters,
      searchText: 'CAT-001',
    });

    expect(results.map(({ course }) => course.courseCode)).toEqual(['CAT-001']);
  });

  it.each([
    ['section', 'A00'],
    ['term', 'Fall 2026'],
    ['instructor', 'Lovelace'],
    ['meeting time', '9:00 – 9:50 AM'],
    ['location room', 'CENTR 101'],
  ])('matches the visible %s column value', (_column, searchText) => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const results = filterListings(listings, {
      ...defaultFilters,
      searchText,
    });

    expect(results).toHaveLength(listings.length);
  });

  it('filters owned listings without imposing a second Catalog sort', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const results = filterListings(listings, {
      ...defaultFilters,
      searchText: 'course',
      selectSubjects: [{ value: 'CSE', label: 'CSE' }],
      selectDays: [{ value: 1, label: 'Monday' }],
      selectBuilding: [{ value: 'CENTR', label: 'CENTR' }],
      selectCredits: [{ value: 4, label: '4' }],
      excludeAttributes: [],
    });

    expect(results.map(({ course }) => course.courseCode)).toEqual([
      'CSE 10',
      'CSE 2',
    ]);
  });

  it('scopes results to the exact selected suggestion', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const decoy = structuredClone(
      listings.find(({ course }) => course.courseCode === 'MATH 20A')!,
    );
    decoy.course.courseId = 'MATH:99';
    decoy.course.courseNumber = '99';
    decoy.course.courseCode = 'MATH 99';
    decoy.course.title = 'Topics mentioning CSE 10';
    decoy.section.sectionId = 'FA26:MATH:99';
    listings.push(decoy);

    const freeTextResults = filterListings(listings, {
      ...defaultFilters,
      searchText: 'CSE 10',
      excludeAttributes: [],
    });
    const results = filterListings(listings, {
      ...defaultFilters,
      searchText: 'CSE 10',
      searchColumn: 'Code',
      excludeAttributes: [],
    });

    expect(freeTextResults.map(({ course }) => course.courseCode)).toEqual([
      'CSE 10',
      'MATH 99',
    ]);
    expect(results.map(({ course }) => course.courseCode)).toEqual(['CSE 10']);
  });

  it('matches the selected meeting days as an exact set', () => {
    const listings = flattenCoursePlanningCatalog(structuredClone(catalog));
    listings[0]!.section.meetings[0]!.days = ['Monday', 'Tuesday'];
    listings[0]!.section.meetings.push({
      ...listings[0]!.section.meetings[0]!,
      days: ['Wednesday'],
      meetingType: 'Final',
    });

    const mondayOnly = filterListings(listings, {
      ...defaultFilters,
      selectDays: [{ value: 1, label: 'Monday' }],
    });
    const mondayTuesdayOnly = filterListings(listings, {
      ...defaultFilters,
      selectDays: [
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
      ],
    });

    expect(mondayOnly.map(({ course }) => course.courseCode)).not.toContain(
      'CSE 10',
    );
    expect(mondayTuesdayOnly.map(({ course }) => course.courseCode)).toEqual([
      'CSE 10',
    ]);
  });

  it('preserves persisted numeric and graduate filter semantics', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const graduateResults = filterListings(listings, {
      ...defaultFilters,
      includeAttributes: ['graduate'],
      excludeAttributes: [],
      numBounds: [1000, 2500],
    });

    expect(graduateResults.map(({ course }) => course.courseCode)).toEqual([
      'CSE 200',
    ]);
  });

  it('preserves non-scalar unit parsing and owned evaluation filters', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const graduate = listings.find(
      ({ course }) => course.courseCode === 'CSE 200',
    )!;
    graduate.course.units = '2 or 4';
    graduate.evaluation = {
      overallRating: 4.5,
      workload: 3,
      professorRating: 4.2,
      gutRating: 1.5,
      enrollment: 80,
    };

    const results = filterListings(listings, {
      ...defaultFilters,
      selectCredits: [{ value: 4, label: '4 units' }],
      overallBounds: [4, 5],
      professorBounds: [4, 5],
      enrollBounds: [50, 100],
      excludeAttributes: [],
    });

    expect(results.map(({ course }) => course.courseCode)).toEqual(['CSE 200']);
  });
});
