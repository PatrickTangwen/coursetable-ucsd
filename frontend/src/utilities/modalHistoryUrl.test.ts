import { describe, expect, it } from 'vitest';
import { getListingId } from './course';
import { parseCourseModalQuery } from './modalHistoryUrl';
import type { Crn, Season } from '../queries/graphql-types';

describe('course modal URL parsing', () => {
  it('parses legacy numeric and UCSD term modal params', () => {
    expect(parseCourseModalQuery('202501-12345')).toEqual({
      seasonCode: '202501',
      crn: 12345,
      listingId: getListingId('202501' as Season, 12345 as Crn),
    });
    expect(parseCourseModalQuery('FA26-1804430517')).toEqual({
      seasonCode: 'FA26',
      crn: 1804430517,
      listingId: getListingId('FA26' as Season, 1804430517 as Crn),
    });
  });
});
