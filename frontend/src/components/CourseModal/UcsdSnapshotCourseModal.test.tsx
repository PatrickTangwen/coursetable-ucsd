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
});
