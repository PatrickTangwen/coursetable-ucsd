import { describe, expect, it, vi } from 'vitest';

import {
  applyWorksheetOptions,
  createWorksheetOptionsDraft,
  resetWorksheetOptionsDraft,
} from './worksheetOptionsState';
import { CUR_SEASON } from '../../config';
import type { Season } from '../../queries/graphql-types';

describe('worksheet options draft', () => {
  it('copies the current settings without changing them', () => {
    expect(
      createWorksheetOptionsDraft('list', 'finals', 'FA26' as Season),
    ).toEqual({ view: 'list', weeks: 'finals', term: 'FA26' });
  });

  it('resets to the Worksheet defaults', () => {
    expect(resetWorksheetOptionsDraft()).toEqual({
      view: 'calendar',
      weeks: 'week',
      term: CUR_SEASON,
    });
  });

  it('applies all anonymous Worksheet settings as one explicit action', async () => {
    const actions = {
      changeWorksheetView: vi.fn(),
      setCalendarMode: vi.fn(),
      changeViewedSeason: vi.fn(),
      ensureMainSavedWorksheetForTerm: vi.fn(),
      getViewedSeason: vi.fn(() => 'FA26' as Season),
    };

    const applied = await applyWorksheetOptions(
      { view: 'list', weeks: 'finals', term: 'FA26' as Season },
      'SP26' as Season,
      false,
      actions,
    );

    expect(actions.changeWorksheetView).toHaveBeenCalledWith('list');
    expect(actions.setCalendarMode).toHaveBeenCalledWith('finals');
    expect(actions.changeViewedSeason).toHaveBeenCalledWith('FA26');
    expect(actions.ensureMainSavedWorksheetForTerm).not.toHaveBeenCalled();
    expect(applied).toBe(true);
  });

  it('uses the account-owned term flow for a signed-in Worksheet', async () => {
    const actions = {
      changeWorksheetView: vi.fn(),
      setCalendarMode: vi.fn(),
      changeViewedSeason: vi.fn(),
      ensureMainSavedWorksheetForTerm: vi.fn().mockResolvedValue(undefined),
      getViewedSeason: vi.fn(() => 'FA26' as Season),
    };

    const applied = await applyWorksheetOptions(
      { view: 'calendar', weeks: 'week', term: 'FA26' as Season },
      'SP26' as Season,
      true,
      actions,
    );

    expect(actions.ensureMainSavedWorksheetForTerm).toHaveBeenCalledWith(
      'FA26',
    );
    expect(actions.changeViewedSeason).not.toHaveBeenCalled();
    expect(actions.changeWorksheetView).toHaveBeenCalledWith('calendar');
    expect(actions.setCalendarMode).toHaveBeenCalledWith('week');
    expect(applied).toBe(true);
  });

  it('does not partially apply View or Weeks when a signed-in term fails', async () => {
    const actions = {
      changeWorksheetView: vi.fn(),
      setCalendarMode: vi.fn(),
      changeViewedSeason: vi.fn(),
      ensureMainSavedWorksheetForTerm: vi.fn().mockResolvedValue(undefined),
      getViewedSeason: vi.fn(() => 'SP26' as Season),
    };

    const applied = await applyWorksheetOptions(
      { view: 'list', weeks: 'finals', term: 'FA26' as Season },
      'SP26' as Season,
      true,
      actions,
    );

    expect(actions.changeWorksheetView).not.toHaveBeenCalled();
    expect(actions.setCalendarMode).not.toHaveBeenCalled();
    expect(applied).toBe(false);
  });
});
