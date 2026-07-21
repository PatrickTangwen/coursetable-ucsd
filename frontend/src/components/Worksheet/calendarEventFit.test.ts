import { describe, expect, it, vi } from 'vitest';

import { chooseCalendarEventFontSize } from './calendarEventFit';

describe('calendar event text fitting', () => {
  it('keeps the standard size when all event details fit', () => {
    const fitsAt = vi.fn(() => true);

    expect(chooseCalendarEventFontSize(11, 4, fitsAt)).toBe(11);
    expect(fitsAt).toHaveBeenCalledTimes(1);
  });

  it('finds the largest size that keeps the complete hierarchy visible', () => {
    const fontSize = chooseCalendarEventFontSize(
      11,
      4,
      (candidate) => candidate <= 9.5,
    );

    expect(fontSize).toBeGreaterThan(9.4);
    expect(fontSize).toBeLessThanOrEqual(9.5);
  });

  it('returns the emergency floor when even it cannot fit', () => {
    const fontSize = chooseCalendarEventFontSize(11, 4, () => false);

    expect(fontSize).toBe(4);
  });
});
