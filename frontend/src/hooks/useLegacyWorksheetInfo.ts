import { useMemo } from 'react';

import { useLegacyCourseData } from './useLegacyFerry';
import type { UserWorksheets } from '../queries/api';
import type { Season } from '../queries/graphql-types';
import { legacyCatalogListingToWorksheetViewModel } from '../types/legacyWorksheetCourse';
import type { WorksheetCourse } from '../types/worksheetCourse';

/**
 * Inherited CourseTable/Yale Worksheet resolver. Active UCSD paths bypass it.
 */
export function useLegacyWorksheetInfo(
  worksheets: UserWorksheets | undefined,
  season: Season[],
  getWorksheetNumber: (seasonCode: Season) => number,
): { loading: boolean; error: object | null; data: WorksheetCourse[] };
export function useLegacyWorksheetInfo(
  worksheets: UserWorksheets | undefined,
  season: Season,
  worksheetNumber: number,
): { loading: boolean; error: object | null; data: WorksheetCourse[] };
export function useLegacyWorksheetInfo(
  worksheets: UserWorksheets | undefined,
  season: Season | Season[],
  worksheetNumber: number | ((seasonCode: Season) => number),
) {
  const requestedSeasons = useMemo(() => {
    if (!worksheets) return [];
    if (Array.isArray(season)) return season.filter((x) => worksheets.has(x));
    if (worksheets.has(season)) return [season];
    return [];
  }, [season, worksheets]);

  const { loading, error, courses } = useLegacyCourseData(requestedSeasons);

  const data = useMemo(() => {
    const dataReturn: WorksheetCourse[] = [];
    if (!worksheets || loading || error) return dataReturn;

    for (const seasonCode of requestedSeasons) {
      const seasonWorksheets = worksheets.get(seasonCode)!;
      const worksheet = seasonWorksheets.get(
        typeof worksheetNumber === 'number'
          ? worksheetNumber
          : worksheetNumber(seasonCode),
      );
      if (!worksheet) continue;
      for (const { crn, color, hidden } of worksheet.courses) {
        const listing = courses[seasonCode]!.data.get(crn);
        if (listing) {
          dataReturn.push({
            crn,
            color,
            listing: legacyCatalogListingToWorksheetViewModel(listing),
            hidden,
          });
        }
      }
    }
    return dataReturn.sort((a, b) =>
      a.listing.course_code.localeCompare(b.listing.course_code, 'en-US'),
    );
  }, [requestedSeasons, courses, worksheets, worksheetNumber, loading, error]);
  return { loading, error, data };
}
