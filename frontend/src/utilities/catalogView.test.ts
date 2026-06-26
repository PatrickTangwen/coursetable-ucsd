import { describe, expect, it } from 'vitest';
import {
  parseDays,
  formatTime,
  seatsColor,
  buildOfferingGroups,
} from './catalogView';

describe('parseDays', () => {
  it('parses MTWTh', () => {
    expect(parseDays('MTWTh')).toEqual({
      M: true,
      Tu: true,
      W: true,
      Th: true,
      F: false,
    });
  });

  it('parses TTh', () => {
    expect(parseDays('TTh')).toEqual({
      M: false,
      Tu: true,
      W: false,
      Th: true,
      F: false,
    });
  });

  it('parses MW', () => {
    expect(parseDays('MW')).toEqual({
      M: true,
      Tu: false,
      W: true,
      Th: false,
      F: false,
    });
  });

  it('parses MWF', () => {
    expect(parseDays('MWF')).toEqual({
      M: true,
      Tu: false,
      W: true,
      Th: false,
      F: true,
    });
  });

  it('handles TBA', () => {
    expect(parseDays('TBA')).toEqual({
      M: false,
      Tu: false,
      W: false,
      Th: false,
      F: false,
    });
  });

  it('handles empty string', () => {
    expect(parseDays('')).toEqual({
      M: false,
      Tu: false,
      W: false,
      Th: false,
      F: false,
    });
  });

  it('handles lone T as Tuesday', () => {
    expect(parseDays('T')).toEqual({
      M: false,
      Tu: true,
      W: false,
      Th: false,
      F: false,
    });
  });

  it('parses TuTh', () => {
    expect(parseDays('TuTh')).toEqual({
      M: false,
      Tu: true,
      W: false,
      Th: true,
      F: false,
    });
  });

  it('parses MWThF', () => {
    expect(parseDays('MWThF')).toEqual({
      M: true,
      Tu: false,
      W: true,
      Th: true,
      F: true,
    });
  });
});

describe('formatTime', () => {
  it('formats same-period PM times with elision', () => {
    expect(formatTime('14:00', '15:20')).toBe('2:00 – 3:20 PM');
  });

  it('formats cross-period AM to PM', () => {
    expect(formatTime('11:00', '12:20')).toBe('11:00 AM – 12:20 PM');
  });

  it('formats both AM', () => {
    expect(formatTime('09:00', '09:50')).toBe('9:00 – 9:50 AM');
  });

  it('handles TBA with null start', () => {
    expect(formatTime(null, null)).toBe('TBA');
  });

  it('handles TBA with empty string', () => {
    expect(formatTime('', '')).toBe('TBA');
  });

  it('formats noon correctly', () => {
    expect(formatTime('12:00', '12:50')).toBe('12:00 – 12:50 PM');
  });

  it('formats midnight correctly', () => {
    expect(formatTime('00:00', '00:50')).toBe('12:00 – 12:50 AM');
  });
});

describe('seatsColor', () => {
  it('returns green below 60%', () => {
    expect(seatsColor(29, 50)).toBe('available');
  });

  it('returns green at 59%', () => {
    expect(seatsColor(59, 100)).toBe('available');
  });

  it('returns blue at 60%', () => {
    expect(seatsColor(60, 100)).toBe('filling');
  });

  it('returns blue at 89%', () => {
    expect(seatsColor(89, 100)).toBe('filling');
  });

  it('returns red at 90%', () => {
    expect(seatsColor(90, 100)).toBe('nearly-full');
  });

  it('returns red at 100%', () => {
    expect(seatsColor(50, 50)).toBe('nearly-full');
  });

  it('handles null enrolled', () => {
    expect(seatsColor(null, 50)).toBe('available');
  });

  it('handles null capacity', () => {
    expect(seatsColor(30, null)).toBe('available');
  });

  it('handles zero capacity', () => {
    expect(seatsColor(0, 0)).toBe('available');
  });
});

// --- buildOfferingGroups ---

function makeSection({
  sectionCode,
  meetingType,
  meetings,
  enrolled = 30,
  capacity = 50,
  instructors = ['Staff'],
}: {
  sectionCode: string;
  meetingType: string;
  meetings: { [key: string]: unknown }[];
  enrolled?: number | null;
  capacity?: number | null;
  instructors?: string[];
}) {
  return {
    section_id: `SP26:${sectionCode}`,
    course_id: 'TEST_COURSE',
    section_code: sectionCode,
    meeting_type: meetingType,
    instructors,
    meetings: meetings.map((m: { [key: string]: unknown }) => ({
      days: (m.days ?? []) as string[],
      start_time: (m.start_time ?? null) as string | null,
      end_time: (m.end_time ?? null) as string | null,
      building: (m.building ?? null) as string | null,
      room: (m.room ?? null) as string | null,
      is_tba: Boolean(m.is_tba),
      meeting_type: (m.meeting_type ?? null) as string | null,
      raw_days: (m.raw_days ?? null) as string | null,
      raw_time: (m.raw_time ?? null) as string | null,
      raw_location: (m.raw_location ?? null) as string | null,
    })),
    enrolled,
    capacity,
    waitlist_count: 0,
    raw: {},
  };
}

describe('buildOfferingGroups', () => {
  it('handles single section (CSE 5 pattern)', () => {
    const sections = [
      makeSection({
        sectionCode: 'A01',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Tuesday', 'Thursday'],
            start_time: '15:30',
            end_time: '16:50',
            raw_days: 'TuTh',
          },
          {
            days: ['Monday'],
            start_time: '16:00',
            end_time: '16:50',
            raw_days: 'M',
          },
        ],
        enrolled: 42,
        capacity: 146,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.familyPrefix).toBe('A');
    expect(groups[0]!.sections).toHaveLength(1);
    expect(groups[0]!.totalEnrolled).toBe(42);
    expect(groups[0]!.totalCapacity).toBe(146);
  });

  it('handles multi-section selectable Discussion (MATH 10C pattern)', () => {
    const sections = [
      makeSection({
        sectionCode: 'A01',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '08:00',
            end_time: '08:50',
            raw_days: 'MWF',
          },
          {
            days: ['Thursday'],
            start_time: '17:00',
            end_time: '17:50',
            raw_days: 'Th',
          },
        ],
        enrolled: 35,
        capacity: 35,
      }),
      makeSection({
        sectionCode: 'A02',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '08:00',
            end_time: '08:50',
            raw_days: 'MWF',
          },
          {
            days: ['Thursday'],
            start_time: '18:00',
            end_time: '18:50',
            raw_days: 'Th',
          },
        ],
        enrolled: 34,
        capacity: 35,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.familyPrefix).toBe('A');
    expect(groups[0]!.sections).toHaveLength(2);
    expect(groups[0]!.sharedMeetings).toHaveLength(1);
    expect(groups[0]!.sharedMeetings[0]!.raw_days).toBe('MWF');
    expect(groups[0]!.totalEnrolled).toBe(69);
    expect(groups[0]!.totalCapacity).toBe(70);
  });

  it('handles multi-section selectable Lab (CSE 8A pattern)', () => {
    const shared = [
      {
        days: ['Tuesday', 'Thursday'],
        start_time: '09:30',
        end_time: '10:50',
        raw_days: 'TuTh',
      },
      {
        days: ['Wednesday'],
        start_time: '15:00',
        end_time: '15:50',
        raw_days: 'W',
      },
    ];
    const sections = [
      makeSection({
        sectionCode: 'A50',
        meetingType: 'Laboratory',
        meetings: [
          ...shared,
          {
            days: ['Wednesday'],
            start_time: '10:00',
            end_time: '10:50',
            raw_days: 'W',
          },
        ],
        enrolled: 37,
        capacity: 49,
      }),
      makeSection({
        sectionCode: 'A51',
        meetingType: 'Laboratory',
        meetings: [
          ...shared,
          {
            days: ['Wednesday'],
            start_time: '11:00',
            end_time: '11:50',
            raw_days: 'W',
          },
        ],
        enrolled: 25,
        capacity: 49,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sharedMeetings).toHaveLength(2);
    expect(groups[0]!.totalEnrolled).toBe(62);
    expect(groups[0]!.totalCapacity).toBe(98);
  });

  it('handles multi-family (MATH 10A pattern)', () => {
    const sections = [
      makeSection({
        sectionCode: 'A01',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'MWF',
          },
          {
            days: ['Tuesday'],
            start_time: '08:00',
            end_time: '08:50',
            raw_days: 'Tu',
          },
        ],
        enrolled: 5,
        capacity: 30,
      }),
      makeSection({
        sectionCode: 'A02',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'MWF',
          },
          {
            days: ['Tuesday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'Tu',
          },
        ],
        enrolled: 25,
        capacity: 30,
      }),
      makeSection({
        sectionCode: 'B01',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '11:00',
            end_time: '11:50',
            raw_days: 'MWF',
          },
          {
            days: ['Tuesday'],
            start_time: '12:00',
            end_time: '12:50',
            raw_days: 'Tu',
          },
        ],
        enrolled: 20,
        capacity: 30,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.familyPrefix).toBe('A');
    expect(groups[0]!.sections).toHaveLength(2);
    expect(groups[1]!.familyPrefix).toBe('B');
    expect(groups[1]!.sections).toHaveLength(1);
  });

  it('handles lab-only with numeric codes (PHYS 1AL pattern)', () => {
    const sections = [
      makeSection({
        sectionCode: '001',
        meetingType: 'Laboratory',
        meetings: [
          {
            days: ['Tuesday'],
            start_time: '12:00',
            end_time: '14:50',
            raw_days: 'Tu',
          },
        ],
        enrolled: 20,
        capacity: 24,
      }),
      makeSection({
        sectionCode: '002',
        meetingType: 'Laboratory',
        meetings: [
          {
            days: ['Tuesday'],
            start_time: '14:00',
            end_time: '16:50',
            raw_days: 'Tu',
          },
        ],
        enrolled: 18,
        capacity: 24,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    // Numeric codes: each section is its own group
    expect(groups).toHaveLength(2);
    expect(groups[0]!.sections).toHaveLength(1);
    expect(groups[1]!.sections).toHaveLength(1);
  });

  it('handles lecture-only (PHYS 1A pattern)', () => {
    const sections = [
      makeSection({
        sectionCode: 'A00',
        meetingType: 'Lecture',
        meetings: [
          {
            days: ['Monday', 'Wednesday', 'Friday'],
            start_time: '10:00',
            end_time: '10:50',
            raw_days: 'MWF',
          },
        ],
        enrolled: 307,
        capacity: 410,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.familyPrefix).toBe('A');
    expect(groups[0]!.sections).toHaveLength(1);
  });

  it('handles independent study', () => {
    const sections = [
      makeSection({
        sectionCode: 'A01',
        meetingType: 'Independent Study',
        meetings: [
          {
            days: [],
            start_time: null,
            end_time: null,
            is_tba: true,
            raw_days: 'TBA',
          },
        ],
        enrolled: 97,
        capacity: 145,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sections).toHaveLength(1);
    expect(groups[0]!.sharedMeetings).toHaveLength(0);
  });

  it('handles shared LE+DI with selectable LA', () => {
    const sections = [
      makeSection({
        sectionCode: 'A50',
        meetingType: 'Laboratory',
        meetings: [
          {
            days: ['Monday', 'Wednesday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'MW',
          },
          {
            days: ['Friday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'F',
          },
          {
            days: ['Wednesday'],
            start_time: '14:00',
            end_time: '16:50',
            raw_days: 'W',
          },
        ],
        enrolled: 20,
        capacity: 30,
      }),
      makeSection({
        sectionCode: 'A51',
        meetingType: 'Laboratory',
        meetings: [
          {
            days: ['Monday', 'Wednesday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'MW',
          },
          {
            days: ['Friday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'F',
          },
          {
            days: ['Thursday'],
            start_time: '14:00',
            end_time: '16:50',
            raw_days: 'Th',
          },
        ],
        enrolled: 22,
        capacity: 30,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sharedMeetings).toHaveLength(2);
    expect(groups[0]!.totalEnrolled).toBe(42);
    expect(groups[0]!.totalCapacity).toBe(60);
  });

  it('aggregates seats across sections', () => {
    const sections = [
      makeSection({
        sectionCode: 'A01',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday'],
            start_time: '09:00',
            end_time: '09:50',
            raw_days: 'M',
          },
        ],
        enrolled: null,
        capacity: null,
      }),
      makeSection({
        sectionCode: 'A02',
        meetingType: 'Discussion',
        meetings: [
          {
            days: ['Monday'],
            start_time: '10:00',
            end_time: '10:50',
            raw_days: 'M',
          },
        ],
        enrolled: 20,
        capacity: 30,
      }),
    ];
    const groups = buildOfferingGroups(sections);
    expect(groups[0]!.totalEnrolled).toBe(20);
    expect(groups[0]!.totalCapacity).toBe(30);
  });
});
