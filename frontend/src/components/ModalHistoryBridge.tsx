import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import LegacyCourseModalUrlHydrator from './LegacyCourseModalUrlHydrator';
import { useCoursePlanningCatalog } from '../hooks/useCoursePlanning';
import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';
import { useStore } from '../store';
import { isLegacyCourseModalUrl } from '../utilities/legacyCourseModalUrl';
import {
  getCoursePlanningCourseFromModalUrl,
  parseCourseModalQuery,
} from '../utilities/modalHistoryUrl';

function useProfInfoFromURL(): number | undefined {
  const [searchParams] = useSearchParams();
  const profModal = searchParams.get('prof-modal');
  if (!profModal) return undefined;
  const id = Number(profModal);
  return Number.isFinite(id) ? id : undefined;
}

/**
 * Hydrates modal history from URL query params and clears suppression when the
 * URL no longer carries modal keys (after closeModal / navigation).
 */
export default function ModalHistoryBridge() {
  const [searchParams] = useSearchParams();
  const historyLen = useStore((s) => s.history.length);
  const suppressInitialFromUrl = useStore((s) => s.suppressInitialFromUrl);
  const navigate = useStore((s) => s.navigate);
  const clearUrlSuppression = useStore((s) => s.clearUrlSuppression);

  const isInitial = historyLen === 0;
  const courseVariables = parseCourseModalQuery(
    searchParams.get('course-modal'),
  );
  const { courses, loading } = useCoursePlanningCatalog();
  const courseFromURL: CoursePlanningListing | undefined =
    getCoursePlanningCourseFromModalUrl(courses, courseVariables);
  const profFromURL = useProfInfoFromURL();

  const searchKey = searchParams.toString();

  const prevCourseModalRef = useRef<string | null | undefined>(undefined);
  const prevProfModalRef = useRef<string | null | undefined>(undefined);

  // After popping the last frame, suppress blocks re-open from the same URL.
  // Clear suppression when course-modal / prof-modal *values* change so
  // another deep link hydrates. Do not clear on unrelated searchKey edits.
  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const c = params.get('course-modal');
    const p = params.get('prof-modal');
    const hadPrev = prevCourseModalRef.current !== undefined;
    const modalParamsChanged =
      hadPrev &&
      (c !== prevCourseModalRef.current || p !== prevProfModalRef.current);
    prevCourseModalRef.current = c;
    prevProfModalRef.current = p;
    if (
      suppressInitialFromUrl &&
      historyLen === 0 &&
      (c !== null || p !== null) &&
      modalParamsChanged
    )
      clearUrlSuppression();
  }, [clearUrlSuppression, historyLen, searchKey, suppressInitialFromUrl]);

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    if (
      !params.has('course-modal') &&
      !params.has('prof-modal') &&
      suppressInitialFromUrl
    )
      clearUrlSuppression();
  }, [clearUrlSuppression, searchKey, suppressInitialFromUrl]);

  useEffect(() => {
    if (suppressInitialFromUrl) return;
    if (historyLen > 0) return;
    const params = new URLSearchParams(searchKey);
    if (courseFromURL) {
      navigate(
        'replace',
        { type: 'course-planning', data: courseFromURL },
        params,
      );
      return;
    }
    if (profFromURL !== undefined)
      navigate('replace', { type: 'professor', data: profFromURL }, params);
  }, [
    courseFromURL,
    historyLen,
    navigate,
    profFromURL,
    searchKey,
    suppressInitialFromUrl,
  ]);

  const shouldHydrateLegacyCourse =
    isInitial &&
    !suppressInitialFromUrl &&
    !loading &&
    courseFromURL === undefined &&
    isLegacyCourseModalUrl(courseVariables);

  return shouldHydrateLegacyCourse ? (
    <LegacyCourseModalUrlHydrator
      variables={courseVariables}
      searchKey={searchKey}
    />
  ) : null;
}
