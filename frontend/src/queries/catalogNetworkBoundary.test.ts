import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCatalog } from './api';
import type { Season } from './graphql-types';

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
  });
});
