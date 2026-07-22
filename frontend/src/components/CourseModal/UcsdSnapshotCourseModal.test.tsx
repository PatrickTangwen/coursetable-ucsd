import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUcsdSnapshotModalCourse } from './ucsdSnapshotModalData';
import type { Season } from '../../queries/graphql-types';
import { createCoursePlanningListingFixture } from '../../testFixtures/coursePlanningListing';

function offeringGroup(term: Season) {
  const listing = createCoursePlanningListingFixture(
    `${term}:CSE-3-A01`,
    'CSE 3',
  );
  listing.section.supportedTerm = term;
  return buildUcsdSnapshotModalCourse(listing, [listing]).groups[0]!;
}

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

async function renderCard(canEditWorksheet: boolean) {
  const { OfferingGroupCard } = await import('./UcsdSnapshotCourseModal');
  const group = offeringGroup((canEditWorksheet ? 'S126' : 'SP26') as Season);
  return renderToStaticMarkup(
    <OfferingGroupCard
      model={{
        group,
        active: true,
        inWorksheet: false,
        selectedCode: 'A01',
        updatedLabel: null,
        worksheetDisabled: false,
        canEditWorksheet,
      }}
      actions={{
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        onToggleWorksheet: vi.fn(),
        setRef: vi.fn(),
      }}
    />,
  );
}

async function renderTssPackageCard() {
  const { OfferingGroupCard } = await import('./UcsdSnapshotCourseModal');
  const group = offeringGroup('FA26' as Season);
  const section = group.sections[0]!;
  section.packageDisplayId = 'SE00154333';
  section.packageStatusText = 'Entry successfully validated';
  section.disabled = true;
  section.meetings.push({
    days: ['Tuesday', 'Thursday'],
    date: null,
    startTime: '09:00',
    endTime: '10:20',
    building: 'Center Hall',
    room: '101',
    isTba: false,
    meetingType: 'Lecture',
    rawDays: 'TuTh',
    rawTime: '09:00am-10:20am',
    rawLocation: 'Center Hall Room 101',
    sourceSectionCode: '001-000',
    sourceEventId: '00000665',
    status: 'Scheduled',
    modality: 'In Person',
  });
  return renderToStaticMarkup(
    <OfferingGroupCard
      model={{
        group,
        active: true,
        inWorksheet: false,
        selectedCode: section.sectionCode,
        updatedLabel: null,
        worksheetDisabled: false,
        canEditWorksheet: true,
      }}
      actions={{
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        onToggleWorksheet: vi.fn(),
        setRef: vi.fn(),
      }}
    />,
  );
}

describe('UCSD snapshot Course Modal worksheet actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
  });

  it('shows the add button for a Worksheet term', async () => {
    expect(await renderCard(true)).toContain('Add A01 to Worksheet');
  });

  it('hides add and remove controls for a Catalog-only term', async () => {
    const markup = await renderCard(false);
    expect(markup).not.toContain('to Worksheet');
    expect(markup).not.toContain('from Worksheet');
  });

  it('shows exact TSS package and event status and blocks disabled packages', async () => {
    const markup = await renderTssPackageCard();

    expect(markup).toContain('SE00154333');
    expect(markup).toContain('Entry successfully validated');
    expect(markup).toContain('001-000');
    expect(markup).toContain('Event 00000665');
    expect(markup).toContain('Scheduled');
    expect(markup).toContain('In Person');
    expect(markup).toContain('Unavailable in TSS');
    expect(markup).toContain('disabled=""');
  });
});
