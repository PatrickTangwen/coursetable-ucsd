import { useEffect } from 'react';

import { useCourseModalFromUrlQuery } from '../queries/graphql-queries';
import { useStore } from '../store';
import type { CourseModalUrlVariables } from '../utilities/modalHistoryUrl';

/** Inherited CourseTable/Yale URL hydration boundary. Never render for UCSD. */
export default function LegacyCourseModalUrlHydrator({
  variables,
  searchKey,
}: {
  readonly variables: CourseModalUrlVariables;
  readonly searchKey: string;
}) {
  const navigate = useStore((s) => s.navigate);
  const { data } = useCourseModalFromUrlQuery({
    variables: {
      listingId: variables.listingId,
      hasEvals: false,
    },
  });
  const course = data?.listings_by_pk ?? undefined;

  useEffect(() => {
    if (course) {
      navigate(
        'replace',
        { type: 'legacy-course', data: course },
        new URLSearchParams(searchKey),
      );
    }
  }, [course, navigate, searchKey]);

  return null;
}
