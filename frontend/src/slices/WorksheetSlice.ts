import { useEffect, useMemo, useRef } from 'react';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { memoize } from 'proxy-memoize';
import { toast } from 'sonner';
import { z } from 'zod';
import type { StateCreator } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CUR_SEASON } from '../config';
import {
  isWorksheetTerm,
  supportedTerms as allSeasons,
} from '../data/catalogSeasons';
import { useCoursePlanningData } from '../hooks/useCoursePlanning';
import { useLegacyWorksheetInfo } from '../hooks/useLegacyWorksheetInfo';
import {
  createBlankSavedWorksheet,
  deleteSavedWorksheet as deleteSavedWorksheetApi,
  ensureMainSavedWorksheet,
  fetchSavedWorksheet,
  fetchSavedWorksheets,
  renameSavedWorksheet as renameSavedWorksheetApi,
  updateSavedWorksheetSections,
  type SavedWorksheet,
  type SavedWorksheetSection,
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
  getListingSectionId,
  getListingTerm,
  readAnonymousWorksheetStorage,
  removeListingFromAnonymousWorksheet,
  resolveAnonymousWorksheetCourses,
  setAllAnonymousWorksheetCoursesHidden,
  setAnonymousWorksheetCourseColor,
  setAnonymousWorksheetCourseHidden,
  writeAnonymousWorksheetStorage,
  type AnonymousWorksheetCourse,
  type AnonymousWorksheetListing,
  type AnonymousWorksheetShare,
  type AnonymousWorksheetState,
} from '../utilities/anonymousWorksheet';
import { createLocalStorageSlot } from '../utilities/browserStorage';
import { worksheetColors } from '../utilities/constants';
import { toSeasonString } from '../utilities/course';
import {
  buildRestoredAnonymousWorksheet,
  resolveSavedWorksheetCourses,
  type SavedWorksheetRestoreSource,
} from '../utilities/savedWorksheet';

const lastViewedSavedWorksheetTermSlot = createLocalStorageSlot<string>(
  'sungrid_saved_worksheet_last_viewed_term',
);
const emptyWorksheetCourses: WorksheetCourse[] = [];

export function getInitialSavedWorksheetTerm(): Season {
  const stored = lastViewedSavedWorksheetTermSlot.get();
  if (stored && isWorksheetTerm(stored as Season)) return stored as Season;
  return CUR_SEASON;
}

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
  worksheetMissingSectionIds: string[];
  activeSavedWorksheet: SavedWorksheet | undefined;
  activeSavedWorksheetOwnerId: number | undefined;
  activeSavedWorksheetIdsByTerm: { [term: string]: number | undefined };
  crossTermSavedSections: { [term: string]: SavedWorksheetSection[] };
  allTermSavedWorksheetSummaries: SavedWorksheetSummary[];
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
  refreshAllTermSavedWorksheetSummaries: () => Promise<void>;
  loadSavedWorksheetSectionsForTerm: (term: Season) => Promise<boolean>;
  selectSavedWorksheet: (id: number) => Promise<boolean>;
  createBlankSavedWorksheetForTerm: (term: Season) => Promise<boolean>;
  renameSavedWorksheet: (id: number, name: string) => Promise<boolean>;
  deleteSavedWorksheet: (id: number) => Promise<boolean>;
  addActiveSavedWorksheetListing: (
    listing: AnonymousWorksheetListing,
    color: string,
  ) => Promise<boolean>;
  removeActiveSavedWorksheetListing: (
    listing: AnonymousWorksheetListing,
  ) => Promise<boolean>;
  setActiveSavedWorksheetListingHidden: (
    listing: AnonymousWorksheetListing,
    hidden: boolean,
  ) => Promise<boolean>;
  setActiveSavedWorksheetListingColor: (
    listing: AnonymousWorksheetListing,
    color: string,
  ) => Promise<boolean>;
  setAllActiveSavedWorksheetHidden: (hidden: boolean) => Promise<boolean>;
  clearActiveSavedWorksheet: () => Promise<boolean>;
  restoreActiveSavedWorksheetSections: (
    sections: SavedWorksheetSection[],
  ) => Promise<boolean>;
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
  restoreAnonymousWorksheetCourses: (
    courses: AnonymousWorksheetCourse[],
  ) => void;
  setAnonymousWorksheetMissingSectionIds: (sectionIds: string[]) => void;
  setWorksheetMissingSectionIds: (sectionIds: string[]) => void;

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
  const storedAnonymousWorksheet = readAnonymousWorksheetStorage(CUR_SEASON);
  const initialAnonymousWorksheet = isWorksheetTerm(
    storedAnonymousWorksheet.term,
  )
    ? storedAnonymousWorksheet
    : { ...storedAnonymousWorksheet, term: CUR_SEASON };
  const pendingMainSavedWorksheetByTerm = new Map<Season, Promise<void>>();
  const setAnonymousWorksheet = (worksheet: AnonymousWorksheetState) => {
    writeAnonymousWorksheetStorage(worksheet);
    set({
      anonymousWorksheet: worksheet,
      viewedPerson: 'me',
      viewedWorksheetNumber: 0,
    });
  };
  const toError = (error: unknown) =>
    error instanceof Error ? error : new Error(String(error));
  const hasSavedWorksheetAccount = () => {
    const { authStatus, user } = get();
    return authStatus === 'authenticated' && Boolean(user);
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

    lastViewedSavedWorksheetTermSlot.set(worksheet.term);

    const { [worksheet.term]: _cleared, ...restCrossTermSections } =
      get().crossTermSavedSections;

    set({
      activeSavedWorksheet: worksheet,
      activeSavedWorksheetOwnerId: userId,
      activeSavedWorksheetIdsByTerm: {
        ...get().activeSavedWorksheetIdsByTerm,
        [worksheet.term]: worksheet.id,
      },
      crossTermSavedSections: restCrossTermSections,
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
  const replaceActiveSavedWorksheetSections = async (
    sections: SavedWorksheetSection[],
  ) => {
    const { activeSavedWorksheet, user } = get();
    if (!hasSavedWorksheetAccount() || !user || !activeSavedWorksheet)
      return false;

    const updatedWorksheet = await updateSavedWorksheetSections(
      activeSavedWorksheet.id,
      sections,
    );
    if (!updatedWorksheet) return false;

    activateSavedWorksheet(updatedWorksheet, user.user_id);
    return true;
  };
  const getListingSectionIdOrWarn = (listing: AnonymousWorksheetListing) => {
    const sectionId = getListingSectionId(listing);
    if (!sectionId) {
      toast.error('This section cannot be saved to a Saved Worksheet.');
      return null;
    }
    return sectionId;
  };
  const resolveWorksheetForTerm = async (
    term: Season,
  ): Promise<SavedWorksheet | null> => {
    const rememberedId = get().activeSavedWorksheetIdsByTerm[term];
    if (rememberedId) {
      const remembered = await fetchSavedWorksheet(rememberedId);
      if (remembered?.term === term) return remembered;
    }
    const worksheet = await ensureMainSavedWorksheet(term);
    if (!worksheet) return null;
    set({
      activeSavedWorksheetIdsByTerm: {
        ...get().activeSavedWorksheetIdsByTerm,
        [term]: worksheet.id,
      },
    });
    return worksheet;
  };
  const getExistingWorksheetSummaryForTerm = (term: Season) => {
    const termSummaries = get().allTermSavedWorksheetSummaries.filter(
      (summary) => summary.term === term,
    );
    const rememberedId = get().activeSavedWorksheetIdsByTerm[term];
    return (
      (rememberedId
        ? termSummaries.find((summary) => summary.id === rememberedId)
        : undefined) ?? termSummaries.find((summary) => summary.isMain)
    );
  };
  const setCrossTermSavedSections = (
    term: Season,
    sections: SavedWorksheetSection[],
  ) => {
    set({
      crossTermSavedSections: {
        ...get().crossTermSavedSections,
        [term]: sections,
      },
    });
  };

  return {
    viewedPerson: 'me',
    viewedSeason: initialAnonymousWorksheet.term,
    viewedWorksheetNumber: 0,
    changeViewedPerson(newPerson) {
      set({ viewedWorksheetNumber: 0, viewedPerson: newPerson });
    },
    changeViewedSeason(seasonCode) {
      if (!isWorksheetTerm(seasonCode)) return;
      const nextAnonymousWorksheet = {
        ...get().anonymousWorksheet,
        term: seasonCode,
      };
      writeAnonymousWorksheetStorage(nextAnonymousWorksheet);
      set({
        anonymousWorksheet: nextAnonymousWorksheet,
        viewedWorksheetNumber: 0,
        viewedSeason: seasonCode,
      });
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
    anonymousWorksheet: initialAnonymousWorksheet,
    anonymousWorksheetMissingSectionIds: [],
    worksheetMissingSectionIds: [],
    activeSavedWorksheet: undefined,
    activeSavedWorksheetOwnerId: undefined,
    activeSavedWorksheetIdsByTerm: {},
    crossTermSavedSections: {},
    allTermSavedWorksheetSummaries: [],
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
    },
    restoreAnonymousWorksheetFromShare(share) {
      setAnonymousWorksheet(
        anonymousWorksheetFromShare(
          share,
          (index) => worksheetColors[index % worksheetColors.length]!,
        ),
      );
      set({ viewAnonymousWorksheet: true, viewedSeason: share.term });
    },
    restoreSavedWorksheet(worksheet) {
      setAnonymousWorksheet(buildRestoredAnonymousWorksheet(worksheet));
      set({
        viewAnonymousWorksheet: true,
        exoticWorksheet: undefined,
        viewedSeason: worksheet.term as Season,
      });
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
      const pendingBootstrap = pendingMainSavedWorksheetByTerm.get(term);
      if (pendingBootstrap) {
        await pendingBootstrap;
        return;
      }

      const { user } = get();
      if (!hasSavedWorksheetAccount()) return;

      const bootstrap = (async () => {
        set({
          savedWorksheetBootstrapStatus: 'loading',
          savedWorksheetBootstrapError: null,
        });

        try {
          const mainWorksheet = await ensureMainSavedWorksheet(term);
          if (!mainWorksheet || !user) {
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
              void get().refreshAllTermSavedWorksheetSummaries();
              return;
            }
          }

          activateSavedWorksheet(mainWorksheet, user.user_id);
          void get().refreshAllTermSavedWorksheetSummaries();
        } catch (error: unknown) {
          set({
            savedWorksheetBootstrapStatus: 'error',
            savedWorksheetBootstrapError: toError(error),
          });
        }
      })();

      pendingMainSavedWorksheetByTerm.set(term, bootstrap);
      try {
        await bootstrap;
      } finally {
        pendingMainSavedWorksheetByTerm.delete(term);
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
    async refreshAllTermSavedWorksheetSummaries() {
      if (!hasSavedWorksheetAccount()) return;
      try {
        const response = await fetchSavedWorksheets();
        set({ allTermSavedWorksheetSummaries: response?.data ?? [] });
      } catch {
        // Non-critical; don't block the user
      }
    },
    async loadSavedWorksheetSectionsForTerm(term) {
      if (!hasSavedWorksheetAccount()) return false;

      const { activeSavedWorksheet, crossTermSavedSections } = get();
      if (activeSavedWorksheet?.term === term) return true;
      if (Object.hasOwn(crossTermSavedSections, term)) return true;

      if (get().allTermSavedWorksheetSummaries.length === 0) return false;

      const summary = getExistingWorksheetSummaryForTerm(term);
      if (!summary) {
        setCrossTermSavedSections(term, []);
        return false;
      }

      set({
        activeSavedWorksheetIdsByTerm: {
          ...get().activeSavedWorksheetIdsByTerm,
          [term]: summary.id,
        },
      });

      if (summary.sectionCount === 0) {
        setCrossTermSavedSections(term, []);
        return true;
      }

      const worksheet = await fetchSavedWorksheet(summary.id);
      if (!worksheet || worksheet.term !== term) {
        setCrossTermSavedSections(term, []);
        return false;
      }

      setCrossTermSavedSections(term, worksheet.sections);
      return true;
    },
    async selectSavedWorksheet(id) {
      const { user } = get();
      if (!hasSavedWorksheetAccount() || !user) return false;

      const worksheet = await fetchSavedWorksheet(id);
      if (!worksheet) return false;
      activateSavedWorksheet(worksheet, user.user_id);
      return true;
    },
    async createBlankSavedWorksheetForTerm(term) {
      const { user } = get();
      if (!hasSavedWorksheetAccount() || !user) return false;

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
    async renameSavedWorksheet(id, name) {
      const { user } = get();
      if (!hasSavedWorksheetAccount() || !user) return false;

      const worksheet = await renameSavedWorksheetApi(id, name);
      if (!worksheet) return false;

      const summary = summarizeSavedWorksheet(worksheet);
      set({
        savedWorksheetSummaries: get().savedWorksheetSummaries.map(
          (existing) => (existing.id === summary.id ? summary : existing),
        ),
        activeSavedWorksheet:
          get().activeSavedWorksheet?.id === worksheet.id
            ? worksheet
            : get().activeSavedWorksheet,
      });
      return true;
    },
    async deleteSavedWorksheet(id) {
      const { user, activeSavedWorksheet } = get();
      if (!hasSavedWorksheetAccount() || !user) return false;

      const result = await deleteSavedWorksheetApi(id);
      if (!result) return false;

      const summaries = get().savedWorksheetSummaries.filter(
        (worksheet) => worksheet.id !== result.deletedId,
      );
      set({
        savedWorksheetSummaries: summaries,
        activeSavedWorksheet:
          activeSavedWorksheet?.id === result.deletedId &&
          !result.fallbackWorksheet
            ? undefined
            : get().activeSavedWorksheet,
        activeSavedWorksheetOwnerId:
          activeSavedWorksheet?.id === result.deletedId &&
          !result.fallbackWorksheet
            ? undefined
            : get().activeSavedWorksheetOwnerId,
        activeSavedWorksheetIdsByTerm: {
          ...get().activeSavedWorksheetIdsByTerm,
          [result.term]:
            activeSavedWorksheet?.id === result.deletedId
              ? result.fallbackWorksheet?.id
              : get().activeSavedWorksheetIdsByTerm[result.term],
        },
      });

      if (
        activeSavedWorksheet?.id === result.deletedId &&
        result.fallbackWorksheet
      )
        activateSavedWorksheet(result.fallbackWorksheet, user.user_id);
      return true;
    },
    async addActiveSavedWorksheetListing(listing, color) {
      const sectionId = getListingSectionIdOrWarn(listing);
      if (!sectionId) return false;

      const listingTerm = getListingTerm(listing, get().viewedSeason);
      let { activeSavedWorksheet } = get();

      if (!activeSavedWorksheet && listingTerm) {
        await get().ensureMainSavedWorksheetForTerm(listingTerm);
        ({ activeSavedWorksheet } = get());
      }
      if (!activeSavedWorksheet) return false;

      const isCrossTerm =
        listingTerm && listingTerm !== activeSavedWorksheet.term;

      if (isCrossTerm) {
        try {
          const targetWorksheet = await resolveWorksheetForTerm(listingTerm);
          if (!targetWorksheet) {
            toast.error(
              `Failed to add to ${toSeasonString(listingTerm)} worksheet`,
            );
            return false;
          }
          if (
            targetWorksheet.sections.some(
              (section) => section.sectionId === sectionId,
            )
          )
            return false;

          const updatedWorksheet = await updateSavedWorksheetSections(
            targetWorksheet.id,
            [...targetWorksheet.sections, { sectionId, color, hidden: false }],
          );
          if (!updatedWorksheet) {
            toast.error(
              `Failed to add to ${toSeasonString(listingTerm)} worksheet`,
            );
            return false;
          }

          set({
            crossTermSavedSections: {
              ...get().crossTermSavedSections,
              [listingTerm]: updatedWorksheet.sections,
            },
          });
          void get().refreshAllTermSavedWorksheetSummaries();
          return true;
        } catch {
          toast.error(
            `Failed to add to ${toSeasonString(listingTerm)} worksheet`,
          );
          return false;
        }
      }

      if (
        activeSavedWorksheet.sections.some(
          (section) => section.sectionId === sectionId,
        )
      )
        return false;

      return await replaceActiveSavedWorksheetSections([
        ...activeSavedWorksheet.sections,
        { sectionId, color, hidden: false },
      ]);
    },
    async removeActiveSavedWorksheetListing(listing) {
      const sectionId = getListingSectionIdOrWarn(listing);
      if (!sectionId) return false;

      const listingTerm = getListingTerm(listing, get().viewedSeason);
      const { activeSavedWorksheet } = get();
      if (!activeSavedWorksheet) return false;

      const isCrossTerm =
        listingTerm && listingTerm !== activeSavedWorksheet.term;

      if (isCrossTerm) {
        try {
          const targetWorksheet = await resolveWorksheetForTerm(listingTerm);
          if (!targetWorksheet) {
            toast.error(
              `Failed to remove from ${toSeasonString(listingTerm)} worksheet`,
            );
            return false;
          }
          const crossTermNextSections = targetWorksheet.sections.filter(
            (section) => section.sectionId !== sectionId,
          );
          if (crossTermNextSections.length === targetWorksheet.sections.length)
            return false;

          const updatedWorksheet = await updateSavedWorksheetSections(
            targetWorksheet.id,
            crossTermNextSections,
          );
          if (!updatedWorksheet) {
            toast.error(
              `Failed to remove from ${toSeasonString(listingTerm)} worksheet`,
            );
            return false;
          }

          set({
            crossTermSavedSections: {
              ...get().crossTermSavedSections,
              [listingTerm]: updatedWorksheet.sections,
            },
          });
          void get().refreshAllTermSavedWorksheetSummaries();
          return true;
        } catch {
          toast.error(
            `Failed to remove from ${toSeasonString(listingTerm)} worksheet`,
          );
          return false;
        }
      }

      const nextSections = activeSavedWorksheet.sections.filter(
        (section) => section.sectionId !== sectionId,
      );
      if (nextSections.length === activeSavedWorksheet.sections.length)
        return false;

      return await replaceActiveSavedWorksheetSections(nextSections);
    },
    async setActiveSavedWorksheetListingHidden(listing, hidden) {
      const sectionId = getListingSectionIdOrWarn(listing);
      const { activeSavedWorksheet } = get();
      if (!sectionId || !activeSavedWorksheet) return false;

      const currentSection = activeSavedWorksheet.sections.find(
        (section) => section.sectionId === sectionId,
      );
      if (!currentSection || currentSection.hidden === hidden) return false;

      const nextSections = activeSavedWorksheet.sections.map((section) => {
        if (section.sectionId !== sectionId) return section;
        return { ...section, hidden };
      });

      return await replaceActiveSavedWorksheetSections(nextSections);
    },
    async setActiveSavedWorksheetListingColor(listing, color) {
      const sectionId = getListingSectionIdOrWarn(listing);
      const { activeSavedWorksheet } = get();
      if (!sectionId || !activeSavedWorksheet) return false;

      const currentSection = activeSavedWorksheet.sections.find(
        (section) => section.sectionId === sectionId,
      );
      if (!currentSection || currentSection.color === color) return false;

      const nextSections = activeSavedWorksheet.sections.map((section) => {
        if (section.sectionId !== sectionId) return section;
        return { ...section, color };
      });

      return await replaceActiveSavedWorksheetSections(nextSections);
    },
    async setAllActiveSavedWorksheetHidden(hidden) {
      const { activeSavedWorksheet } = get();
      if (!activeSavedWorksheet) return false;
      if (
        activeSavedWorksheet.sections.every(
          (section) => section.hidden === hidden,
        )
      )
        return false;

      return await replaceActiveSavedWorksheetSections(
        activeSavedWorksheet.sections.map((section) => ({
          ...section,
          hidden,
        })),
      );
    },
    async clearActiveSavedWorksheet() {
      const { activeSavedWorksheet } = get();
      if (!activeSavedWorksheet || activeSavedWorksheet.sections.length === 0)
        return false;

      return await replaceActiveSavedWorksheetSections([]);
    },
    async restoreActiveSavedWorksheetSections(sections) {
      if (sections.length === 0) return false;
      return await replaceActiveSavedWorksheetSections(sections);
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
        setAllAnonymousWorksheetCoursesHidden(
          get().anonymousWorksheet,
          hidden,
          get().viewedSeason,
        ),
      );
    },
    clearAnonymousWorksheet() {
      const term = get().viewedSeason;
      setAnonymousWorksheet({
        ...get().anonymousWorksheet,
        term,
        coursesByTerm: {
          ...get().anonymousWorksheet.coursesByTerm,
          [term]: [],
        },
      });
    },
    restoreAnonymousWorksheetCourses(courses) {
      const term = get().viewedSeason;
      setAnonymousWorksheet({
        ...get().anonymousWorksheet,
        term,
        coursesByTerm: {
          ...get().anonymousWorksheet.coursesByTerm,
          [term]: courses,
        },
      });
    },
    setAnonymousWorksheetMissingSectionIds(sectionIds) {
      set({ anonymousWorksheetMissingSectionIds: sectionIds });
    },
    setWorksheetMissingSectionIds(sectionIds) {
      set({ worksheetMissingSectionIds: sectionIds });
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
    setWorksheetMissingSectionIds,
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
      setWorksheetMissingSectionIds: state.setWorksheetMissingSectionIds,
    })),
  );

  const anonymousRequestedSeasons = useMemo(
    () => (isAnonymousWorksheet ? [viewedSeason] : []),
    [isAnonymousWorksheet, viewedSeason],
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
  const {
    loading: coursePlanningLoading,
    error: coursePlanningError,
    courses: catalogCourses,
  } = useCoursePlanningData(requestedSeasons);
  const anonymousResolved = useMemo(
    () =>
      resolveAnonymousWorksheetCourses(
        anonymousWorksheet,
        catalogCourses[viewedSeason]?.listings,
        viewedSeason,
      ),
    [anonymousWorksheet, catalogCourses, viewedSeason],
  );
  const activeSavedWorksheetResolved = useMemo(
    () =>
      activeSavedWorksheet
        ? resolveSavedWorksheetCourses(
            activeSavedWorksheet,
            catalogCourses[activeSavedWorksheet.term]?.listings,
          )
        : null,
    [activeSavedWorksheet, catalogCourses],
  );
  const displayedMissingSectionIds = useMemo(
    () =>
      isAnonymousWorksheet
        ? anonymousResolved.missingSectionIds
        : (activeSavedWorksheetResolved?.missingSectionIds ?? []),
    [
      activeSavedWorksheetResolved?.missingSectionIds,
      anonymousResolved.missingSectionIds,
      isAnonymousWorksheet,
    ],
  );
  const displayedMissingKey =
    displayedMissingSectionIds.length > 0
      ? displayedMissingSectionIds.join('\n')
      : '';
  const lastWarnedMissingKey = useRef('');

  useEffect(() => {
    setWorksheetMissingSectionIds(displayedMissingSectionIds);
    setAnonymousWorksheetMissingSectionIds(
      isAnonymousWorksheet ? displayedMissingSectionIds : [],
    );

    if (!displayedMissingKey) {
      lastWarnedMissingKey.current = '';
      return;
    }

    if (displayedMissingKey !== lastWarnedMissingKey.current) {
      lastWarnedMissingKey.current = displayedMissingKey;
      toast.warning(
        `Some worksheet sections are no longer in this snapshot: ${displayedMissingSectionIds.join(', ')}`,
      );
    }
  }, [
    displayedMissingKey,
    displayedMissingSectionIds,
    isAnonymousWorksheet,
    setAnonymousWorksheetMissingSectionIds,
    setWorksheetMissingSectionIds,
  ]);

  const {
    loading: inheritedWorksheetLoading,
    error: inheritedWorksheetError,
    data: inheritedCourses,
  } = useLegacyWorksheetInfo(
    isAnonymousWorksheet
      ? undefined
      : (exoticWorksheet?.worksheets ??
          (activeSavedWorksheet ? undefined : curWorksheet)),
    exoticWorksheet?.data.season ??
      (isAnonymousWorksheet
        ? viewedSeason
        : (activeSavedWorksheet?.term ?? viewedSeason)),
    exoticWorksheet || isAnonymousWorksheet || activeSavedWorksheet
      ? 0
      : viewedWorksheetNumber,
  );
  const usesCoursePlanningWorksheet =
    isAnonymousWorksheet || Boolean(activeSavedWorksheet);
  const courses = isAnonymousWorksheet
    ? anonymousResolved.courses
    : activeSavedWorksheet
      ? (activeSavedWorksheetResolved?.courses ?? emptyWorksheetCourses)
      : inheritedCourses;
  const worksheetLoading = usesCoursePlanningWorksheet
    ? coursePlanningLoading
    : inheritedWorksheetLoading;
  const worksheetError = usesCoursePlanningWorksheet
    ? coursePlanningError
    : inheritedWorksheetError;

  useEffect(() => {
    setWorksheetInfo(courses, worksheetLoading, worksheetError);
  }, [courses, setWorksheetInfo, worksheetError, worksheetLoading]);
};

export const useSavedWorksheetBootstrap = () => {
  const {
    activeSavedWorksheet,
    activeSavedWorksheetOwnerId,
    authStatus,
    ensureMainSavedWorksheetForTerm,
    savedWorksheetBootstrapStatus,
    user,
    viewAnonymousWorksheet,
  } = useStore(
    useShallow((state) => ({
      activeSavedWorksheet: state.activeSavedWorksheet,
      activeSavedWorksheetOwnerId: state.activeSavedWorksheetOwnerId,
      authStatus: state.authStatus,
      ensureMainSavedWorksheetForTerm: state.ensureMainSavedWorksheetForTerm,
      savedWorksheetBootstrapStatus: state.savedWorksheetBootstrapStatus,
      user: state.user,
      viewAnonymousWorksheet: state.viewAnonymousWorksheet,
    })),
  );

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      !user ||
      viewAnonymousWorksheet ||
      savedWorksheetBootstrapStatus === 'loading' ||
      savedWorksheetBootstrapStatus === 'error'
    )
      return;

    const searchParams = new URLSearchParams(window.location.search);
    const isWorksheetShareOrImport =
      window.location.pathname === '/worksheet' &&
      (searchParams.has('ws') ||
        (searchParams.has('t') && searchParams.has('sections')));
    if (isWorksheetShareOrImport) return;

    if (activeSavedWorksheet && activeSavedWorksheetOwnerId === user.user_id)
      return;

    void ensureMainSavedWorksheetForTerm(getInitialSavedWorksheetTerm());
  }, [
    activeSavedWorksheet,
    activeSavedWorksheetOwnerId,
    authStatus,
    ensureMainSavedWorksheetForTerm,
    savedWorksheetBootstrapStatus,
    user,
    viewAnonymousWorksheet,
  ]);
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
