import { describe, expect, it } from 'vitest';
import { flattenCoursePlanningCatalog } from './coursePlanningViewModels';
import type { Season } from './graphql-types';
import { catalogResponseToCatalogData } from './ucsdCatalogSnapshot';
import { coursePlanningListingToWorksheetCourse } from '../types/worksheetCourse';
import { getCalendarEvents } from '../utilities/calendar';

const tssCatalogResponse = {
  schema_version: 'tss-chatbot-v1',
  term: 'FA26',
  requested_course: 'CAT',
  source_metadata: {
    last_refreshed_displayed: '2026-07-21T16:24:07+00:00',
  },
  courses: [
    {
      course_code: '001',
      course_title: 'Culture, Art, and Technology 1',
      tss_course_code: 'CAT-001',
      booking_choices: [
        {
          booking_choice_ordinal: 1,
          displayed_package_section: null,
          displayed_package_id: null,
          final_exam_date: null,
          components: [
            {
              type: 'lecture',
              section_code: '001-000-LE',
              event_id: 'E 00000665',
              requirement: 'required',
              meetings: [
                {
                  meeting_kind: 'class',
                  specific_date: null,
                  days: 'M W F',
                  start_time: '11:00am',
                  end_time: '11:50am',
                  location_displayed: 'PRICE THTRE',
                  instructor: 'Phoebe Bronstein',
                  is_tba: false,
                  is_arranged: null,
                },
              ],
              enrollment: {
                enrolled: null,
                capacity: null,
                seats_available: 256,
                waitlist: { state: 'not_shown', count: null },
                waitlist_only: null,
                approval_required: null,
                status_code: null,
                is_cancelled: null,
              },
            },
            {
              type: 'discussion',
              section_code: '001-001-DI',
              event_id: 'E 00000669',
              requirement: 'required',
              meetings: [
                {
                  meeting_kind: 'class',
                  specific_date: null,
                  days: 'M',
                  start_time: '9:00am',
                  end_time: '9:50am',
                  location_displayed: 'HSS 1106B',
                  instructor: 'Phoebe Bronstein',
                  is_tba: false,
                  is_arranged: null,
                },
              ],
              enrollment: {
                enrolled: null,
                capacity: null,
                seats_available: 16,
                waitlist: { state: 'not_shown', count: null },
                waitlist_only: null,
                approval_required: null,
                status_code: null,
                is_cancelled: null,
              },
            },
          ],
          package_meetings: [],
          package_enrollment: null,
        },
      ],
    },
  ],
  coverage: {
    complete: true,
    continuation_needed: false,
  },
};

describe('TSS catalog response adapter', () => {
  it('keeps TBA components when TSS uses nullable days and numeric flags', () => {
    const baseCourse = tssCatalogResponse.courses[0]!;
    const baseChoice = baseCourse.booking_choices[0]!;
    const baseComponent = baseChoice.components[0]!;
    const baseMeeting = baseComponent.meetings[0]!;
    const response = {
      ...tssCatalogResponse,
      courses: [
        {
          ...baseCourse,
          course_title: null,
          booking_choices: [
            {
              ...baseChoice,
              components: [
                {
                  ...baseComponent,
                  meetings: [
                    {
                      ...baseMeeting,
                      days: null,
                      start_time: 'tba',
                      end_time: 'tba',
                      is_tba: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { coursePlanningCatalog } = catalogResponseToCatalogData(response);
    expect(coursePlanningCatalog).toMatchObject({
      courses: [
        {
          title: 'CAT 1',
          sections: [
            {
              meetings: [
                {
                  days: [],
                  startTime: null,
                  endTime: null,
                  isTba: true,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('loads a tss-chatbot-v1 response through the catalog loader boundary', () => {
    const data = catalogResponseToCatalogData(tssCatalogResponse);

    expect(data.coursePlanningCatalog).toMatchObject({
      supportedTerm: 'FA26',
      termLabel: 'Fall 2026',
      generatedAt: '2026-07-21T16:24:07+00:00',
      coverage: {
        complete: true,
        continuationNeeded: false,
      },
      courses: [
        {
          courseId: 'CAT:1',
          subject: 'CAT',
          courseNumber: '1',
          courseCode: 'CAT 1',
          title: 'Culture, Art, and Technology 1',
        },
      ],
    });
    expect(data.legacyCourseMap).toHaveLength(1);
  });

  it('preserves partial coverage and hides availability without a source timestamp', () => {
    const response = {
      ...tssCatalogResponse,
      source_metadata: { last_refreshed_displayed: null },
      coverage: { complete: true, continuation_needed: true },
    };

    const { coursePlanningCatalog } = catalogResponseToCatalogData(response);

    expect(coursePlanningCatalog).toMatchObject({
      generatedAt: '',
      coverage: {
        complete: true,
        continuationNeeded: true,
      },
      courses: [
        {
          sections: [
            {
              availability: {
                enrolled: null,
                capacity: null,
                availableSeats: null,
                waitlistCount: null,
                snapshotTimestamp: null,
              },
              sourceNote:
                'TSS schedule snapshot · partial coverage; continuation needed',
            },
          ],
        },
      ],
    });
  });

  it('produces normalized meetings for the worksheet calendar view', () => {
    const { coursePlanningCatalog } =
      catalogResponseToCatalogData(tssCatalogResponse);
    expect(coursePlanningCatalog).not.toBeNull();
    const [listing] = flattenCoursePlanningCatalog(coursePlanningCatalog!);
    const worksheetCourse = coursePlanningListingToWorksheetCourse(
      listing!,
      '#123456',
      false,
    );

    const events = getCalendarEvents(
      'rbc',
      [worksheetCourse],
      'FA26' as Season,
    );

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.day)).toEqual([1, 3, 5, 1]);
    expect(events[0]).toMatchObject({
      title: 'CAT 1 001-000-LE + 001-001-DI Lecture',
      location: 'PRICE THTRE',
      meetingType: 'Lecture',
      section: '001-000-LE + 001-001-DI',
      date: null,
    });
    expect(events[3]).toMatchObject({
      location: 'HSS 1106B',
      meetingType: 'Discussion',
    });
  });

  it('produces the listing data consumed by the catalog list view', () => {
    const { coursePlanningCatalog } =
      catalogResponseToCatalogData(tssCatalogResponse);
    const [listing] = flattenCoursePlanningCatalog(coursePlanningCatalog!);

    expect(listing).toMatchObject({
      generatedAt: '2026-07-21T16:24:07+00:00',
      course: {
        courseId: 'CAT:1',
        courseCode: 'CAT 1',
        title: 'Culture, Art, and Technology 1',
      },
      section: {
        sectionId: 'FA26:CAT-001:E00000665+E00000669',
        sectionCode: '001-000-LE + 001-001-DI',
        meetingType: 'Package',
        instructors: [{ name: 'Phoebe Bronstein' }],
        availability: {
          enrolled: null,
          capacity: null,
          availableSeats: 16,
          waitlistCount: null,
          snapshotTimestamp: '2026-07-21T16:24:07+00:00',
        },
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            startTime: '11:00',
            endTime: '11:50',
            building: 'PRICE',
            room: 'THTRE',
            rawDays: 'MWF',
            meetingType: 'Lecture',
          },
          {
            days: ['Monday'],
            startTime: '09:00',
            endTime: '09:50',
            building: 'HSS',
            room: '1106B',
            rawDays: 'M',
            meetingType: 'Discussion',
          },
        ],
      },
    });
  });
});
