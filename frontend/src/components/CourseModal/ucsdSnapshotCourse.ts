import type { CourseModalPrefetchListingDataFragment } from '../../generated/graphql-types';
import {
  getUcsdArchiveDetails,
  type UcsdCourseArchive,
} from '../../queries/ucsdCatalogSnapshot';

type RuntimeUcsdCourseSignals = {
  readonly ucsd_archive?: unknown;
  readonly ucsd_calendar?: unknown;
  readonly school?: unknown;
  readonly section_id?: unknown;
};

export type UcsdSnapshotCourseDetails = {
  readonly archive: UcsdCourseArchive | null;
  readonly isUcsdSnapshotCourse: boolean;
};

function hasUcsdRuntimeSignal(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const signals = value as RuntimeUcsdCourseSignals;
  return (
    signals.ucsd_archive !== undefined ||
    signals.ucsd_calendar !== undefined ||
    signals.school === 'UCSD' ||
    (typeof signals.section_id === 'string' && signals.section_id.includes(':'))
  );
}

export function getUcsdSnapshotCourseDetails(
  listing: CourseModalPrefetchListingDataFragment,
): UcsdSnapshotCourseDetails {
  const archive = getUcsdArchiveDetails(listing.course);
  const seasonCode = String(listing.course.season_code);

  return {
    archive,
    isUcsdSnapshotCourse:
      archive !== null ||
      hasUcsdRuntimeSignal(listing) ||
      hasUcsdRuntimeSignal(listing.course) ||
      !Number.isFinite(Number(seasonCode)),
  };
}
