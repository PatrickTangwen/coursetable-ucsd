import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCatalog, fetchCatalogDetails } from './api';
import { flattenCoursePlanningCatalog } from './coursePlanningViewModels';
import type { Season } from './graphql-types';
import {
  anonymousWorksheetFromShare,
  resolveAnonymousWorksheetCourses,
} from '../utilities/anonymousWorksheet';
import { resolveSavedWorksheetCourses } from '../utilities/savedWorksheet';

const browser = vi.hoisted(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  Object.assign(globalThis, {
    localStorage: storage,
    sessionStorage: storage,
    window: {
      location: { origin: 'https://localhost:3001' },
      localStorage: storage,
      sessionStorage: storage,
    },
  });
  return { values };
});

const snapshot = {
  run_id: 'run-network-boundary-fixture',
  generated_at: '2026-07-17T12:00:00.000Z',
  active_planning_term: 'FA26',
  term_label: 'Fall 2026',
  term_date_range: null,
  configured_subjects: ['CSE'],
  source_timestamps: {
    schedule_of_classes: '2026-07-17T10:00:00.000Z',
    general_catalog: null,
    instructor_grade_archive: null,
  },
  courses: [
    {
      course_id: 'CSE:1',
      subject: 'CSE',
      course_number: '1',
      title: 'Tracer Course',
      units: '4',
      description: null,
      prerequisites_text: null,
      restrictions_text: null,
      catalog_url: null,
      archive_avg_gpa: null,
      archive_record_count: 0,
      grade_archive_records: [],
      ge_matches: [],
      sections: [
        {
          section_id: 'FA26:123456',
          course_id: 'CSE:1',
          section_code: 'A00',
          meeting_type: 'Lecture',
          instructors: [],
          meetings: [],
          enrolled: 0,
          capacity: 10,
          waitlist_count: 0,
          raw: { source: 'ucsd_schedule_of_classes' },
        },
      ],
    },
  ],
};

const gradeRecord = {
  subject: 'CSE',
  course: '1',
  year: '2025',
  quarter: 'FA',
  title: 'Tracer Course',
  instructor: 'Ada Lovelace',
  gpa: 3.8,
  a: 50,
  b: 30,
  c: 10,
  d: 2,
  f: 1,
  w: 2,
  p: 4,
  np: 1,
  raw: { source: 'fixture' },
};

describe('Catalog network boundary', () => {
  beforeEach(() => {
    browser.values.clear();
    vi.restoreAllMocks();
  });

  it('loads a Published Snapshot without GraphQL or /ferry traffic', async () => {
    const requestUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        requestUrls.push(url);
        if (/graphql|\/ferry(?:\/|$)/iu.test(url))
          throw new Error(`Forbidden Catalog request: ${url}`);
        return Promise.resolve(
          new Response(JSON.stringify(snapshot), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    const result = await fetchCatalog('FA26' as Season);

    expect(requestUrls).toEqual([
      'https://localhost:3001/api/catalog/public/FA26',
    ]);
    expect(result?.coursePlanningCatalog?.courses[0]).toMatchObject({
      courseCode: 'CSE 1',
      sections: [{ sectionId: 'FA26:123456' }],
    });
    const [listing] = flattenCoursePlanningCatalog(
      result!.coursePlanningCatalog!,
    );
    const restored = resolveAnonymousWorksheetCourses(
      anonymousWorksheetFromShare(
        { term: 'FA26' as Season, sectionIds: ['FA26:123456'] },
        () => '#123456',
      ),
      new Map([[listing!.section.sectionId, listing!]]),
    );
    expect(restored.courses[0]).toMatchObject({
      listing: {
        section_id: 'FA26:123456',
        course_code: 'CSE 1',
      },
    });
    const savedWorksheetRestored = resolveSavedWorksheetCourses(
      {
        term: 'FA26',
        sections: [
          {
            sectionId: 'FA26:123456',
            color: '#654321',
            hidden: true,
          },
        ],
      },
      new Map([[listing!.section.sectionId, listing!]]),
    );
    expect(savedWorksheetRestored.courses[0]).toMatchObject({
      color: '#654321',
      hidden: true,
      listing: { section_id: 'FA26:123456' },
    });
    expect(requestUrls).toHaveLength(1);
  });

  it('loads Past Grades from the term detail payload only when requested', async () => {
    const requestUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        requestUrls.push(url);
        const body = url.includes('/catalog/details/')
          ? {
              run_id: snapshot.run_id,
              generated_at: snapshot.generated_at,
              active_planning_term: 'FA26',
              courses: [
                {
                  course_id: 'CSE:1',
                  grade_archive_records: [gradeRecord],
                },
              ],
            }
          : {
              ...snapshot,
              courses: snapshot.courses.map(
                ({ grade_archive_records: _records, ...course }) => ({
                  ...course,
                  archive_record_count: 1,
                }),
              ),
            };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    const catalog = await fetchCatalog('FA26' as Season);

    expect(catalog?.coursePlanningCatalog?.courses[0]?.pastGrades).toEqual([]);
    expect(requestUrls).toEqual([
      'https://localhost:3001/api/catalog/public/FA26',
    ]);

    const details = await fetchCatalogDetails('FA26' as Season);

    expect(details?.get('CSE:1')).toEqual([gradeRecord]);
    expect(requestUrls).toEqual([
      'https://localhost:3001/api/catalog/public/FA26',
      'https://localhost:3001/api/catalog/details/FA26',
    ]);
  });
});
