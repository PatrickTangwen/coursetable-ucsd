import { describe, expect, it } from 'vitest';

import { CUR_SEASON, resolveCurrentUcsdTerm } from './config';
import supportedTerms from './generated/supported-terms.json';

describe('active planning term', () => {
  it('defaults Catalog and Worksheet to Fall 2026', () => {
    expect(CUR_SEASON).toBe('FA26');
  });

  it('keeps the Active Planning Term in generated Catalog metadata', () => {
    expect(supportedTerms).toContain(CUR_SEASON);
  });
});

describe('resolveCurrentUcsdTerm', () => {
  it('uses Spring 2026 during the explicit UCSD spring date range', () => {
    expect(resolveCurrentUcsdTerm(new Date(2026, 2, 30))).toBe('SP26');
  });

  it('uses Summer Session 1 2026 after Spring 2026 ends', () => {
    expect(resolveCurrentUcsdTerm(new Date(2026, 5, 28))).toBe('S126');
  });

  it('uses Summer Session 2 2026 after Summer Session 1 ends', () => {
    expect(resolveCurrentUcsdTerm(new Date(2026, 7, 3))).toBe('S226');
  });
});
