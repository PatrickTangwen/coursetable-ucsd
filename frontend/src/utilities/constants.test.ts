import { describe, expect, it } from 'vitest';

import {
  getNextWorksheetColor,
  getWorksheetColorAppearance,
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

  it('uses the approved dark-mode appearance for every course hue', () => {
    const expected = [
      ['#D96868', '#2C1C1F', '#382226', '#704047', '#D9787C', '#F0A5A8'],
      ['#D98245', '#2D211A', '#39291F', '#755039', '#D98A55', '#EDB083'],
      ['#C79A30', '#2B2619', '#37301D', '#6F602E', '#C9A447', '#E4C976'],
      ['#62A168', '#1C281F', '#223328', '#416A49', '#6DAF74', '#9BD1A0'],
      ['#3F9B91', '#182927', '#1E3431', '#376B65', '#4EAAA0', '#82CEC6'],
      ['#4E8BC8', '#192532', '#1E2F40', '#365E83', '#6098D0', '#91BDE6'],
      ['#6C76C8', '#202236', '#282B44', '#505889', '#7D87D4', '#ABB2EA'],
      ['#9369BD', '#271F32', '#32283F', '#654A7C', '#A17AC5', '#C7A6E1'],
      ['#C56892', '#301E29', '#3C2633', '#79445D', '#D0789E', '#E7A7C2'],
    ] as const;

    for (const [color, background, hover, border, primary, text] of expected) {
      expect(getWorksheetColorAppearance(color, 'dark')).toEqual({
        background,
        hover,
        border,
        primary,
        text,
      });
    }
  });

  it('maps historical presets only in Dark Mode', () => {
    expect(getWorksheetColorAppearance('#3d95d6', 'dark')).toEqual(
      getWorksheetColorAppearance('#4E8BC8', 'dark'),
    );
    expect(getWorksheetColorAppearance('#31a4d4', 'dark')).toEqual(
      getWorksheetColorAppearance('#4E8BC8', 'dark'),
    );
    expect(getWorksheetColorAppearance('#49be85', 'dark')).toEqual(
      getWorksheetColorAppearance('#62A168', 'dark'),
    );
    expect(getWorksheetColorAppearance('#2cafb7', 'dark')).toEqual(
      getWorksheetColorAppearance('#3F9B91', 'dark'),
    );
    expect(getWorksheetColorAppearance('#26ba9a', 'dark')).toEqual(
      getWorksheetColorAppearance('#62A168', 'dark'),
    );
    expect(getWorksheetColorAppearance('#3d95d6', 'light').primary).toBe(
      '#3d95d6',
    );
  });
});
