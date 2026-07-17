import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogListing } from '../../queries/api';
import type { Crn, Season } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { legacyCatalogListingToWorksheetViewModel } from '../../types/legacyWorksheetCourse';
import type { WorksheetListingViewModel } from '../../types/worksheetCourse';

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
    removeItem(key: string) {
      return items.delete(key);
    },
  };
}

function createListing({
  crn,
  courseCode,
  sectionId,
  credits,
  skills = [],
  areas = [],
}: {
  crn: number;
  courseCode: string;
  sectionId: string;
  credits: number;
  skills?: string[];
  areas?: string[];
}): WorksheetListingViewModel {
  return legacyCatalogListingToWorksheetViewModel({
    crn: crn as Crn,
    course_code: courseCode,
    number: courseCode.split(' ')[1] ?? courseCode,
    school: 'UCSD',
    section_id: sectionId,
    course: {
      season_code: 'S126' as Season,
      section: '01',
      credits,
      skills,
      areas,
      listings: [
        {
          crn: crn as Crn,
          course_code: courseCode,
          section_id: sectionId,
        },
      ],
    },
  } as unknown as CatalogListing);
}

async function renderWorksheetStats(courses: WorksheetCourse[]) {
  vi.resetModules();
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('sessionStorage', sessionStorage);
  vi.stubGlobal('window', {
    localStorage,
    sessionStorage,
    location: { pathname: '/worksheet', search: '' },
    history: { replaceState: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const { WorksheetStatsView } = await import('./WorksheetStats');

  return renderToStaticMarkup(
    <WorksheetStatsView
      courses={courses}
      isExoticWorksheet={false}
      exoticWorksheet={undefined}
      isAnonymousWorksheet={false}
      worksheetMissingSectionIds={[]}
      anonymousConflictSummaries={[]}
      exitExoticWorksheet={() => {}}
      isMobile={false}
    />,
  );
}

describe('WorksheetStats', () => {
  it('keeps Summary limited to UCSD-supported worksheet metrics', async () => {
    const html = await renderWorksheetStats([
      {
        crn: 259244 as Crn,
        color: '#123456',
        hidden: false,
        listing: createListing({
          crn: 259244,
          courseCode: 'CSE 8A',
          sectionId: 'S126:259244',
          credits: 4,
          skills: ['WR'],
        }),
      },
      {
        crn: 260254 as Crn,
        color: '#654321',
        hidden: false,
        listing: createListing({
          crn: 260254,
          courseCode: 'MATH 20A',
          sectionId: 'S126:260254',
          credits: 4,
          areas: ['Sc'],
        }),
      },
    ]);

    expect(html).toContain('Summary');
    expect(html).toContain('Total courses');
    expect(html).toContain('Total credits');
    expect(html).not.toContain('Skills &amp; Areas');
    expect(html).not.toContain('WR');
    expect(html).not.toContain('Sc');
    expect(html.toLowerCase()).not.toMatch(
      /\b(?:workload|rating|friends?|demand|average gpa)\b/u,
    );
  });
});
