import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import CoursePlanningWorksheetToggleButton from './CoursePlanningWorksheetToggleButton';
import type { Season } from '../../queries/graphql-types';
import { createCoursePlanningListingFixture } from '../../testFixtures/coursePlanningListing';

vi.mock('../../hooks/useWorksheetListingSelection', () => ({
  useWorksheetListingSelection: () => ({
    disabled: false,
    getRelevantWorksheetNumber: () => 0,
    hasListing: () => false,
    hasSavedWorksheetAccount: false,
    toggleListing: vi.fn(),
  }),
}));

vi.mock('./WorksheetConflictIcon', () => ({ default: () => null }));

function listingFor(term: Season) {
  const listing = createCoursePlanningListingFixture(
    `${term}:CSE-3-A01`,
    'CSE 3',
  );
  listing.section.supportedTerm = term;
  return listing;
}

describe('CoursePlanningWorksheetToggleButton', () => {
  it('renders worksheet actions for a term in the Worksheet window', () => {
    const markup = renderToStaticMarkup(
      <CoursePlanningWorksheetToggleButton
        listing={listingFor('S126' as Season)}
        modal={false}
      />,
    );

    expect(markup).toContain('aria-label="Add to worksheet"');
  });

  it('hides worksheet actions for a Catalog-only term', () => {
    const markup = renderToStaticMarkup(
      <CoursePlanningWorksheetToggleButton
        listing={listingFor('SP26' as Season)}
        modal={false}
      />,
    );

    expect(markup).toBe('');
  });
});
