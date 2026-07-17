import type { WorksheetListingViewModel } from './worksheetCourse';
import type { CatalogListing } from '../queries/api';

/**
 * Keeps inherited CourseTable worksheet consumers behind one explicit boundary
 * while anonymous UCSD worksheets resolve from Course Planning models.
 */
export function legacyCatalogListingToWorksheetViewModel(
  listing: CatalogListing,
): WorksheetListingViewModel {
  const inherited = listing as CatalogListing & { section_id?: unknown };
  const sectionId =
    typeof inherited.section_id === 'string' && inherited.section_id
      ? inherited.section_id
      : String(listing.crn);
  return {
    ...listing,
    section_id: sectionId,
    course: listing.course,
  } as unknown as WorksheetListingViewModel;
}
