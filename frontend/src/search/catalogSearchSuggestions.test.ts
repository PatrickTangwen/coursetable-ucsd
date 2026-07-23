import { describe, expect, it } from 'vitest';

import {
  createCatalogSearchSuggestionIndex,
  catalogSearchValues,
  matchesCatalogSearchSuggestion,
  searchCatalogSearchSuggestions,
} from './catalogSearchSuggestions';
import { createCoursePlanningListingFixture } from '../testFixtures/coursePlanningListing';

function listing() {
  const result = createCoursePlanningListingFixture('MATH-20-A01', 'MATH 20');
  result.course.title = 'Calculus for Science and Engineering';
  result.section.instructors = [{ name: 'Ada Lovelace' }];
  result.section.meetings = [
    {
      days: ['Monday', 'Wednesday', 'Friday'],
      date: null,
      startTime: '11:00',
      endTime: '11:50',
      building: 'CENTR',
      room: '101',
      isTba: false,
      meetingType: 'Lecture',
      rawDays: 'MWF',
      rawTime: '11:00a-11:50a',
      rawLocation: 'CENTR 101',
    },
  ];
  result.section.availability = {
    enrolled: 80,
    capacity: 100,
    availableSeats: 20,
    capacityKind: 'bounded',
    waitlistCount: 0,
    snapshotTimestamp: null,
  };
  return result;
}

describe('Catalog search suggestions', () => {
  it('shows subject-code and subject-name matches like the reference UI', () => {
    const math = listing();
    const msed = listing();
    msed.course.subject = 'MSED';
    msed.course.courseCode = 'MSED 295';
    const index = createCatalogSearchSuggestionIndex([math, msed]);
    const suggestions = searchCatalogSearchSuggestions(index, 'math');

    expect(suggestions.slice(0, 2)).toEqual([
      {
        column: 'Subject',
        label: 'MATH / Mathematics',
        value: 'MATH',
      },
      {
        column: 'Subject',
        label: 'MSED / Mathematics & Science Educ',
        value: 'MSED',
      },
    ]);
  });

  it('queries a reusable suggestion index without rebuilding listing values', () => {
    const math = listing();
    const cse = listing();
    cse.course.subject = 'CSE';
    cse.course.courseCode = 'CSE 100';
    cse.course.title = 'Advanced Data Structures';

    const index = createCatalogSearchSuggestionIndex([math, cse]);

    expect(searchCatalogSearchSuggestions(index, 'math')[0]).toEqual({
      column: 'Subject',
      label: 'MATH / Mathematics',
      value: 'MATH',
    });
    expect(searchCatalogSearchSuggestions(index, 'data')[0]).toEqual({
      column: 'Title',
      label: 'Advanced Data Structures',
      value: 'Advanced Data Structures',
    });
  });

  it('builds searchable values for every supported catalog data column', () => {
    const values = catalogSearchValues(listing()).join(' | ');

    expect(values).toContain('MATH 20');
    expect(values).toContain('A01');
    expect(values).toContain('Calculus for Science and Engineering');
    expect(values).toContain('FA26');
    expect(values).toContain('Ada Lovelace');
    expect(values).toContain('MWF · 11:00 – 11:50 AM');
    expect(values).toContain('CENTR 101');
    expect(values).not.toContain('20 left');
  });

  it('returns matching suggestions from non-code columns', () => {
    const index = createCatalogSearchSuggestionIndex([listing()]);

    expect(searchCatalogSearchSuggestions(index, 'lovelace')[0]?.column).toBe(
      'Instructor',
    );
    expect(searchCatalogSearchSuggestions(index, 'centr')[0]?.column).toBe(
      'Location',
    );
    expect(searchCatalogSearchSuggestions(index, '20 left')).toEqual([]);
  });

  it('matches a selected subject by exact subject code', () => {
    const math = listing();
    const msed = listing();
    msed.course.subject = 'MSED';
    msed.course.courseCode = 'MSED 295';
    const selection = {
      column: 'Subject' as const,
      label: 'MATH / Mathematics',
      value: 'MATH',
    };

    expect(matchesCatalogSearchSuggestion(math, selection)).toBe(true);
    expect(matchesCatalogSearchSuggestion(msed, selection)).toBe(false);
  });
});
