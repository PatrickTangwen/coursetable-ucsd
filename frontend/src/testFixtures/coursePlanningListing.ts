import type { CoursePlanningListing } from '../queries/coursePlanningViewModels';

export function createCoursePlanningListingFixture(
  sectionId: string,
  courseCode: string,
): CoursePlanningListing {
  const [subject = 'CSE', courseNumber = '3'] = courseCode.split(' ');
  return {
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
      courseId: `${subject}:${courseNumber}`,
      subject,
      courseNumber,
      courseCode,
      title: `${courseCode} title`,
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
      sectionId,
      courseId: `${subject}:${courseNumber}`,
      supportedTerm: 'FA26',
      sectionCode: 'A01',
      meetingType: 'Lecture',
      instructors: [],
      meetings: [],
      availability: {
        enrolled: null,
        capacity: null,
        availableSeats: null,
        capacityKind: null,
        waitlistCount: 0,
        snapshotTimestamp: null,
      },
      sourceNote: null,
    },
  };
}
