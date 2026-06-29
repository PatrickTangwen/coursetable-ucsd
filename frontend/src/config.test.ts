import { describe, expect, it } from 'vitest';

import { resolveCurrentUcsdTerm } from './config';

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
