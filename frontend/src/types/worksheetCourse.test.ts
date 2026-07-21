import { describe, expect, it } from 'vitest';

import { coursePlanningListingToWorksheetCourse } from './worksheetCourse';
import {
  coursePlanningSectionModalId,
  type CoursePlanningListing,
} from '../queries/coursePlanningViewModels';

const listing: CoursePlanningListing = {
  generatedAt: '2026-07-17T12:00:00.000Z',
  catalogCoverage: { complete: true, continuationNeeded: false },
  evaluation: {
    overallRating: null,
    workload: null,
    professorRating: null,
    gutRating: null,
    enrollment: null,
  },
  course: {
    courseId: 'CSE:100R',
    subject: 'CSE',
    courseNumber: '100R',
    courseCode: 'CSE 100R',
    title: 'Algorithm Design and Analysis',
    units: '4',
    description: null,
    prerequisites: null,
    restrictions: null,
    requirements: null,
    catalogUrl: null,
    archiveRecordCount: 0,
    pastGrades: [],
    sections: [],
  },
  section: {
    sectionId: 'S126:2225928116',
    courseId: 'CSE:100R',
    supportedTerm: 'S126',
    sectionCode: 'A02',
    meetingType: 'Lecture',
    instructors: [{ name: 'Ada Lovelace' }],
    meetings: [
      {
        days: ['Monday', 'Wednesday'],
        date: null,
        startTime: '09:00',
        endTime: '09:50',
        building: 'CENTR',
        room: '101',
        isTba: false,
        meetingType: 'Lecture',
        rawDays: 'MW',
        rawTime: '9:00a-9:50a',
        rawLocation: 'CENTR 101',
      },
    ],
    availability: {
      enrolled: 90,
      capacity: 100,
      availableSeats: 10,
      waitlistCount: 0,
      snapshotTimestamp: '2026-07-17T10:00:00.000Z',
    },
    sourceNote: 'UCSD Schedule of Classes',
  },
};

describe('Course Planning Worksheet view model', () => {
  it('preserves Section identity and meeting placement from owned models', () => {
    const course = coursePlanningListingToWorksheetCourse(
      listing,
      '#123456',
      false,
    );

    expect(course).toMatchObject({
      crn: coursePlanningSectionModalId('S126:2225928116'),
      color: '#123456',
      hidden: false,
      listing: {
        section_id: 'S126:2225928116',
        course_code: 'CSE 100R',
        course: {
          season_code: 'S126',
          section: 'A02',
          title: 'Algorithm Design and Analysis',
          credits: 4,
          course_professors: [{ professor: { name: 'Ada Lovelace' } }],
          course_meetings: [
            {
              days_of_week: (1 << 1) | (1 << 3),
              start_time: '09:00',
              end_time: '09:50',
              meeting_type: 'Lecture',
              location: {
                building: { code: 'CENTR' },
                room: '101',
              },
            },
          ],
        },
      },
    });
  });

  it('preserves variable units and keeps TBA meetings out of scheduled rows', () => {
    const tbaMeeting = {
      days: [],
      date: null,
      startTime: null,
      endTime: null,
      building: null,
      room: null,
      isTba: true,
      meetingType: 'Discussion',
      rawDays: 'TBA',
      rawTime: 'TBA',
      rawLocation: 'TBA',
    };
    const course = coursePlanningListingToWorksheetCourse(
      {
        ...listing,
        course: { ...listing.course, units: '2 or 4' },
        section: {
          ...listing.section,
          meetings: [...listing.section.meetings, tbaMeeting],
        },
      },
      '#123456',
      false,
    );

    expect(course.listing.course.credits).toBe(2);
    expect(course.listing.course.course_meetings).toHaveLength(1);
    expect(course.listing.course.ucsd_calendar?.meetings).toHaveLength(2);
  });
});
