import { useEffect, useMemo, useRef } from 'react';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { memoize } from 'proxy-memoize';
import { toast } from 'sonner';
import { z } from 'zod';
import type { StateCreator } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CUR_SEASON } from '../config';
import { seasons as allSeasons } from '../data/catalogSeasons';
import { useCourseData, useWorksheetInfo } from '../hooks/useFerry';
import {
  createBlankSavedWorksheet,
  ensureMainSavedWorksheet,
  fetchSavedWorksheet,
  fetchSavedWorksheets,
  isLegacyUserInfo,
  type SavedWorksheet,
  type SavedWorksheetSummary,
  type UserWorksheets,
} from '../queries/api';
import {
  type Season,
  type Crn,
  type NetId,
  crnSchema,
  seasonSchema,
} from '../queries/graphql-types';
import type { Option } from '../search/searchTypes';
import { type Store, useStore } from '../store';
import type { WorksheetCourse } from '../types/worksheetCourse';
import {
  ANONYMOUS_WORKSHEET_NAME,
  addListingToAnonymousWorksheet,
  anonymousWorksheetFromShare,
  readAnonymousWorksheetStorage,
  removeListingFromAnonymousWorksheet,
  resolveAnonymousWorksheet,
  setAllAnonymousWorksheetCoursesHidden,
  setAnonymousWorksheetCourseColor,
  setAnonymousWorksheetCourseHidden,
  writeAnonymousWorksheetStorage,
  type AnonymousWorksheetListing,
  type AnonymousWorksheetShare,
  type AnonymousWorksheetState,
} from '../utilities/anonymousWorksheet';
import { worksheetColors } from '../utilities/constants';
import {
  buildRestoredAnonymousWorksheet,
  type SavedWorksheetRestoreSource,
} from '../utilities/savedWorksheet';

// Utility Types
export type WorksheetView = 'calendar' | 'list' | 'map';

export type { WorksheetCourse };

const DEFAULT_BLANK_SAVED_WORKSHEET_NAME = 'New Worksheet';

const exoticWorksheetSchema = z.object({
  season: seasonSchema,
  name: z.string(),
  // Only missing for legacy worksheets
  creatorName: z.string().optional(),
  courses: z.array(
    z.object({
      crn: crnSchema,
      color: z.string(),
      hidden: z.boolean(),
      same_course_id: z.number().nullable().optional(),
    }),
  ),
});

export type ExoticWorksheet = z.infer<typeof exoticWorksheetSchema>;

// Slice Types
interface WorksheetState {
  // These define which courses the store contains
  viewedPerson: 'me' | NetId;
  viewedSeason: Season;
  viewedWorksheetNumber: number;

  // An exotic worksheet is one that is imported via the URL or file upload.
  // Exotic worksheets do not have a corresponding worksheet in the worksheets
  // data structure and do not use any of the other worksheet-related data.
  exoticWorksheet:
    | { data: ExoticWorksheet; worksheets: UserWorksheets }
    | undefined;
  viewAnonymousWorksheet: boolean;
  anonymousWorksheet: AnonymousWorksheetState;
  anonymousWorksheetMissingSectionIds: string[];
  activeSavedWorksheet: SavedWorksheet | undefined;
  activeSavedWorksheetOwnerId: number | undefined;
  activeSavedWorksheetIdsByTerm: { [term: string]: number | undefined };
  savedWorksheetSummaries: SavedWorksheetSummary[];
  savedWorksheetListStatus: 'idle' | 'loading' | 'ready' | 'error';
  savedWorksheetListError: Error | null;
  savedWorksheetBootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  savedWorksheetBootstrapError: Error | null;

  // Affect visual display
  worksheetView: WorksheetView;
  hoverCourse: Crn | null;

  // These are used to select the worksheet
  seasonCodes: Season[];
  // Controls which courses are displayed
  courses: WorksheetCourse[];
  worksheetLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  worksheetError: {} | null;
}

interface WorksheetActions {
  changeViewedPerson: (newPerson: WorksheetState['viewedPerson']) => void;
  changeViewedSeason: (seasonCode: WorksheetState['viewedSeason']) => void;
  changeViewedWorksheetNumber: (
    worksheetNumber: WorksheetState['viewedWorksheetNumber'],
  ) => void;

  // When powering features like conflicting schedules and deciding which
  // worksheet the toggle button should affect, we need to pick a number when
  // given the course's season. We cannot use viewedWorksheetNumber, because
  // if we are viewing worksheet 2 of season X, there's no reason that worksheet
  // 2 of season Y should be the same thing or even exist. Therefore, this
  // function returns 0 unless (viewedPerson, viewedSeason) = ('me', seasonCode)
  getRelevantWorksheetNumber: (seasonCode: Season) => number;

  exitExoticWorksheet: () => void;
  restoreAnonymousWorksheetFromShare: (share: AnonymousWorksheetShare) => void;
  restoreSavedWorksheet: (worksheet: SavedWorksheetRestoreSource) => void;
  ensureMainSavedWorksheetForTerm: (term: Season) => Promise<void>;
  refreshSavedWorksheetsForTerm: (
    term: Season,
  ) => Promise<SavedWorksheetSummary[]>;
  selectSavedWorksheet: (id: number) => Promise<boolean>;
  createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  addAnonymousWorksheetListing: (
    listing: AnonymousWorksheetListing,
    color: string,
  ) => boolean;
  removeAnonymousWorksheetListing: (
    listing: AnonymousWorksheetListing,
  ) => boolean;
  setAnonymousWorksheetListingHidden: (
    listing: AnonymousWorksheetListing,
    hidden: boolean,
  ) => void;
  setAnonymousWorksheetListingColor: (
    listing: AnonymousWorksheetListing,
    color: string,
  ) => void;
  setAllAnonymousWorksheetHidden: (hidden: boolean) => void;
  clearAnonymousWorksheet: () => void;
  setAnonymousWorksheetMissingSectionIds: (sectionIds: string[]) => void;

  changeWorksheetView: (view: WorksheetState['worksheetView']) => void;
  setHoverCourse: (course: WorksheetState['hoverCourse']) => void;

  setWorksheetInfo: (
    courses: WorksheetState['courses'],
    worksheetLoading: WorksheetState['worksheetLoading'],
    worksheetError: WorksheetState['worksheetError'],
  ) => void;
}

// Memoized Values
interface WorksheetSliceMemo {
  worksheetMemo: {
    getCurWorksheet: (state: Store) => UserWorksheets;
    getSeasonCodes: (state: Store) => Season[];
    getIsExoticWorksheet: (state: Store) => boolean;
    getIsAnonymousWorksheet: (state: Store) => boolean;
    getIsReadonlyWorksheet: (state: Store) => boolean;
    getViewedWorksheetName: (state: Store) => string;
    getIsViewedWorksheetPrivate: (state: Store) => boolean;
  };
}

export interface WorksheetSlice
  extends WorksheetState, WorksheetActions, WorksheetSliceMemo {}

export function parseCoursesFromURL(): WorksheetState['exoticWorksheet'] {
  const searchParams = new URLSearchParams(window.location.search);
  if (!searchParams.has('ws')) return undefined;
  const serial = decompressFromEncodedURIComponent(searchParams.get('ws')!);
  const parsed: unknown = JSON.parse(serial);
  const courses = exoticWorksheetSchema.safeParse(parsed);
  if (!courses.success) {
    toast.error('Invalid worksheet data from URL');
    return undefined;
  }
  return {
    data: courses.data,
    worksheets: new Map([
      [
        courses.data.season,
        new Map([
          [
            0,
            {
              name: courses.data.name,
              courses: courses.data.courses.map((c) => ({
                crn: c.crn,
                color: c.color,
                hidden: c.hidden as boolean | null,
                same_course_id: c.same_course_id ?? null,
              })),
              private: false,
            },
          ],
        ]),
      ],
    ]),
  };
}

function summarizeSavedWorksheet(
  worksheet: SavedWorksheet,
): SavedWorksheetSummary {
  return {
    id: worksheet.id,
    name: worksheet.name,
    term: worksheet.term,
    createdAt: worksheet.createdAt,
    updatedAt: worksheet.updatedAt,
    private: worksheet.private,
    isMain: worksheet.isMain,
    sectionCount: worksheet.sections.length,
  };
}

export const createWorksheetSlice: StateCreator<
  Store,
  [],
  [],
  WorksheetSlice
> = (set, get) => {
  const setAnonymousWorksheet = (worksheet: AnonymousWorksheetState) => {
    writeAnonymousWorksheetStorage(worksheet);
    set({
      anonymousWorksheet: worksheet,
      viewedPerson: 'me',
      viewedSeason: worksheet.term,
      viewedWorksheetNumber: 0,
    });
  };
  const toError = (error: unknown) =>
    error instanceof Error ? error : new Error(String(error));
  const hasSavedWorksheetAccount = () => {
    const { authStatus, user } = get();
    return authStatus === 'authenticated' && user && !isLegacyUserInfo(user);
  };
  const activateSavedWorksheet = (
    worksheet: SavedWorksheet,
    userId: number,
  ) => {
    const summary = summarizeSavedWorksheet(worksheet);
    const summaries = [
      summary,
      ...get().savedWorksheetSummaries.filter(
        (savedWorksheet) => savedWorksheet.id !== summary.id,
      ),
    ].sort((a, b) => b.createdAt - a.createdAt);

    set({
      activeSavedWorksheet: worksheet,
      activeSavedWorksheetOwnerId: userId,
      activeSavedWorksheetIdsByTerm: {
        ...get().activeSavedWorksheetIdsByTerm,
        [worksheet.term]: worksheet.id,
      },
      savedWorksheetBootstrapStatus: 'ready',
      savedWorksheetBootstrapError: null,
      viewedPerson: 'me',
      viewedSeason: worksheet.term,
      viewedWorksheetNumber: 0,
      viewAnonymousWorksheet: false,
      exoticWorksheet: undefined,
      savedWorksheetSummaries: summaries,
      savedWorksheetListStatus: 'ready',
      savedWorksheetListError: null,
    });
  };

  return {
    viewedPerson: 'me',
    viewedSeason: CUR_SEASON,
    viewedWorksheetNumber: 0,
    changeViewedPerson(newPerson) {
      set({ viewedWorksheetNumber: 0, viewedPerson: newPerson });
    },
    changeViewedSeason(seasonCode) {
      set({ viewedWorksheetNumber: 0, viewedSeason: seasonCode });
    },
    changeViewedWorksheetNumber(worksheetNumber) {
      set({ viewedWorksheetNumber: worksheetNumber });
    },
    getRelevantWorksheetNumber(seasonCode) {
      if (get().viewedPerson !== 'me' || seasonCode !== get().viewedSeason)
        return 0;
      return get().viewedWorksheetNumber;
    },
    exoticWorksheet: undefined,
    viewAnonymousWorksheet: false,
    anonymousWorksheet: readAnonymousWorksheetStorage(CUR_SEASON),
    anonymousWorksheetMissingSectionIds: [],
    activeSavedWorksheet: undefined,
    activeSavedWorksheetOwnerId: undefined,
    activeSavedWorksheetIdsByTerm: {},
    savedWorksheetSummaries: [],
    savedWorksheetListStatus: 'idle',
    savedWorksheetListError: null,
    savedWorksheetBootstrapStatus: 'idle',
    savedWorksheetBootstrapError: null,
    exitExoticWorksheet() {
      set({
        exoticWorksheet: undefined,
      });
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.delete('ws');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${searchParams}`,
      );
      if (isLegacyUserInfo(get().user)) void get().worksheetsRefresh();
    },
    restoreAnonymousWorksheetFromShare(share) {
      setAnonymousWorksheet(
        anonymousWorksheetFromShare(
          share,
          (index) => worksheetColors[index % worksheetColors.length]!,
        ),
      );
      set({ viewAnonymousWorksheet: true });
    },
    restoreSavedWorksheet(worksheet) {
      setAnonymousWorksheet(buildRestoredAnonymousWorksheet(worksheet));
      set({ viewAnonymousWorksheet: true, exoticWorksheet: undefined });
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete('ws');
        searchParams.delete('t');
        searchParams.delete('sections');
        const nextSearch = searchParams.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
        );
      }
    },
    async ensureMainSavedWorksheetForTerm(term) {
      const { user, savedWorksheetBootstrapStatus } = get();
      if (
        !hasSavedWorksheetAccount() ||
        savedWorksheetBootstrapStatus === 'loading'
      )
        return;

      set({
        savedWorksheetBootstrapStatus: 'loading',
        savedWorksheetBootstrapError: null,
      });

      try {
        const mainWorksheet = await ensureMainSavedWorksheet(term);
        if (!mainWorksheet || !user || isLegacyUserInfo(user)) {
          set({
            savedWorksheetBootstrapStatus: 'error',
            savedWorksheetBootstrapError: new Error(
              'Failed to open Main Worksheet',
            ),
          });
          return;
        }

        const summaries = await get().refreshSavedWorksheetsForTerm(term);
        const rememberedId = get().activeSavedWorksheetIdsByTerm[term];
        const rememberedExists = summaries.some(
          (worksheet) => worksheet.id === rememberedId,
        );

        if (
          rememberedId &&
          rememberedId !== mainWorksheet.id &&
          rememberedExists
        ) {
          const rememberedWorksheet = await fetchSavedWorksheet(rememberedId);
          if (rememberedWorksheet?.term === term) {
            activateSavedWorksheet(rememberedWorksheet, user.user_id);
            return;
          }
        }

        activateSavedWorksheet(mainWorksheet, user.user_id);
      } catch (error: unknown) {
        set({
          savedWorksheetBootstrapStatus: 'error',
          savedWorksheetBootstrapError: toError(error),
        });
      }
    },
    async refreshSavedWorksheetsForTerm(term) {
      if (!hasSavedWorksheetAccount()) return [];

      set({
        savedWorksheetListStatus: 'loading',
        savedWorksheetListError: null,
      });

      try {
        const response = await fetchSavedWorksheets(term);
        const summaries = response?.data ?? [];
        set({
          savedWorksheetSummaries: summaries,
          savedWorksheetListStatus: 'ready',
          savedWorksheetListError: null,
        });
        return summaries;
      } catch (error: unknown) {
        set({
          savedWorksheetListStatus: 'error',
          savedWorksheetListError: toError(error),
        });
        return [];
      }
    },
    async selectSavedWorksheet(id) {
      const { user } = get();
      if (!hasSavedWorksheetAccount() || !user || isLegacyUserInfo(user))
        return false;

      const worksheet = await fetchSavedWorksheet(id);
      if (!worksheet) return false;
      activateSavedWorksheet(worksheet, user.user_id);
      return true;
    },
    async createBlankSavedWorksheetForTerm(term) {
      const { user } = get();
      if (!hasSavedWorksheetAccount() || !user || isLegacyUserInfo(user))
        return false;

      set({
        savedWorksheetListStatus: 'loading',
        savedWorksheetListError: null,
      });

      const worksheet = await createBlankSavedWorksheet({
        name: DEFAULT_BLANK_SAVED_WORKSHEET_NAME,
        term,
      });
      if (!worksheet) {
        set({
          savedWorksheetListStatus: 'error',
          savedWorksheetListError: new Error(
            'Failed to create blank Saved Worksheet',
          ),
        });
        return false;
      }

      activateSavedWorksheet(worksheet, user.user_id);
      return true;
    },
    addAnonymousWorksheetListing(listing, color) {
      const current = get().anonymousWorksheet;
      const next = addListingToAnonymousWorksheet(current, listing, color);
      if (next === current) return false;
      setAnonymousWorksheet(next);
      return true;
    },
    removeAnonymousWorksheetListing(listing) {
      const current = get().anonymousWorksheet;
      const next = removeListingFromAnonymousWorksheet(current, listing);
      if (next === current) return false;
      setAnonymousWorksheet(next);
      return true;
    },
    setAnonymousWorksheetListingHidden(listing, hidden) {
      setAnonymousWorksheet(
        setAnonymousWorksheetCourseHidden(
          get().anonymousWorksheet,
          listing,
          hidden,
        ),
      );
    },
    setAnonymousWorksheetListingColor(listing, color) {
      setAnonymousWorksheet(
        setAnonymousWorksheetCourseColor(
          get().anonymousWorksheet,
          listing,
          color,
        ),
      );
    },
    setAllAnonymousWorksheetHidden(hidden) {
      setAnonymousWorksheet(
        setAllAnonymousWorksheetCoursesHidden(get().anonymousWorksheet, hidden),
      );
    },
    clearAnonymousWorksheet() {
      setAnonymousWorksheet({
        term: get().anonymousWorksheet.term,
        courses: [],
      });
    },
    setAnonymousWorksheetMissingSectionIds(sectionIds) {
      set({ anonymousWorksheetMissingSectionIds: sectionIds });
    },
    worksheetView: 'calendar',
    hoverCourse: null,
    changeWorksheetView(view) {
      set({ worksheetView: view });
      window.scrollTo({ top: 0, left: 0 });
    },
    setHoverCourse(course) {
      set({ hoverCourse: course });
    },
    seasonCodes: [],
    courses: [],
    worksheetLoading: false,
    worksheetError: null,
    setWorksheetInfo(courses, worksheetLoading, worksheetError) {
      set({ courses, worksheetLoading, worksheetError });
    },
    worksheetMemo: {
      getCurWorksheet: memoize(
        (state: Store): UserWorksheets =>
          ((state.viewedPerson === 'me'
            ? state.worksheets
            : state.friends?.[state.viewedPerson]?.worksheets) ??
            new Map()) as UserWorksheets,
      ),
      getSeasonCodes: memoize(() => allSeasons),
      getIsExoticWorksheet: memoize((state: Store) =>
        Boolean(state.exoticWorksheet),
      ),
      getIsAnonymousWorksheet: memoize(
        (state: Store) =>
          (state.authStatus === 'unauthenticated' ||
            state.viewAnonymousWorksheet) &&
          !state.exoticWorksheet,
      ),
      // A readonly worksheet is anything that doesn't belong to the user—either
      // exotic or a friend's worksheet.
      getIsReadonlyWorksheet: memoize(
        (state: Store) =>
          state.worksheetMemo.getIsExoticWorksheet(state) ||
          state.viewedPerson !== 'me',
      ),
      getViewedWorksheetName: memoize(
        (state: Store) =>
          state.exoticWorksheet?.data.name ??
          (state.worksheetMemo.getIsAnonymousWorksheet(state)
            ? ANONYMOUS_WORKSHEET_NAME
            : undefined) ??
          state.activeSavedWorksheet?.name ??
          state.worksheetMemo
            .getCurWorksheet(state)
            .get(state.viewedSeason)
            ?.get(state.viewedWorksheetNumber)?.name ??
          (state.viewedWorksheetNumber === 0
            ? 'Main Worksheet'
            : 'Unnamed Worksheet'),
      ),
      getIsViewedWorksheetPrivate: memoize((state: Store) =>
        state.worksheetMemo.getIsAnonymousWorksheet(state)
          ? false
          : (state.activeSavedWorksheet?.private ??
            state.worksheetMemo
              .getCurWorksheet(state)
              .get(state.viewedSeason)
              ?.get(state.viewedWorksheetNumber)?.private ??
            false),
      ),
    },
  };
};

// Effects should be used for values with React dependencies
export const useWorksheetEffects = () => {
  const {
    exoticWorksheet,
    anonymousWorksheet,
    activeSavedWorksheet,
    isAnonymousWorksheet,
    curWorksheet,
    viewedSeason,
    viewedWorksheetNumber,
    setWorksheetInfo,
    setAnonymousWorksheetMissingSectionIds,
  } = useStore(
    useShallow((state) => ({
      exoticWorksheet: state.exoticWorksheet,
      anonymousWorksheet: state.anonymousWorksheet,
      activeSavedWorksheet: state.activeSavedWorksheet,
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      curWorksheet: state.worksheetMemo.getCurWorksheet(state),
      viewedSeason: state.viewedSeason,
      viewedWorksheetNumber: state.viewedWorksheetNumber,
      setWorksheetInfo: state.setWorksheetInfo,
      setAnonymousWorksheetMissingSectionIds:
        state.setAnonymousWorksheetMissingSectionIds,
    })),
  );

  const anonymousRequestedSeasons = useMemo(
    () => (isAnonymousWorksheet ? [anonymousWorksheet.term] : []),
    [anonymousWorksheet.term, isAnonymousWorksheet],
  );
  const savedWorksheetRequestedSeasons = useMemo(
    () =>
      !isAnonymousWorksheet && activeSavedWorksheet
        ? [activeSavedWorksheet.term]
        : [],
    [activeSavedWorksheet, isAnonymousWorksheet],
  );
  const requestedSeasons = useMemo(
    () => [
      ...new Set([
        ...anonymousRequestedSeasons,
        ...savedWorksheetRequestedSeasons,
      ]),
    ],
    [anonymousRequestedSeasons, savedWorksheetRequestedSeasons],
  );
  const { courses: catalogCourses } = useCourseData(requestedSeasons);
  const anonymousResolved = useMemo(
    () =>
      resolveAnonymousWorksheet(
        anonymousWorksheet,
        catalogCourses[anonymousWorksheet.term]?.data,
      ),
    [anonymousWorksheet, catalogCourses],
  );
  const activeSavedWorksheetState = useMemo(
    () =>
      activeSavedWorksheet
        ? buildRestoredAnonymousWorksheet(activeSavedWorksheet)
        : null,
    [activeSavedWorksheet],
  );
  const activeSavedWorksheetResolved = useMemo(
    () =>
      activeSavedWorksheetState
        ? resolveAnonymousWorksheet(
            activeSavedWorksheetState,
            catalogCourses[activeSavedWorksheetState.term]?.data,
          )
        : null,
    [activeSavedWorksheetState, catalogCourses],
  );
  const anonymousMissingKey =
    anonymousResolved.missingSectionIds.length > 0
      ? anonymousResolved.missingSectionIds.join('\n')
      : '';
  const lastWarnedAnonymousMissingKey = useRef('');

  useEffect(() => {
    if (!isAnonymousWorksheet) {
      setAnonymousWorksheetMissingSectionIds([]);
      lastWarnedAnonymousMissingKey.current = '';
      return;
    }
    setAnonymousWorksheetMissingSectionIds(anonymousResolved.missingSectionIds);
    if (
      anonymousMissingKey &&
      anonymousMissingKey !== lastWarnedAnonymousMissingKey.current
    ) {
      lastWarnedAnonymousMissingKey.current = anonymousMissingKey;
      toast.warning(
        `Some worksheet sections are no longer in this snapshot: ${anonymousResolved.missingSectionIds.join(', ')}`,
      );
    }
  }, [
    anonymousMissingKey,
    anonymousResolved.missingSectionIds,
    isAnonymousWorksheet,
    setAnonymousWorksheetMissingSectionIds,
  ]);

  const {
    loading: worksheetLoading,
    error: worksheetError,
    data: courses,
  } = useWorksheetInfo(
    exoticWorksheet?.worksheets ??
      (isAnonymousWorksheet
        ? anonymousResolved.worksheets
        : (activeSavedWorksheetResolved?.worksheets ?? curWorksheet)),
    exoticWorksheet?.data.season ??
      (isAnonymousWorksheet
        ? anonymousWorksheet.term
        : (activeSavedWorksheet?.term ?? viewedSeason)),
    exoticWorksheet || isAnonymousWorksheet || activeSavedWorksheet
      ? 0
      : viewedWorksheetNumber,
  );
  setWorksheetInfo(courses, worksheetLoading, worksheetError);
};

export type WorksheetNumberOption = Option<number> & {
  isPrivate: undefined | boolean;
};

// Auxiliary Functions
export function useWorksheetNumberOptions(
  person: 'me' | NetId,
  season: Season,
): { [worksheetNumber: number]: WorksheetNumberOption } {
  const { worksheets, friends } = useStore(
    useShallow((state) => ({
      worksheets: state.worksheets,
      friends: state.friends,
    })),
  );

  const seasonWorksheet = (
    person === 'me' ? worksheets : friends?.[person]?.worksheets
  )?.get(season);

  const options = seasonWorksheet
    ? Object.fromEntries(
        [...seasonWorksheet.entries()].map(([key, value]) => [
          key,
          {
            value: key,
            label: value.name,
            isPrivate: value.private,
          } as WorksheetNumberOption,
        ]),
      )
    : {};

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  options[0] ??= {
    value: 0,
    label: 'Main Worksheet',
    isPrivate: false,
  };
  return options;
}
