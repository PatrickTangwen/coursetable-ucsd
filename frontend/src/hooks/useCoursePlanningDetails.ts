import { useEffect, useReducer, useState } from 'react';

import { loadCatalogPastGrades } from '../ferry/ferryCatalogDetailsCache';
import type { CoursePlanningPastGrade } from '../queries/coursePlanningViewModels';
import type { Season } from '../queries/graphql-types';

type DetailResolution = {
  key: string;
  records: CoursePlanningPastGrade[];
  error: Error | null;
};

export function useCoursePlanningPastGrades({
  season,
  courseId,
  initialRecords,
  archiveRecordCount,
  enabled,
}: {
  season: Season;
  courseId: string;
  initialRecords: CoursePlanningPastGrade[];
  archiveRecordCount: number;
  enabled: boolean;
}) {
  const [retryAttempt, retry] = useReducer((attempt) => attempt + 1, 0);
  const [resolution, setResolution] = useState<DetailResolution | null>(null);
  const hasEmbeddedDetails =
    initialRecords.length > 0 || archiveRecordCount === 0;
  const key = `${season}:${courseId}:${retryAttempt}`;
  const currentResolution = resolution?.key === key ? resolution : null;
  const shouldLoad = enabled && !hasEmbeddedDetails;

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let active = true;
    void loadCatalogPastGrades(season, courseId).then(
      (records) => {
        if (active) setResolution({ key, records, error: null });
      },
      (error: unknown) => {
        if (!active) return;
        setResolution({
          key,
          records: [],
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [courseId, key, season, shouldLoad]);

  return {
    records: hasEmbeddedDetails
      ? initialRecords
      : (currentResolution?.records ?? []),
    loading: shouldLoad && !currentResolution,
    error: shouldLoad ? (currentResolution?.error ?? null) : null,
    retry,
  };
}
