import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Worksheet from './Worksheet';

const worksheetState = vi.hoisted(() => ({
  isMobile: false,
  worksheetLoading: false,
  worksheetError: null,
  worksheetView: 'calendar',
  isCalendarViewLocked: false,
  authStatus: 'authenticated',
  user: { user_id: 1 },
  viewAnonymousWorksheet: false,
  activeSavedWorksheet: undefined,
  activeSavedWorksheetOwnerId: undefined,
  savedWorksheetBootstrapStatus: 'error',
  savedWorksheetBootstrapError: new Error('Failed to load Saved Worksheet'),
  ensureMainSavedWorksheetForTerm: vi.fn(),
  setCalendarViewLocked: vi.fn(),
  setCalendarLockSettingsOpen: vi.fn(),
}));

vi.mock('../store', () => ({
  useStore: (selector: (state: typeof worksheetState) => unknown) =>
    selector(worksheetState),
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('../slices/WorksheetSlice', () => ({
  getInitialSavedWorksheetTerm: vi.fn(),
  parseCoursesFromURL: vi.fn(),
}));
vi.mock('../utilities/anonymousWorksheet', () => ({
  parseAnonymousWorksheetShare: vi.fn(),
}));
vi.mock('../components/Spinner', () => ({ default: () => null }));
vi.mock('../components/Worksheet/CalendarLockSettingsModal', () => ({
  default: () => null,
}));
vi.mock('../components/Worksheet/SunGridCalendar', () => ({
  default: () => null,
}));
vi.mock('../components/Worksheet/WorksheetCalendarSidebar', () => ({
  default: () => null,
}));
vi.mock('../components/Worksheet/WorksheetList', () => ({
  default: () => null,
}));

describe('Worksheet page load errors', () => {
  beforeEach(() => {
    worksheetState.savedWorksheetBootstrapStatus = 'error';
    worksheetState.savedWorksheetBootstrapError = new Error(
      'Failed to load Saved Worksheet',
    );
  });

  it('uses the shared status page when Saved Worksheet bootstrap fails', () => {
    const html = renderToStaticMarkup(<Worksheet />);

    expect(html).toContain('Unable to load this page');
    expect(html).toContain('page_not_found.png');
  });
});
