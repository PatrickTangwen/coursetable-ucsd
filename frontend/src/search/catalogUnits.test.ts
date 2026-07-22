import { describe, expect, it } from 'vitest';

import {
  catalogUnitValues,
  formatCatalogUnitLabel,
  toggleCatalogUnitSelection,
} from './catalogUnits';

describe('catalog units', () => {
  it.each([
    ['4', [4]],
    ['0.5', [0.5]],
    ['2 or 4', [2, 4]],
    ['1–4', [1, 2, 3, 4]],
    ['2, 4, 6, 8, 10, or 12', [2, 4, 6, 8, 10, 12]],
    ['0-2-4', [0, 2, 4]],
    ['4—6', [4, 5, 6]],
    [null, []],
  ])('preserves the numeric units filter value for %s', (raw, expected) => {
    expect(catalogUnitValues(raw)).toEqual(expected);
  });

  it('formats singular and plural option labels', () => {
    expect(formatCatalogUnitLabel(1)).toBe('1 unit');
    expect(formatCatalogUnitLabel(4)).toBe('4 units');
  });

  it('toggles only available unit options while allowing selected values to clear', () => {
    const available = [{ value: 4, label: '4 units' }];
    expect(toggleCatalogUnitSelection([], available, 4)).toEqual(available);
    expect(toggleCatalogUnitSelection([], available, 3)).toEqual([]);
    expect(toggleCatalogUnitSelection(available, [], 4)).toEqual([]);
  });
});
