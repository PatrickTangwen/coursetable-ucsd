import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCourseData,
  loadCatalogSeason,
  resetCatalogCache,
} from './ferryCatalogCache';
import {
  type CoursePlanningCatalog,
  coursePlanningSectionModalId,
} from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';
import { adaptCoursePlanningCatalog } from '../queries/ucsdCatalogSnapshot';

const api = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchCatalogMetadata: vi.fn(),
  fetchEvals: vi.fn(),
}));

vi.mock('../queries/api', () => api);

const term = 'FA26' as Season;

const catalog: CoursePlanningCatalog = {
  supportedTerm: term,
  termLabel: 'Fall 2026',
  generatedAt: '2026-07-17T12:00:00.000Z',
  termDateRange: {
    start: '2026-09-24',
    end: '2026-12-12',
  },
  sourceTimestamps: {
    scheduleOfClasses: '2026-07-17T10:00:00.000Z',
    generalCatalog: null,
    instructorGradeArchive: null,
  },
  coverage: { complete: true, continuationNeeded: false },
  courses: [
    {
      courseId: 'CSE:1',
      subject: 'CSE',
      courseNumber: '1',
      courseCode: 'CSE 1',
      title: 'Tracer Course',
      units: '4',
      description: 'Catalog cache fixture',
      prerequisites: null,
      restrictions: null,
      requirements: null,
      catalogUrl: null,
      archiveRecordCount: 0,
      pastGrades: [],
      sections: [
        {
          sectionId: 'FA26:123456',
          courseId: 'CSE:1',
          supportedTerm: term,
          sectionCode: 'A00',
          meetingType: 'Lecture',
          instructors: [{ name: 'Ada Lovelace' }],
          meetings: [],
          availability: {
            enrolled: 80,
            capacity: 100,
            availableSeats: 20,
            capacityKind: 'bounded',
            waitlistCount: 0,
            snapshotTimestamp: '2026-07-17T10:00:00.000Z',
          },
          sourceNote: 'UCSD Schedule of Classes',
        },
      ],
    },
  ],
};

describe('Catalog cache', () => {
  beforeEach(() => {
    resetCatalogCache();
    vi.clearAllMocks();
    api.fetchCatalogMetadata.mockResolvedValue({
      last_update: new Date('2026-07-17T12:00:00.000Z'),
    });
    api.fetchEvals.mockResolvedValue(undefined);
  });

  it('stores owned and legacy Catalog views from one Catalog request', async () => {
    api.fetchCatalog.mockResolvedValue({
      coursePlanningCatalog: catalog,
      legacyCourseMap: adaptCoursePlanningCatalog(catalog),
    });

    await loadCatalogSeason(term, false);

    const cached = getCourseData()[term]!;
    expect(api.fetchCatalog).toHaveBeenCalledTimes(1);
    expect(api.fetchEvals).not.toHaveBeenCalled();
    expect(cached.catalog).toBe(catalog);
    expect([...cached.listings]).toEqual([
      [
        'FA26:123456',
        expect.objectContaining({
          course: catalog.courses[0],
          generatedAt: catalog.generatedAt,
        }),
      ],
    ]);
    expect([...cached.data.values()]).toHaveLength(1);
    expect(
      cached.listingsByModalId.get(
        coursePlanningSectionModalId('FA26:123456') as never,
      ),
    ).toBe(cached.listings.get('FA26:123456'));
    expect([...cached.data.values()][0]).toMatchObject({
      section_id: 'FA26:123456',
      course: {
        title: 'Tracer Course',
      },
    });
  });

  it('projects eligible evaluation data onto the owned listing', async () => {
    const legacyCourseMap = adaptCoursePlanningCatalog(catalog);
    const [legacyCourse] = legacyCourseMap.values();
    api.fetchCatalog.mockResolvedValue({
      coursePlanningCatalog: catalog,
      legacyCourseMap,
    });
    api.fetchEvals.mockResolvedValue(
      new Map([
        [
          legacyCourse!.course_id,
          {
            course_id: legacyCourse!.course_id,
            average_rating: 4.1,
            average_rating_same_professors: 4.5,
            average_workload: 3.2,
            average_workload_same_professors: null,
            average_professor_rating: 4.4,
            average_gut_rating: 1.3,
            last_enrollment: 70,
            last_enrollment_same_professors: false,
            evaluation_statistic: { enrolled: 80, responses: 10 },
            course_meetings: [],
          },
        ],
      ]),
    );

    await loadCatalogSeason(term, true);

    expect(
      getCourseData()[term]!.listings.get('FA26:123456')!.evaluation,
    ).toEqual({
      overallRating: 4.5,
      workload: 3.2,
      professorRating: 4.4,
      gutRating: 1.3,
      enrollment: 80,
    });
  });
});
