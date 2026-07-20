import { describe, expect, it } from 'vitest';
import { isDownwardCloseGesture } from './bottomSheetGesture';

describe('isDownwardCloseGesture', () => {
  it('accepts a deliberate downward swipe', () => {
    expect(isDownwardCloseGesture({ x: 40, y: 10 }, { x: 44, y: 90 })).toBe(
      true,
    );
  });

  it('rejects short and mostly horizontal gestures', () => {
    expect(isDownwardCloseGesture({ x: 40, y: 10 }, { x: 40, y: 70 })).toBe(
      false,
    );
    expect(isDownwardCloseGesture({ x: 40, y: 10 }, { x: 120, y: 90 })).toBe(
      false,
    );
  });
});
