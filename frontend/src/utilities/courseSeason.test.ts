import { describe, expect, it } from 'vitest';
import {
  compareSeasonsByRecency,
  toSeasonDate,
  toSeasonString,
} from './course';
import type { Season } from '../queries/graphql-types';

describe('UCSD term display helpers', () => {
  it('formats UCSD Active Planning Term codes', () => {
    expect(toSeasonString('FA26' as Season)).toBe('Fall 2026');
    expect(toSeasonDate('FA26' as Season)).toBe('2026-09-01');
  });

  it('sorts UCSD terms by descending recency', () => {
    const terms = [
      'S224',
      'S326',
      'FA25',
      'SP26',
      'WI26',
      'S126',
      'S226',
      'FA24',
    ] as Season[];

    expect([...terms].sort(compareSeasonsByRecency)).toEqual([
      'S326',
      'S226',
      'S126',
      'SP26',
      'WI26',
      'FA25',
      'FA24',
      'S224',
    ]);
  });
});
