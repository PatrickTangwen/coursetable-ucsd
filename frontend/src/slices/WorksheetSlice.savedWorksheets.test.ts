import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUR_SEASON } from '../config';
import type {
  AppUserInfo,
  SavedWorksheet,
  SavedWorksheetSummary,
} from '../queries/api';
import type { Season } from '../queries/graphql-types';
import { getAnonymousWorksheetCourses } from '../utilities/anonymousWorksheet';

const apiMocks = vi.hoisted(() => ({
  createBlankSavedWorksheet: vi.fn(),
  deleteSavedWorksheet: vi.fn(),
  ensureMainSavedWorksheet: vi.fn(),
  fetchSavedWorksheet: vi.fn(),
  fetchSavedWorksheets: vi.fn(),
  renameSavedWorksheet: vi.fn(),
  updateSavedWorksheetSections: vi.fn(),
}));

vi.mock('../queries/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries/api')>();
  return {
    ...actual,
    createBlankSavedWorksheet: apiMocks.createBlankSavedWorksheet,
    deleteSavedWorksheet: apiMocks.deleteSavedWorksheet,
    ensureMainSavedWorksheet: apiMocks.ensureMainSavedWorksheet,
    fetchSavedWorksheet: apiMocks.fetchSavedWorksheet,
    fetchSavedWorksheets: apiMocks.fetchSavedWorksheets,
    renameSavedWorksheet: apiMocks.renameSavedWorksheet,
    updateSavedWorksheetSections: apiMocks.updateSavedWorksheetSections,
  };
});

const s126 = 'S126' as Season;

const testUser: AppUserInfo = {
  user_id: 1,
  verifiedEmail: 'student@ucsd.edu',
};

const mainWorksheet: SavedWorksheet = {
  id: 10,
  name: 'Main Worksheet',
  term: s126,
  createdAt: 1,
  updatedAt: 1,
  private: true,
  isMain: true,
  sourceSectionCount: 0,
  savedSectionCount: 0,
  sections: [],
};

const summerPlan: SavedWorksheet = {
  id: 11,
  name: 'Summer Plan',
  term: s126,
  createdAt: 2,
  updatedAt: 2,
  private: true,
  isMain: false,
  sourceSectionCount: 0,
  savedSectionCount: 0,
  sections: [],
};

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
    removeItem(key: string) {
      return items.delete(key);
    },
  };
}

function toSummary(worksheet: SavedWorksheet): SavedWorksheetSummary {
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

async function loadStore({
  signedIn = true,
  anonymousWorksheetStorage,
  persistedStore,
}: {
  signedIn?: boolean;
  anonymousWorksheetStorage?: unknown;
  persistedStore?: unknown;
} = {}) {
  vi.resetModules();
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (anonymousWorksheetStorage) {
    localStorage.setItem(
      'anonymousWorksheet',
      JSON.stringify(anonymousWorksheetStorage),
    );
  }
  if (persistedStore) {
    localStorage.setItem(
      'store',
      JSON.stringify({ state: persistedStore, version: 0 }),
    );
  }
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('sessionStorage', sessionStorage);
  vi.stubGlobal('window', {
    localStorage,
    sessionStorage,
    location: {
      pathname: '/worksheet',
      search: '',
    },
    history: {
      replaceState: vi.fn(),
    },
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const { useStore } = await import('../store');
  useStore.setState({
    authStatus: signedIn ? 'authenticated' : 'unauthenticated',
    user: signedIn ? testUser : undefined,
  });
  return useStore;
}

const firstListing = {
  crn: '123' as never,
  section_id: 'S126-123',
  course: {
    season_code: s126,
    listings: [{ crn: '123' as never, section_id: 'S126-123' }],
  },
};

describe('Saved Worksheet slice behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects an existing Saved Worksheet as the active worksheet for its term', async () => {
    const useStore = await loadStore();
    apiMocks.fetchSavedWorksheet.mockResolvedValue(summerPlan);

    const selected = await useStore.getState().selectSavedWorksheet(11);

    expect(selected).toBe(true);
    expect(apiMocks.fetchSavedWorksheet).toHaveBeenCalledWith(11);
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(11);
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[s126]).toBe(11);
    expect(useStore.getState().viewAnonymousWorksheet).toBe(false);
  });

  it('creates a blank Saved Worksheet and makes it active immediately', async () => {
    const useStore = await loadStore();
    useStore.setState({
      savedWorksheetSummaries: [toSummary(mainWorksheet)],
    });
    apiMocks.createBlankSavedWorksheet.mockResolvedValue(summerPlan);

    const created = await useStore
      .getState()
      .createBlankSavedWorksheetForTerm(s126);

    expect(created).toBe(true);
    expect(apiMocks.createBlankSavedWorksheet).toHaveBeenCalledWith({
      name: 'New Worksheet',
      term: 'S126',
    });
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(11);
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[s126]).toBe(11);
    expect(useStore.getState().savedWorksheetSummaries).toEqual([
      toSummary(summerPlan),
      toSummary(mainWorksheet),
    ]);
  });

  it('reopens a remembered active Saved Worksheet when it still exists for the term', async () => {
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheetIdsByTerm: { [s126]: 11 },
    });
    apiMocks.ensureMainSavedWorksheet.mockResolvedValue(mainWorksheet);
    apiMocks.fetchSavedWorksheets.mockResolvedValue({
      data: [toSummary(summerPlan), toSummary(mainWorksheet)],
    });
    apiMocks.fetchSavedWorksheet.mockResolvedValue(summerPlan);

    await useStore.getState().ensureMainSavedWorksheetForTerm(s126);

    expect(apiMocks.fetchSavedWorksheet).toHaveBeenCalledWith(11);
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(11);
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[s126]).toBe(11);
  });

  it('falls back to Main Worksheet when the remembered active worksheet no longer exists', async () => {
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheetIdsByTerm: { [s126]: 404 },
    });
    apiMocks.ensureMainSavedWorksheet.mockResolvedValue(mainWorksheet);
    apiMocks.fetchSavedWorksheets.mockResolvedValue({
      data: [toSummary(mainWorksheet)],
    });

    await useStore.getState().ensureMainSavedWorksheetForTerm(s126);

    expect(apiMocks.fetchSavedWorksheet).not.toHaveBeenCalled();
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(10);
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[s126]).toBe(10);
  });

  it('opens the account Main Worksheet after sign-in without prompting to save browser-local content', async () => {
    const useStore = await loadStore();
    useStore.setState({
      anonymousWorksheet: {
        term: s126,
        coursesByTerm: {
          S126: [{ sectionId: 'S126-123', color: '#123456', hidden: false }],
        },
      },
    });
    apiMocks.ensureMainSavedWorksheet.mockResolvedValue(mainWorksheet);
    apiMocks.fetchSavedWorksheets.mockResolvedValue({
      data: [toSummary(mainWorksheet)],
    });

    await useStore.getState().ensureMainSavedWorksheetForTerm(s126);

    expect(useStore.getState().activeSavedWorksheet?.id).toBe(10);
    expect(useStore.getState().viewAnonymousWorksheet).toBe(false);
    expect(
      getAnonymousWorksheetCourses(
        useStore.getState().anonymousWorksheet,
        s126,
      ),
    ).toEqual([{ sectionId: 'S126-123', color: '#123456', hidden: false }]);
  });

  it('renames the active Saved Worksheet in state after a successful API update', async () => {
    const useStore = await loadStore();
    const renamedPlan = { ...summerPlan, name: 'Lab Plan', updatedAt: 3 };
    useStore.setState({
      activeSavedWorksheet: summerPlan,
      activeSavedWorksheetIdsByTerm: { [s126]: 11 },
      savedWorksheetSummaries: [
        toSummary(summerPlan),
        toSummary(mainWorksheet),
      ],
    });
    apiMocks.renameSavedWorksheet.mockResolvedValue(renamedPlan);

    const renamed = await useStore
      .getState()
      .renameSavedWorksheet(11, 'Lab Plan');

    expect(renamed).toBe(true);
    expect(apiMocks.renameSavedWorksheet).toHaveBeenCalledWith(11, 'Lab Plan');
    expect(useStore.getState().activeSavedWorksheet?.name).toBe('Lab Plan');
    expect(useStore.getState().savedWorksheetSummaries).toEqual([
      toSummary(renamedPlan),
      toSummary(mainWorksheet),
    ]);
  });

  it('returns to Main Worksheet when deleting the active extra Saved Worksheet', async () => {
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: summerPlan,
      activeSavedWorksheetIdsByTerm: { [s126]: 11 },
      savedWorksheetSummaries: [
        toSummary(summerPlan),
        toSummary(mainWorksheet),
      ],
    });
    apiMocks.deleteSavedWorksheet.mockResolvedValue({
      deletedId: 11,
      term: s126,
      fallbackWorksheet: mainWorksheet,
    });

    const deleted = await useStore.getState().deleteSavedWorksheet(11);

    expect(deleted).toBe(true);
    expect(apiMocks.deleteSavedWorksheet).toHaveBeenCalledWith(11);
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(10);
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[s126]).toBe(10);
    expect(useStore.getState().savedWorksheetSummaries).toEqual([
      toSummary(mainWorksheet),
    ]);
  });

  it('persists active Saved Worksheet add, hide, color, and remove edits', async () => {
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id },
      savedWorksheetSummaries: [toSummary(mainWorksheet)],
    });
    apiMocks.updateSavedWorksheetSections.mockImplementation(
      (id: number, sections: SavedWorksheet['sections']) =>
        Promise.resolve({
          ...mainWorksheet,
          id,
          updatedAt: 3,
          sourceSectionCount: sections.length,
          savedSectionCount: sections.length,
          sections,
        }),
    );

    const added = await useStore
      .getState()
      .addActiveSavedWorksheetListing(firstListing, '#123456');
    expect(added).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenLastCalledWith(10, [
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
    expect(useStore.getState().activeSavedWorksheet?.sections).toEqual([
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
    expect(useStore.getState().savedWorksheetSummaries[0]?.sectionCount).toBe(
      1,
    );

    const hidden = await useStore
      .getState()
      .setActiveSavedWorksheetListingHidden(firstListing, true);
    expect(hidden).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenLastCalledWith(10, [
      { sectionId: 'S126-123', color: '#123456', hidden: true },
    ]);

    const recolored = await useStore
      .getState()
      .setActiveSavedWorksheetListingColor(firstListing, '#654321');
    expect(recolored).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenLastCalledWith(10, [
      { sectionId: 'S126-123', color: '#654321', hidden: true },
    ]);

    const removed = await useStore
      .getState()
      .removeActiveSavedWorksheetListing(firstListing);
    expect(removed).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenLastCalledWith(
      10,
      [],
    );
    expect(useStore.getState().activeSavedWorksheet?.sections).toEqual([]);
  });

  it('waits for Saved Worksheet bootstrap before adding from a signed-in cold start', async () => {
    const useStore = await loadStore();
    let resolveMainWorksheet: (worksheet: SavedWorksheet) => void = () => {};
    const mainWorksheetPromise = new Promise<SavedWorksheet>((resolve) => {
      resolveMainWorksheet = resolve;
    });
    apiMocks.ensureMainSavedWorksheet.mockReturnValue(mainWorksheetPromise);
    apiMocks.fetchSavedWorksheets.mockResolvedValue({
      data: [toSummary(mainWorksheet)],
    });
    apiMocks.updateSavedWorksheetSections.mockImplementation(
      (id: number, sections: SavedWorksheet['sections']) =>
        Promise.resolve({
          ...mainWorksheet,
          id,
          updatedAt: 3,
          sourceSectionCount: sections.length,
          savedSectionCount: sections.length,
          sections,
        }),
    );

    const bootstrap = useStore.getState().ensureMainSavedWorksheetForTerm(s126);
    const added = useStore
      .getState()
      .addActiveSavedWorksheetListing(firstListing, '#123456');

    await Promise.resolve();
    expect(apiMocks.updateSavedWorksheetSections).not.toHaveBeenCalled();

    resolveMainWorksheet(mainWorksheet);

    await bootstrap;
    await expect(added).resolves.toBe(true);
    expect(apiMocks.ensureMainSavedWorksheet).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenCalledWith(10, [
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
    expect(useStore.getState().activeSavedWorksheet?.sections).toEqual([
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
  });

  it('keeps signed-out worksheet edits in the browser-local worksheet path', async () => {
    const useStore = await loadStore({ signedIn: false });

    const changed = useStore
      .getState()
      .addAnonymousWorksheetListing(firstListing, '#123456');

    expect(changed).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).not.toHaveBeenCalled();
    expect(
      getAnonymousWorksheetCourses(
        useStore.getState().anonymousWorksheet,
        s126,
      ),
    ).toEqual([{ sectionId: 'S126-123', color: '#123456', hidden: false }]);
    // The stored term stays at the current season; only the edited term's
    // course list changes.
    expect(localStorage.getItem('anonymousWorksheet')).toBe(
      JSON.stringify({
        term: CUR_SEASON,
        coursesByTerm: {
          S126: [{ sectionId: 'S126-123', color: '#123456', hidden: false }],
        },
      }),
    );
  });

  it('hydrates the signed-out Worksheet Viewed Term from browser-local storage', async () => {
    const useStore = await loadStore({
      signedIn: false,
      anonymousWorksheetStorage: {
        term: 'FA26',
        coursesByTerm: {
          FA26: [{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }],
        },
      },
    });

    expect(useStore.getState().viewedSeason).toBe('FA26');
    expect(useStore.getState().anonymousWorksheet.term).toBe('FA26');
  });

  it('returns an out-of-range stored Worksheet term to the active term', async () => {
    const useStore = await loadStore({
      signedIn: false,
      anonymousWorksheetStorage: {
        term: 'SP26',
        coursesByTerm: {
          SP26: [{ sectionId: 'SP26-123', color: '#abcdef', hidden: false }],
        },
      },
      persistedStore: { viewedSeason: 'SP26' },
    });

    expect(useStore.getState().viewedSeason).toBe('FA26');
    expect(useStore.getState().anonymousWorksheet).toEqual({
      term: 'FA26',
      coursesByTerm: {
        SP26: [{ sectionId: 'SP26-123', color: '#abcdef', hidden: false }],
      },
    });
  });

  it('routes a cross-term add into the target term worksheet without switching view', async () => {
    const fa26 = 'FA26' as Season;
    const fa26Main: SavedWorksheet = {
      id: 20,
      name: 'Main Worksheet',
      term: fa26,
      createdAt: 1,
      updatedAt: 1,
      private: true,
      isMain: true,
      sourceSectionCount: 0,
      savedSectionCount: 0,
      sections: [],
    };
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id },
      savedWorksheetSummaries: [toSummary(mainWorksheet)],
    });

    const fa26Listing = {
      crn: '456' as never,
      section_id: 'FA26-456',
      course: {
        season_code: fa26,
        listings: [{ crn: '456' as never, section_id: 'FA26-456' }],
      },
    };
    const updatedFa26 = {
      ...fa26Main,
      updatedAt: 3,
      sections: [{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }],
    };
    apiMocks.ensureMainSavedWorksheet.mockResolvedValue(fa26Main);
    apiMocks.updateSavedWorksheetSections.mockResolvedValue(updatedFa26);

    const added = await useStore
      .getState()
      .addActiveSavedWorksheetListing(fa26Listing, '#abcdef');

    expect(added).toBe(true);
    expect(apiMocks.ensureMainSavedWorksheet).toHaveBeenCalledWith(fa26);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenCalledWith(20, [
      { sectionId: 'FA26-456', color: '#abcdef', hidden: false },
    ]);
    // View must stay on the original term
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(mainWorksheet.id);
    expect(useStore.getState().activeSavedWorksheet?.term).toBe(s126);
    // Cross-term sections cache populated
    expect(useStore.getState().crossTermSavedSections[fa26]).toEqual([
      { sectionId: 'FA26-456', color: '#abcdef', hidden: false },
    ]);
    // Target term's worksheet id is remembered
    expect(useStore.getState().activeSavedWorksheetIdsByTerm[fa26]).toBe(20);
  });

  it('routes a cross-term remove from the target term worksheet', async () => {
    const fa26 = 'FA26' as Season;
    const fa26Main: SavedWorksheet = {
      id: 20,
      name: 'Main Worksheet',
      term: fa26,
      createdAt: 1,
      updatedAt: 1,
      private: true,
      isMain: true,
      sourceSectionCount: 1,
      savedSectionCount: 1,
      sections: [{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }],
    };
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id, [fa26]: 20 },
      crossTermSavedSections: { [fa26]: fa26Main.sections },
    });

    const fa26Listing = {
      crn: '456' as never,
      section_id: 'FA26-456',
      course: {
        season_code: fa26,
        listings: [{ crn: '456' as never, section_id: 'FA26-456' }],
      },
    };
    const updatedFa26 = { ...fa26Main, updatedAt: 3, sections: [] };
    apiMocks.fetchSavedWorksheet.mockResolvedValue(fa26Main);
    apiMocks.updateSavedWorksheetSections.mockResolvedValue(updatedFa26);

    const removed = await useStore
      .getState()
      .removeActiveSavedWorksheetListing(fa26Listing);

    expect(removed).toBe(true);
    expect(apiMocks.fetchSavedWorksheet).toHaveBeenCalledWith(20);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenCalledWith(20, []);
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(mainWorksheet.id);
    expect(useStore.getState().crossTermSavedSections[fa26]).toEqual([]);
  });

  it('loads target term Saved Worksheet sections for cross-term toggle membership without switching view', async () => {
    const fa26 = 'FA26' as Season;
    const fa26Main: SavedWorksheet = {
      id: 20,
      name: 'Main Worksheet',
      term: fa26,
      createdAt: 1,
      updatedAt: 1,
      private: true,
      isMain: true,
      sourceSectionCount: 1,
      savedSectionCount: 1,
      sections: [{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }],
    };
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id, [fa26]: 20 },
      allTermSavedWorksheetSummaries: [
        toSummary(mainWorksheet),
        toSummary(fa26Main),
      ],
    });
    apiMocks.fetchSavedWorksheet.mockResolvedValue(fa26Main);

    const loaded = await useStore
      .getState()
      .loadSavedWorksheetSectionsForTerm(fa26);

    expect(loaded).toBe(true);
    expect(apiMocks.fetchSavedWorksheet).toHaveBeenCalledWith(20);
    expect(apiMocks.ensureMainSavedWorksheet).not.toHaveBeenCalled();
    expect(useStore.getState().activeSavedWorksheet?.id).toBe(mainWorksheet.id);
    expect(useStore.getState().activeSavedWorksheet?.term).toBe(s126);
    expect(useStore.getState().crossTermSavedSections[fa26]).toEqual([
      { sectionId: 'FA26-456', color: '#abcdef', hidden: false },
    ]);
  });

  it('does not cache an empty cross-term membership before all-term summaries load', async () => {
    const fa26 = 'FA26' as Season;
    const fa26Main: SavedWorksheet = {
      id: 20,
      name: 'Main Worksheet',
      term: fa26,
      createdAt: 1,
      updatedAt: 1,
      private: true,
      isMain: true,
      sourceSectionCount: 1,
      savedSectionCount: 1,
      sections: [{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }],
    };
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id, [fa26]: 20 },
      allTermSavedWorksheetSummaries: [],
    });

    const firstLoad = await useStore
      .getState()
      .loadSavedWorksheetSectionsForTerm(fa26);

    expect(firstLoad).toBe(false);
    expect(apiMocks.fetchSavedWorksheet).not.toHaveBeenCalled();
    expect(useStore.getState().crossTermSavedSections[fa26]).toBeUndefined();

    useStore.setState({
      allTermSavedWorksheetSummaries: [
        toSummary(mainWorksheet),
        toSummary(fa26Main),
      ],
    });
    apiMocks.fetchSavedWorksheet.mockResolvedValue(fa26Main);

    const secondLoad = await useStore
      .getState()
      .loadSavedWorksheetSectionsForTerm(fa26);

    expect(secondLoad).toBe(true);
    expect(useStore.getState().crossTermSavedSections[fa26]).toEqual([
      { sectionId: 'FA26-456', color: '#abcdef', hidden: false },
    ]);
  });

  it('shows an error toast with term name when cross-term add fails', async () => {
    const fa26 = 'FA26' as Season;
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id },
    });

    const fa26Listing = {
      crn: '456' as never,
      section_id: 'FA26-456',
      course: {
        season_code: fa26,
        listings: [{ crn: '456' as never, section_id: 'FA26-456' }],
      },
    };
    apiMocks.ensureMainSavedWorksheet.mockResolvedValue(null);

    const added = await useStore
      .getState()
      .addActiveSavedWorksheetListing(fa26Listing, '#abcdef');

    expect(added).toBe(false);
    expect(useStore.getState().crossTermSavedSections[fa26]).toBeUndefined();
  });

  it('same-term add still works through the active worksheet path', async () => {
    const useStore = await loadStore();
    useStore.setState({
      activeSavedWorksheet: mainWorksheet,
      activeSavedWorksheetOwnerId: testUser.user_id,
      activeSavedWorksheetIdsByTerm: { [s126]: mainWorksheet.id },
      savedWorksheetSummaries: [toSummary(mainWorksheet)],
    });
    apiMocks.updateSavedWorksheetSections.mockImplementation(
      (id: number, sections: SavedWorksheet['sections']) =>
        Promise.resolve({
          ...mainWorksheet,
          id,
          updatedAt: 3,
          sourceSectionCount: sections.length,
          savedSectionCount: sections.length,
          sections,
        }),
    );

    const added = await useStore
      .getState()
      .addActiveSavedWorksheetListing(firstListing, '#123456');

    expect(added).toBe(true);
    expect(apiMocks.updateSavedWorksheetSections).toHaveBeenCalledWith(10, [
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
    expect(useStore.getState().activeSavedWorksheet?.sections).toEqual([
      { sectionId: 'S126-123', color: '#123456', hidden: false },
    ]);
    // No cross-term cache entry for same-term add
    expect(useStore.getState().crossTermSavedSections[s126]).toBeUndefined();
  });

  it('keeps signed-out cross-term worksheet edits isolated by term', async () => {
    const useStore = await loadStore({ signedIn: false });
    const fallListing = {
      crn: '456' as never,
      section_id: 'FA26-456',
      course: {
        season_code: 'FA26' as Season,
        listings: [{ crn: '456' as never, section_id: 'FA26-456' }],
      },
    };

    expect(
      useStore.getState().addAnonymousWorksheetListing(firstListing, '#123456'),
    ).toBe(true);
    expect(
      useStore.getState().addAnonymousWorksheetListing(fallListing, '#abcdef'),
    ).toBe(true);

    // Adding listings from other terms never moves the viewed season off the
    // current one.
    expect(useStore.getState().viewedSeason).toBe(CUR_SEASON);
    expect(
      getAnonymousWorksheetCourses(
        useStore.getState().anonymousWorksheet,
        s126,
      ),
    ).toEqual([{ sectionId: 'S126-123', color: '#123456', hidden: false }]);
    expect(
      getAnonymousWorksheetCourses(
        useStore.getState().anonymousWorksheet,
        'FA26' as Season,
      ),
    ).toEqual([{ sectionId: 'FA26-456', color: '#abcdef', hidden: false }]);
  });
});
