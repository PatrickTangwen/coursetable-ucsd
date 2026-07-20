import { CUR_SEASON } from '../../config';
import type { Season } from '../../queries/graphql-types';
import type { CalendarMode } from '../../slices/CalendarSlice';
import type { WorksheetView } from '../../slices/WorksheetSlice';

export type WorksheetOptionsView = Exclude<WorksheetView, 'map'>;

export interface WorksheetOptionsDraft {
  view: WorksheetOptionsView;
  weeks: CalendarMode;
  term: Season;
}

interface WorksheetOptionsActions {
  changeWorksheetView: (view: WorksheetOptionsView) => void;
  setCalendarMode: (mode: CalendarMode) => void;
  changeViewedSeason: (term: Season) => void;
  ensureMainSavedWorksheetForTerm: (term: Season) => Promise<void>;
  getViewedSeason: () => Season;
}

export function createWorksheetOptionsDraft(
  view: WorksheetView,
  weeks: CalendarMode,
  term: Season,
): WorksheetOptionsDraft {
  return {
    view: view === 'list' ? 'list' : 'calendar',
    weeks,
    term,
  };
}

export function resetWorksheetOptionsDraft(
  defaultTerm: Season = CUR_SEASON,
): WorksheetOptionsDraft {
  return {
    view: 'calendar',
    weeks: 'week',
    term: defaultTerm,
  };
}

export async function applyWorksheetOptions(
  draft: WorksheetOptionsDraft,
  currentTerm: Season,
  hasSavedWorksheetAccount: boolean,
  actions: WorksheetOptionsActions,
) {
  if (draft.term !== currentTerm) {
    if (hasSavedWorksheetAccount) {
      await actions.ensureMainSavedWorksheetForTerm(draft.term);
      if (actions.getViewedSeason() !== draft.term) return false;
    } else {
      actions.changeViewedSeason(draft.term);
    }
  }

  actions.changeWorksheetView(draft.view);
  actions.setCalendarMode(draft.weeks);
  return true;
}
