import { describe, expect, it } from 'vitest';

import {
  getNextWorksheetColor,
  getWorksheetColorToken,
  worksheetColors,
} from './constants';

describe('worksheet color assignment', () => {
  it('walks the palette without repeating a color', () => {
    const assignedColors: string[] = [];

    for (const expectedColor of worksheetColors) {
      const color = getNextWorksheetColor(assignedColors);
      expect(color).toBe(expectedColor);
      assignedColors.push(color);
    }

    expect(assignedColors).toEqual(worksheetColors);
    expect(new Set(assignedColors).size).toBe(worksheetColors.length);
  });

  it('reuses the least-used palette color after the palette is exhausted', () => {
    const usedColors = [worksheetColors[0]!, ...worksheetColors];

    expect(getNextWorksheetColor(usedColors)).toBe(worksheetColors[1]);
  });

  it('matches stored colors without depending on hex casing', () => {
    expect(getNextWorksheetColor([worksheetColors[0]!.toLowerCase()])).toBe(
      worksheetColors[1],
    );
  });

  it('returns the matching surface and text colors for a preset', () => {
    expect(getWorksheetColorToken('#d96868')).toMatchObject({
      hue: 'Coral',
      soft: '#FBEAEA',
      deep: '#8D3434',
    });
  });
});
