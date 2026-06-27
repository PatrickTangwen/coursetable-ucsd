import { describe, expect, it } from 'vitest';
import { isPlannableTerm, supportedTermCodes } from './termPlanning';
import type { SupportedTerm } from '../queries/api';

function term(
  overrides: Partial<SupportedTerm> & Pick<SupportedTerm, 'term'>,
): SupportedTerm {
  const { term: termCode, ...rest } = overrides;
  return {
    term: termCode,
    label: termCode,
    date_range: null,
    frozen: false,
    generated_at: '2026-06-27T00:00:00.000Z',
    snapshot_path: `catalogs/public/${termCode}.json`,
    manifest_path: `catalogs/import-manifests/${termCode}.json`,
    ...rest,
  };
}

describe('term planning predicates', () => {
  it('keeps supported term codes in registry order', () => {
    expect(
      supportedTermCodes([
        term({ term: 'SP26' }),
        term({ term: 'FA25' }),
        term({ term: 'SP26' }),
      ]),
    ).toEqual(['SP26', 'FA25']);
  });

  it('treats current and upcoming terms as plannable by date range', () => {
    const now = new Date('2026-06-27T12:00:00.000Z');

    expect(
      isPlannableTerm(
        term({
          term: 'S226',
          date_range: { start: '2026-06-29', end: '2026-08-01' },
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isPlannableTerm(
        term({
          term: 'FA26',
          date_range: { start: '2026-09-24', end: '2026-12-12' },
        }),
        now,
      ),
    ).toBe(true);
  });

  it('treats ended or frozen terms as not plannable', () => {
    const now = new Date('2026-06-27T12:00:00.000Z');

    expect(
      isPlannableTerm(
        term({
          term: 'SP26',
          date_range: { start: '2026-03-30', end: '2026-06-12' },
        }),
        now,
      ),
    ).toBe(false);
    expect(isPlannableTerm(term({ term: 'FA25', frozen: true }), now)).toBe(
      false,
    );
  });

  it('does not guess ended state when registry date range is unavailable', () => {
    expect(isPlannableTerm(term({ term: 'WI25' }))).toBe(true);
  });
});
