import { describe, expect, it } from 'vitest';
import { toSeasonDate, toSeasonString } from './course';
import type { Season } from '../queries/graphql-types';

describe('UCSD term display helpers', () => {
  it('formats UCSD Active Planning Term codes', () => {
    expect(toSeasonString('FA26' as Season)).toBe('Fall 2026');
    expect(toSeasonDate('FA26' as Season)).toBe('2026-09-01');
  });
});
