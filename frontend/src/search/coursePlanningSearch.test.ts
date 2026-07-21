import { describe, expect, it } from 'vitest';

import { filterAndSortCoursePlanningListings } from './coursePlanningSearch';
import { defaultFilters } from './searchConstants';
import {
  flattenCoursePlanningCatalog,
  type CoursePlanningCatalog,
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
      waitlistCount: 0,
      snapshotTimestamp: '2026-07-17T10:00:00.000Z',
    },
    sourceNote: 'UCSD Schedule of Classes',
  });
}

describe('Course Planning Catalog search', () => {
  it('filters owned listings and preserves numeric course-code ordering', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const results = filterAndSortCoursePlanningListings(listings, {
      ...defaultFilters,
      searchText: 'course',
      selectSubjects: [{ value: 'CSE', label: 'CSE' }],
      selectDays: [{ value: 1, label: 'Monday' }],
      selectBuilding: [{ value: 'CENTR', label: 'CENTR' }],
      selectCredits: [{ value: 4, label: '4' }],
      excludeAttributes: [],
    });

    expect(results.map(({ course }) => course.courseCode)).toEqual([
      'CSE 2',
      'CSE 10',
    ]);
  });

  it('preserves persisted numeric and graduate filter semantics', () => {
    const listings = flattenCoursePlanningCatalog(catalog);
    const graduateResults = filterAndSortCoursePlanningListings(listings, {
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

    const results = filterAndSortCoursePlanningListings(listings, {
      ...defaultFilters,
      selectCredits: [{ value: 2, label: '2' }],
      overallBounds: [4, 5],
      professorBounds: [4, 5],
      enrollBounds: [50, 100],
      excludeAttributes: [],
    });

    expect(results.map(({ course }) => course.courseCode)).toEqual(['CSE 200']);
  });
});
