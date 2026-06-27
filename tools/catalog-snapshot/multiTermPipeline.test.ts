import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogSnapshot, CatalogSnapshotConfig } from './catalogSnapshot';
import { runMultiTermSnapshotPipeline } from './multiTermPipeline';
import type { PublishedSnapshotSourceLoaders } from './publishedSnapshotPipeline';
import type { SupportedTermRegistry } from './supportedTermRegistry';

const generatedAt = '2026-06-26T12:00:00.000Z';

function makeConfig(rootDir: string): CatalogSnapshotConfig {
  return {
    active_planning_term: 'SP26',
    term_label: 'Spring 2026',
    term_date_range: { start: '2026-03-30', end: '2026-06-12' },
    configured_subjects: ['CSE', 'MATH'],
    paths: {
      raw_dir: join(rootDir, 'raw'),
      normalized_dir: join(rootDir, 'normalized'),
      reports_dir: join(rootDir, 'reports'),
      public_catalog_dir: join(rootDir, 'public'),
      metadata_path: join(rootDir, 'metadata.json'),
    },
  };
}

function courseNumber(subject: string): string {
  return subject === 'CSE' ? '101' : '20A';
}

function makeScheduleCourse(
  subject: string,
  term: string,
): CatalogSnapshot['courses'][number] {
  const number = courseNumber(subject);
  const id = `${subject}:${number}`;
  return {
    course_id: id,
    subject,
    course_number: number,
    title: `${subject} Schedule Title`,
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
        section_id: `${term}:${subject}-section`,
        course_id: id,
        section_code: 'A00',
        meeting_type: 'Lecture',
        instructors: [`${subject} Instructor`],
        meetings: [
          {
            days: ['Monday'],
            start_time: '09:00',
            end_time: '09:50',
            building: 'CENTR',
            room: '101',
            is_tba: false,
            meeting_type: 'Lecture',
            raw_days: 'M',
            raw_time: '9:00a-9:50a',
            raw_location: 'CENTR 101',
          },
        ],
        enrolled: 80,
        capacity: 100,
        waitlist_count: 0,
        raw: { source: 'fixture' },
      },
    ],
  };
}

type Counters = {
  schedule: string[];
  generalCatalog: string[];
  gradeArchive: string[];
};

function makeCountingLoaders(
  counters: Counters,
): PublishedSnapshotSourceLoaders {
  return {
    scheduleOfClasses(subject, context) {
      const term = context.config.active_planning_term;
      counters.schedule.push(`${term}:${subject}`);
      return {
        subject,
        fetched_at: context.generatedAt,
        raw_files: [
          { filename: `${subject}.html`, contents: `<html>${subject}</html>` },
        ],
        parse() {
          return {
            source_timestamp: `schedule timestamp ${subject}`,
            data: {
              subject,
              term,
              source_url: `https://schedule.test/${subject}`,
              fetched_at: context.generatedAt,
              source_timestamp: `schedule timestamp ${subject}`,
              courses: [makeScheduleCourse(subject, term)],
            },
          };
        },
      };
    },
    generalCatalog(subject, context) {
      counters.generalCatalog.push(subject);
      return {
        subject,
        fetched_at: context.generatedAt,
        raw_files: [
          { filename: `${subject}.html`, contents: `<html>${subject}</html>` },
        ],
        parse() {
          return {
            source_timestamp: context.generatedAt,
            data: [
              {
                course_id: `${subject}:${courseNumber(subject)}`,
                subject,
                course_number: courseNumber(subject),
                title: `${subject} Catalog Title`,
                units: '4',
                description: `${subject} Catalog Description`,
                prerequisites_text: null,
                restrictions_text: null,
                catalog_url: `https://catalog.test/${subject}`,
              },
            ],
          };
        },
      };
    },
    instructorGradeArchive(subject, context) {
      counters.gradeArchive.push(subject);
      return {
        subject,
        fetched_at: context.generatedAt,
        raw_files: [
          { filename: `${subject}.html`, contents: `<html>${subject}</html>` },
        ],
        parse() {
          return { source_timestamp: context.generatedAt, data: [] };
        },
      };
    },
  };
}

describe('Multi-term snapshot pipeline', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function makeTempConfig() {
    const dir = await mkdtemp(join(tmpdir(), 'multi-term-'));
    tempDirs.push(dir);
    return makeConfig(dir);
  }

  it('publishes one snapshot per term and a single Supported Term registry', async () => {
    const config = await makeTempConfig();
    const counters: Counters = {
      schedule: [],
      generalCatalog: [],
      gradeArchive: [],
    };

    await runMultiTermSnapshotPipeline(config, {
      runId: 'multi-run',
      generatedAt,
      terms: [
        { term: 'FA25', label: 'Fall 2025' },
        { term: 'SP26', label: 'Spring 2026' },
      ],
      sourceLoaders: makeCountingLoaders(counters),
    });

    const fa25 = JSON.parse(
      await readFile(
        join(config.paths.public_catalog_dir, 'FA25.json'),
        'utf-8',
      ),
    ) as CatalogSnapshot;
    const sp26 = JSON.parse(
      await readFile(
        join(config.paths.public_catalog_dir, 'SP26.json'),
        'utf-8',
      ),
    ) as CatalogSnapshot;

    expect(fa25.active_planning_term).toBe('FA25');
    expect(fa25.term_label).toBe('Fall 2025');
    expect(fa25.courses.map((course) => course.course_id).sort()).toEqual([
      'CSE:101',
      'MATH:20A',
    ]);
    expect(fa25.courses[0]!.sections[0]!.section_id).toMatch(/^FA25:/u);
    expect(sp26.active_planning_term).toBe('SP26');
    expect(sp26.courses[0]!.sections[0]!.section_id).toMatch(/^SP26:/u);

    const registry = JSON.parse(
      await readFile(config.paths.metadata_path, 'utf-8'),
    ) as SupportedTermRegistry;

    expect(registry.last_update).toBe(generatedAt);
    expect(registry.terms).toEqual([
      {
        term: 'FA25',
        label: 'Fall 2025',
        date_range: null,
        frozen: false,
        generated_at: generatedAt,
        snapshot_path: 'catalogs/public/FA25.json',
        manifest_path: null,
      },
      {
        term: 'SP26',
        label: 'Spring 2026',
        date_range: { start: '2026-03-30', end: '2026-06-12' },
        frozen: false,
        generated_at: generatedAt,
        snapshot_path: 'catalogs/public/SP26.json',
        manifest_path: null,
      },
    ]);
  });

  it('fetches term-agnostic sources once per subject, schedule per term', async () => {
    const config = await makeTempConfig();
    const counters: Counters = {
      schedule: [],
      generalCatalog: [],
      gradeArchive: [],
    };

    await runMultiTermSnapshotPipeline(config, {
      runId: 'multi-run',
      generatedAt,
      terms: [
        { term: 'FA25', label: 'Fall 2025' },
        { term: 'SP26', label: 'Spring 2026' },
      ],
      sourceLoaders: makeCountingLoaders(counters),
    });

    // Schedule of Classes is term-specific: 2 terms x 2 subjects.
    expect(counters.schedule.sort()).toEqual([
      'FA25:CSE',
      'FA25:MATH',
      'SP26:CSE',
      'SP26:MATH',
    ]);
    // Term-agnostic sources fetched once per subject across both terms.
    expect(counters.generalCatalog.sort()).toEqual(['CSE', 'MATH']);
    expect(counters.gradeArchive.sort()).toEqual(['CSE', 'MATH']);
  });
});
