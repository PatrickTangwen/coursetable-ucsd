import { describe, expect, it } from 'vitest';

import {
  isWorksheetTerm,
  supportedTerms,
  worksheetTerms,
} from './catalogSeasons';
import type { Season } from '../queries/graphql-types';

describe('term selector scopes', () => {
  it('limits Worksheet to Summer Session I 2026 through Fall 2026', () => {
    expect(worksheetTerms).toEqual(['FA26', 'S326', 'S226', 'S126']);
    expect(isWorksheetTerm('FA26' as Season)).toBe(true);
    expect(isWorksheetTerm('SP26' as Season)).toBe(false);
  });

  it('keeps Catalog terms outside the Worksheet window', () => {
    expect(supportedTerms).toContain('SP26');
    expect(supportedTerms).toContain('FA25');
  });
});
