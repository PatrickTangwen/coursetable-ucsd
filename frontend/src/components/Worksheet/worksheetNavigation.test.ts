import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  openWeeklyLoad,
  scrollToRequestedWeeklyLoad,
} from './worksheetNavigation';

describe('worksheet weekly-load navigation', () => {
  const replaceState = vi.fn();

  beforeEach(() => {
    replaceState.mockReset();
    vi.stubGlobal('window', {
      location: {
        pathname: '/worksheet',
        search: '?t=FA26',
        hash: '',
      },
      history: { state: { key: 'route' }, replaceState },
    });
  });

  it('marks Weekly load as the destination before switching to list view', () => {
    const changeWorksheetView = vi.fn();

    openWeeklyLoad(changeWorksheetView);

    expect(replaceState).toHaveBeenCalledWith(
      { key: 'route' },
      '',
      '/worksheet?t=FA26#weekly-load',
    );
    expect(changeWorksheetView).toHaveBeenCalledWith('list');
  });

  it('scrolls to a requested Weekly load and consumes the destination', () => {
    window.location.hash = '#weekly-load';
    const element = {
      scrollIntoView: vi.fn(),
    } as unknown as HTMLElement;

    expect(scrollToRequestedWeeklyLoad(element)).toBe(true);
    expect(element.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(replaceState).toHaveBeenLastCalledWith(
      { key: 'route' },
      '',
      '/worksheet?t=FA26',
    );
  });

  it('does not scroll for unrelated navigation', () => {
    const element = {
      scrollIntoView: vi.fn(),
    } as unknown as HTMLElement;

    expect(scrollToRequestedWeeklyLoad(element)).toBe(false);
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });
});
