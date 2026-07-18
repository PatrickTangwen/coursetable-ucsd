import { useMemo } from 'react';
import { MdUpdate } from 'react-icons/md';
import { useCoursePlanningCatalog } from '../../hooks/useCoursePlanning';
import { useStore } from '../../store';
import {
  getCatalogLastUpdated,
  getCatalogStalenessLabel,
  toRelativeUpdateTime,
} from '../../utilities/catalogFreshness';
import { TextComponent } from '../Typography';

export default function LastUpdated() {
  const { courses } = useCoursePlanningCatalog();
  const selectedSeasons = useStore(
    (state) => state.searchFilters.selectSeasons,
  );
  const season =
    selectedSeasons.length === 1 ? selectedSeasons[0]!.value : null;
  const { lastUpdated, label } = useMemo(() => {
    const lastUpdated = getCatalogLastUpdated(courses);
    const label = season
      ? getCatalogStalenessLabel(courses, season)
      : `Updated ${toRelativeUpdateTime(lastUpdated)} ago`;
    return { lastUpdated, label };
  }, [courses, season]);
  return (
    <TextComponent type="tertiary" small className="mb-2 text-end" as="div">
      <MdUpdate className="me-1" />
      <time title={lastUpdated.toString()} dateTime={lastUpdated.toISOString()}>
        {label}
      </time>
    </TextComponent>
  );
}
