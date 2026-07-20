import { describe, expect, it, vi } from 'vitest';

import { createCalendarSlice } from './CalendarSlice';

function createTestSlice() {
  const set = vi.fn();
  const slice = createCalendarSlice(
    set as never,
    vi.fn() as never,
    {} as never,
  );
  return { set, slice };
}

describe('CalendarSlice current time line preference', () => {
  it('is hidden by default', () => {
    const { slice } = createTestSlice();

    expect(slice.showCalendarNowLine).toBe(false);
  });

  it('can be shown from Calendar settings', () => {
    const { set, slice } = createTestSlice();

    slice.setShowCalendarNowLine(true);

    expect(set).toHaveBeenCalledWith({ showCalendarNowLine: true });
  });
});
