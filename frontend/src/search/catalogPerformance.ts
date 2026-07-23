import { searchCatalogSearchSuggestions } from './catalogSearchSuggestions';
import {
  createCoursePlanningSearchIndex,
  filterCoursePlanningSearchIndex,
  type CoursePlanningSearchIndex,
} from './coursePlanningSearch';
import { defaultFilters } from './searchConstants';
import type {
  CoursePlanningCourse,
  CoursePlanningListing,
  CoursePlanningSection,
} from '../queries/coursePlanningViewModels';

const expectedScale = { courses: 1998, listings: 6104 } as const;
const cseResultCount = 1018;
const subjects = ['CSE', 'MATH', 'BILD', 'CHEM', 'ECON', 'PHYS'] as const;

type OperationMeasurement = {
  medianMs: number;
  resultCount: number;
};

export type CatalogPerformanceReport = {
  scale: {
    courses: number;
    listings: number;
  };
  indexBuildMedianMs: number;
  operations: {
    emptyFilter: OperationMeasurement;
    textFilter: OperationMeasurement;
    subjectFilter: OperationMeasurement;
    typeahead: OperationMeasurement;
  };
};

function sectionCount(courseIndex: number) {
  return courseIndex < 110 ? 4 : 3;
}

function createSection(
  course: CoursePlanningCourse,
  courseIndex: number,
  sectionIndex: number,
): CoursePlanningSection {
  const startHour = 8 + (courseIndex % 10);
  const sectionNumber = (courseIndex * 4 + sectionIndex) % 2100;
  return {
    sectionId: `FA26:${course.courseId}:${sectionIndex}`,
    courseId: course.courseId,
    supportedTerm: 'FA26',
    sectionCode: `A${String(sectionNumber).padStart(4, '0')}`,
    meetingType: 'Lecture',
    instructors: [{ name: `Performance Instructor ${courseIndex % 200}` }],
    meetings: [
      {
        days: ['Monday', 'Wednesday'],
        date: null,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(startHour).padStart(2, '0')}:50`,
        building: `BLDG${courseIndex % 50}`,
        room: String(100 + (courseIndex % 300)),
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'MW',
        rawTime: `${startHour}:00-${startHour}:50`,
        rawLocation: `BLDG${courseIndex % 50} ${100 + (courseIndex % 300)}`,
      },
    ],
    availability: {
      enrolled: 80,
      capacity: 100,
      availableSeats: 20,
      capacityKind: 'bounded',
      waitlistCount: 0,
      snapshotTimestamp: '2026-07-22T12:00:00.000Z',
    },
    sourceNote: 'Catalog performance fixture',
  };
}

export function createCatalogPerformanceFixture(): CoursePlanningListing[] {
  const listings: CoursePlanningListing[] = [];
  for (
    let courseIndex = 0;
    courseIndex < expectedScale.courses;
    courseIndex += 1
  ) {
    const subject = subjects[courseIndex % subjects.length]!;
    const courseNumber = String(courseIndex + 1);
    const course: CoursePlanningCourse = {
      courseId: `${subject}:${courseNumber}`,
      subject,
      courseNumber,
      courseCode: `${subject} ${courseNumber}`,
      title: `Catalog Performance Course ${courseIndex + 1}`,
      units: '4',
      description: 'Deterministic regression fixture',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [],
    };
    for (
      let sectionIndex = 0;
      sectionIndex < sectionCount(courseIndex);
      sectionIndex += 1
    ) {
      const section = createSection(course, courseIndex, sectionIndex);
      course.sections.push(section);
      listings.push({
        course,
        section,
        generatedAt: '2026-07-22T12:00:00.000Z',
        termDateRange: null,
        catalogCoverage: { complete: true, continuationNeeded: false },
        evaluation: {
          overallRating: null,
          workload: null,
          professorRating: null,
          gutRating: null,
          enrollment: null,
        },
      });
    }
  }
  return listings;
}

function median(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function measure(
  operation: () => { resultCount: number },
  iterations: number,
): OperationMeasurement {
  operation();
  operation();
  const durations: number[] = [];
  let resultCount = 0;
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    ({ resultCount } = operation());
    durations.push(performance.now() - startedAt);
  }
  return { medianMs: median(durations), resultCount };
}

function measureIndexBuild(listings: CoursePlanningListing[]) {
  createCoursePlanningSearchIndex(listings.slice(0, 128));
  const durations: number[] = [];
  let index: CoursePlanningSearchIndex | null = null;
  for (let run = 0; run < 3; run += 1) {
    const startedAt = performance.now();
    index = createCoursePlanningSearchIndex(listings);
    durations.push(performance.now() - startedAt);
  }
  return { index: index!, medianMs: median(durations) };
}

export function runCatalogPerformanceBenchmark(
  listings = createCatalogPerformanceFixture(),
): CatalogPerformanceReport {
  const { index, medianMs: indexBuildMedianMs } = measureIndexBuild(listings);
  const iterations = 9;
  const emptyFilters = { ...defaultFilters, excludeAttributes: [] };
  const textFilters = {
    ...emptyFilters,
    searchText: 'cse',
  };
  const subjectFilters = {
    ...emptyFilters,
    selectSubjects: [{ value: 'CSE', label: 'CSE' }],
  };

  return {
    scale: {
      courses: new Set(listings.map(({ course }) => course.courseId)).size,
      listings: listings.length,
    },
    indexBuildMedianMs,
    operations: {
      emptyFilter: measure(
        () => ({
          resultCount: filterCoursePlanningSearchIndex(index, emptyFilters)
            .length,
        }),
        iterations,
      ),
      textFilter: measure(
        () => ({
          resultCount: filterCoursePlanningSearchIndex(index, textFilters)
            .length,
        }),
        iterations,
      ),
      subjectFilter: measure(
        () => ({
          resultCount: filterCoursePlanningSearchIndex(index, subjectFilters)
            .length,
        }),
        iterations,
      ),
      typeahead: measure(() => {
        searchCatalogSearchSuggestions(index.suggestions, 'c');
        searchCatalogSearchSuggestions(index.suggestions, 'cs');
        return {
          resultCount: searchCatalogSearchSuggestions(index.suggestions, 'cse')
            .length,
        };
      }, iterations),
    },
  };
}

export function assertCatalogPerformance(report: CatalogPerformanceReport) {
  const violations: string[] = [];
  if (
    report.scale.courses !== expectedScale.courses ||
    report.scale.listings !== expectedScale.listings
  ) {
    violations.push(
      `scale was ${report.scale.courses}/${report.scale.listings}, expected ${expectedScale.courses}/${expectedScale.listings}`,
    );
  }

  const expectedResults = {
    emptyFilter: expectedScale.listings,
    textFilter: cseResultCount,
    subjectFilter: cseResultCount,
    typeahead: 8,
  } as const;
  const budgets = {
    emptyFilter: { floorMs: 15, buildShare: 0.15, ceilingMs: 60 },
    textFilter: { floorMs: 25, buildShare: 0.22, ceilingMs: 90 },
    subjectFilter: { floorMs: 15, buildShare: 0.15, ceilingMs: 60 },
    typeahead: { floorMs: 50, buildShare: 0.35, ceilingMs: 120 },
  } as const;

  if (report.indexBuildMedianMs > 750) {
    violations.push(
      `index build took ${report.indexBuildMedianMs.toFixed(1)}ms, limit is 750ms`,
    );
  }

  for (const name of Object.keys(
    report.operations,
  ) as (keyof CatalogPerformanceReport['operations'])[]) {
    const operation = report.operations[name];
    if (operation.resultCount !== expectedResults[name]) {
      violations.push(
        `${name} returned ${operation.resultCount}, expected ${expectedResults[name]}`,
      );
    }
    const budget = Math.min(
      budgets[name].ceilingMs,
      Math.max(
        budgets[name].floorMs,
        report.indexBuildMedianMs * budgets[name].buildShare,
      ),
    );
    if (operation.medianMs > budget) {
      violations.push(
        `${name} took ${operation.medianMs.toFixed(1)}ms, budget is ${budget.toFixed(1)}ms`,
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Catalog performance budget exceeded:\n${violations.map((violation) => `- ${violation}`).join('\n')}`,
    );
  }
}
