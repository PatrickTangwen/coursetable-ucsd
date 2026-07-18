import type { CourseModalUrlVariables } from './modalHistoryUrl';

/** Numeric season codes belong to the inherited CourseTable/Yale boundary. */
export function isLegacyCourseModalUrl(
  variables: CourseModalUrlVariables | undefined,
): variables is CourseModalUrlVariables {
  return Boolean(variables && Number.isFinite(Number(variables.seasonCode)));
}
