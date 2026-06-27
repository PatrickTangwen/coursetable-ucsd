import { useMemo } from 'react';
import { Dropdown, DropdownButton } from 'react-bootstrap';

import { useShallow } from 'zustand/react/shallow';
import { useFerry } from '../../hooks/useFerry';
import type { Season } from '../../queries/graphql-types';
import type { Option } from '../../search/searchTypes';
import { useStore } from '../../store';
import {
  getAnonymousWorksheetCourses,
  type AnonymousWorksheetState,
} from '../../utilities/anonymousWorksheet';
import { toSeasonString } from '../../utilities/course';
import { supportedTermCodes } from '../../utilities/termPlanning';
import { Popout } from '../Search/Popout';
import { PopoutSelect } from '../Search/PopoutSelect';

function useWorksheetSeasonCodes() {
  const fallbackSeasonCodes = useStore((state) =>
    state.worksheetMemo.getSeasonCodes(state),
  );
  const { courses } = useFerry();
  const registryTerms = useMemo(
    () =>
      Object.values(courses).flatMap((catalog) => catalog.metadata.terms ?? []),
    [courses],
  );
  return registryTerms.length > 0
    ? supportedTermCodes(registryTerms)
    : fallbackSeasonCodes;
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

function useAnonymousWorksheetCourseCounts() {
  const { anonymousWorksheet, isAnonymousWorksheet } = useStore(
    useShallow((state) => ({
      anonymousWorksheet: state.anonymousWorksheet,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
    })),
  );

  return useMemo(() => {
    if (!isAnonymousWorksheet) return {};
    return getAnonymousWorksheetCourseCountsByTerm(anonymousWorksheet);
  }, [anonymousWorksheet, isAnonymousWorksheet]);
}

function SeasonDropdownDesktop() {
  const seasonCodes = useWorksheetSeasonCodes();
  const anonymousCourseCounts = useAnonymousWorksheetCourseCounts();
  const { viewedSeason, changeViewedSeason } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      changeViewedSeason: state.changeViewedSeason,
    })),
  );

  const selectedSeason = useMemo(() => {
    if (viewedSeason) {
      return {
        value: viewedSeason,
        label: getSeasonLabel(
          viewedSeason,
          anonymousCourseCounts[viewedSeason],
        ),
      };
    }
    return null;
  }, [anonymousCourseCounts, viewedSeason]);

  return (
    <Popout
      buttonText="Season"
      displayOptionLabel
      maxDisplayOptions={1}
      selectedOptions={selectedSeason}
      clearIcon={false}
    >
      <PopoutSelect<Option<Season>, false>
        value={selectedSeason}
        options={seasonCodes.map((seasonCode) => ({
          value: seasonCode,
          label: getSeasonLabel(seasonCode, anonymousCourseCounts[seasonCode]),
        }))}
        onChange={(selectedOption) => {
          changeViewedSeason(selectedOption!.value);
        }}
        showControl={false}
        minWidth={200}
      />
    </Popout>
  );
}

function SeasonDropdownMobile() {
  const seasonCodes = useWorksheetSeasonCodes();
  const anonymousCourseCounts = useAnonymousWorksheetCourseCounts();
  const { viewedSeason, changeViewedSeason } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      changeViewedSeason: state.changeViewedSeason,
    })),
  );

  return (
    <DropdownButton
      variant="dark"
      title={getSeasonLabel(viewedSeason, anonymousCourseCounts[viewedSeason])}
      onSelect={(s) => changeViewedSeason(s as Season)}
    >
      {seasonCodes.map((season) => (
        <Dropdown.Item
          key={season}
          eventKey={season}
          className="d-flex"
          // Styling if this is the current season
          style={{
            backgroundColor:
              season === viewedSeason ? 'var(--color-primary)' : '',
          }}
        >
          <div className="mx-auto">
            {getSeasonLabel(season, anonymousCourseCounts[season])}
          </div>
        </Dropdown.Item>
      ))}
    </DropdownButton>
  );
}

function SeasonDropdown({ mobile }: { readonly mobile: boolean }) {
  return mobile ? <SeasonDropdownMobile /> : <SeasonDropdownDesktop />;
}

export default SeasonDropdown;
