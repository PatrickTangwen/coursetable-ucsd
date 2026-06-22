import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppUserInfo,
  SavedWorksheet,
  SavedWorksheetSummary,
} from '../queries/api';
import type { Season } from '../queries/graphql-types';

const apiMocks = vi.hoisted(() => ({
  createBlankSavedWorksheet: vi.fn(),
  ensureMainSavedWorksheet: vi.fn(),
  fetchSavedWorksheet: vi.fn(),
  fetchSavedWorksheets: vi.fn(),
}));

vi.mock('../queries/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries/api')>();
  return {
    ...actual,
    createBlankSavedWorksheet: apiMocks.createBlankSavedWorksheet,
    ensureMainSavedWorksheet: apiMocks.ensureMainSavedWorksheet,
    fetchSavedWorksheet: apiMocks.fetchSavedWorksheet,
    fetchSavedWorksheets: apiMocks.fetchSavedWorksheets,
  };
});

const s126 = 'S126' as Season;

const testUser: AppUserInfo = {
  user_id: 1,
  verifiedEmail: 'student@ucsd.edu',
  firstName: null,
  lastName: null,
  email: 'student@ucsd.edu',
  hasEvals: false,
  year: null,
  school: null,
  major: null,
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
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
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

async function loadStore() {
  vi.resetModules();
  vi.stubGlobal('localStorage', createStorage());
  vi.stubGlobal('sessionStorage', createStorage());
  const { useStore } = await import('../store');
  useStore.setState({
    authStatus: 'authenticated',
    user: testUser,
  });
  return useStore;
}

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
});
