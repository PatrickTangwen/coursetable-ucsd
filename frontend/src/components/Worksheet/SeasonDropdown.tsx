import { useMemo } from 'react';

import { useShallow } from 'zustand/react/shallow';
import { useFerry } from '../../hooks/useFerry';
import type { Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import {
  getAnonymousWorksheetCourses,
  type AnonymousWorksheetState,
} from '../../utilities/anonymousWorksheet';
import {
  compareSeasonsByRecency,
  toSeasonString,
} from '../../utilities/course';
import { supportedTermCodes } from '../../utilities/termPlanning';
import { DropdownMenu } from '../Catalog/DropdownMenu';

export function useWorksheetSeasonCodes() {
  const fallbackSeasonCodes = useStore((state) =>
    state.worksheetMemo.getSeasonCodes(state),
  );
  const { courses } = useFerry();
  const registryTerms = useMemo(
    () =>
      Object.values(courses).flatMap((catalog) => catalog.metadata.terms ?? []),
    [courses],
  );
  return useMemo(() => {
    const seasonCodes =
      registryTerms.length > 0
        ? supportedTermCodes(registryTerms)
        : fallbackSeasonCodes;
    return [...seasonCodes].sort(compareSeasonsByRecency);
  }, [fallbackSeasonCodes, registryTerms]);
}

export function getSeasonLabel(
  season: Season,
  courseCount: number | undefined,
) {
  const label = toSeasonString(season);
  return courseCount ? `${label} · ${courseCount}` : label;
}

export function getAnonymousWorksheetCourseCountsByTerm(
  anonymousWorksheet: AnonymousWorksheetState,
) {
  const counts: { [term: string]: number } = {};
  for (const term of Object.keys(anonymousWorksheet.coursesByTerm)) {
    const count = getAnonymousWorksheetCourses(
      anonymousWorksheet,
      term as Season,
    ).length;
    if (count > 0) counts[term] = count;
  }
  return counts;
}

export function SeasonDropdownMenu({
  onChange,
}: {
  readonly onChange?: (season: Season) => void;
}) {
  const seasonCodes = useWorksheetSeasonCodes();
  const { viewedSeason, changeViewedSeason } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      changeViewedSeason: state.changeViewedSeason,
    })),
  );
  const handleChange = onChange ?? changeViewedSeason;

  const selectedSeasonLabel = toSeasonString(viewedSeason);
  const seasonOptions = useMemo(
    () =>
      seasonCodes.map((seasonCode) => ({
        value: seasonCode,
        label: toSeasonString(seasonCode),
      })),
    [seasonCodes],
  );

  return (
    <DropdownMenu
      label="Term"
      displayLabel={selectedSeasonLabel}
      options={seasonOptions}
      selectedValues={[viewedSeason]}
      onToggle={(season) => handleChange(season as Season)}
      closeOnToggle
      showCheckbox={false}
    />
  );
}

function SeasonDropdown({ mobile }: { readonly mobile: boolean }) {
  void mobile;
  return <SeasonDropdownMenu />;
}

export default SeasonDropdown;
