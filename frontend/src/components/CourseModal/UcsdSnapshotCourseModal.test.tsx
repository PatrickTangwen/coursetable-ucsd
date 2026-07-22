import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUcsdSnapshotModalCourse } from './ucsdSnapshotModalData';
import type { Fa26SectionMappingEntry } from '../../queries/fa26SectionMapping';
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
  return renderGroupCard({ OfferingGroupCard, group, canEditWorksheet });
}

function renderGroupCard({
  OfferingGroupCard,
  group,
  canEditWorksheet = true,
  mappingEntry,
}: {
  OfferingGroupCard: typeof import('./UcsdSnapshotCourseModal').OfferingGroupCard;
  group: ReturnType<typeof offeringGroup>;
  canEditWorksheet?: boolean;
  mappingEntry?: Fa26SectionMappingEntry;
}) {
  return renderToStaticMarkup(
    <OfferingGroupCard
      model={{
        group,
        active: true,
        mappingEntry,
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

  it('renders one component row per meeting type while preserving distinct schedules', async () => {
    const { OfferingGroupCard } = await import('./UcsdSnapshotCourseModal');
    const group = offeringGroup('FA26' as Season);
    group.sections[0]!.meetings = [
      {
        days: ['Monday'],
        date: null,
        startTime: '13:00',
        endTime: '13:50',
        building: 'WLH',
        room: '2111',
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'M',
        rawTime: '1:00pm-1:50pm',
        rawLocation: 'WLH 2111',
      },
      {
        days: ['Tuesday', 'Thursday'],
        date: null,
        startTime: '11:00',
        endTime: '12:20',
        building: 'WLH',
        room: '2111',
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'TuTh',
        rawTime: '11:00am-12:20pm',
        rawLocation: 'WLH 2111',
      },
      {
        days: ['Friday'],
        date: null,
        startTime: '09:00',
        endTime: '09:50',
        building: 'CENTR',
        room: '217A',
        isTba: false,
        meetingType: 'Discussion',
        rawDays: 'F',
        rawTime: '9:00am-9:50am',
        rawLocation: 'CENTR 217A',
      },
      {
        days: ['Wednesday'],
        date: null,
        startTime: '10:00',
        endTime: '10:50',
        building: 'CENTR',
        room: '217A',
        isTba: false,
        meetingType: 'Discussion',
        rawDays: 'W',
        rawTime: '10:00am-10:50am',
        rawLocation: 'CENTR 217A',
      },
      {
        days: ['Monday'],
        date: null,
        startTime: '14:00',
        endTime: '15:50',
        building: 'EBU3B',
        room: 'B250',
        isTba: false,
        meetingType: 'Laboratory',
        rawDays: 'M',
        rawTime: '2:00pm-3:50pm',
        rawLocation: 'EBU3B B250',
      },
      {
        days: ['Thursday'],
        date: null,
        startTime: '16:00',
        endTime: '17:50',
        building: 'EBU3B',
        room: 'B250',
        isTba: false,
        meetingType: 'Laboratory',
        rawDays: 'Th',
        rawTime: '4:00pm-5:50pm',
        rawLocation: 'EBU3B B250',
      },
    ];

    const markup = renderGroupCard({ OfferingGroupCard, group });

    expect(markup.match(/>Lecture<\/span>/gu)).toHaveLength(1);
    expect(markup.match(/>Discussion<\/span>/gu)).toHaveLength(1);
    expect(markup.match(/>Laboratory<\/span>/gu)).toHaveLength(1);
    expect(markup).toContain('1:00 – 1:50 PM');
    expect(markup).toContain('11:00 AM – 12:20 PM');
    expect(markup).toContain('9:00 – 9:50 AM');
    expect(markup).toContain('10:00 – 10:50 AM');
    expect(markup).toContain('2:00 – 3:50 PM');
    expect(markup).toContain('4:00 – 5:50 PM');
  });

  it('labels meeting rows A00 when a Fall 2026 offering has one section', async () => {
    const { OfferingGroupCard } = await import('./UcsdSnapshotCourseModal');
    const listing = createCoursePlanningListingFixture(
      'FA26:CSE-12-only-package',
      'CSE 12',
    );
    listing.section.sectionCode = '001-000-LE + 001-001-DI';
    listing.section.meetings = [
      {
        days: ['Monday', 'Wednesday', 'Friday'],
        date: null,
        startTime: '08:00',
        endTime: '08:50',
        building: 'WLH',
        room: '2001',
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'MWF',
        rawTime: '8:00am-8:50am',
        rawLocation: 'WLH 2001',
      },
      {
        days: ['Monday'],
        date: '2026-12-07',
        startTime: '08:00',
        endTime: '10:59',
        building: 'WLH',
        room: '2001',
        isTba: false,
        meetingType: 'Final',
        rawDays: 'M',
        rawTime: '8:00am-10:59am',
        rawLocation: 'WLH 2001',
      },
      {
        days: ['Monday'],
        date: null,
        startTime: '16:00',
        endTime: '16:50',
        building: 'WLH',
        room: '2001',
        isTba: false,
        meetingType: 'Discussion',
        rawDays: 'M',
        rawTime: '4:00pm-4:50pm',
        rawLocation: 'WLH 2001',
      },
    ];
    const modalCourse = buildUcsdSnapshotModalCourse(listing, [listing]);
    const [group] = modalCourse.groups;
    const mappingEntry = modalCourse.sectionMapping.bySectionId.get(
      listing.section.sectionId,
    );
    if (!group || !mappingEntry)
      throw new Error('Expected one mapped FA26 offering group');

    const markup = renderGroupCard({
      OfferingGroupCard,
      group,
      mappingEntry,
    });

    expect(markup.match(/>A00<\/div>/gu)).toHaveLength(3);
    expect(markup).toContain('Section A');
  });
});
