import { describe, expect, it } from 'vitest';

import {
  isUcsdInfoMeeting,
  ucsdMeetingTypeCode,
  ucsdMeetingTypeLabel,
} from './ucsdMeetingTypes';

describe('UCSD meeting type mapping', () => {
  it('maps official UCSD meeting type codes to labels', () => {
    expect(ucsdMeetingTypeLabel('AC')).toBe('Activity');
    expect(ucsdMeetingTypeLabel('FI')).toBe('Final Exam');
    expect(ucsdMeetingTypeLabel('MI')).toBe('Midterm');
    expect(ucsdMeetingTypeLabel('PB')).toBe('Problem Session');
    expect(ucsdMeetingTypeLabel('RE')).toBe('Review Session');
    expect(ucsdMeetingTypeLabel('TU')).toBe('Tutorial');
  });

  it('maps meeting type descriptions back to official codes', () => {
    expect(ucsdMeetingTypeCode('Lecture')).toBe('LE');
    expect(ucsdMeetingTypeCode('Laboratory')).toBe('LA');
    expect(ucsdMeetingTypeCode('Clinical Clerkship')).toBe('CL');
    expect(ucsdMeetingTypeCode('Other Additional Meeting')).toBe('OT');
    expect(ucsdMeetingTypeCode('Review Session')).toBe('RE');
  });

  it('marks final, midterm, and review meetings as informational rows', () => {
    expect(isUcsdInfoMeeting('FI')).toBe(true);
    expect(isUcsdInfoMeeting('Midterm')).toBe(true);
    expect(isUcsdInfoMeeting('Review Session')).toBe(true);
    expect(isUcsdInfoMeeting('Laboratory')).toBe(false);
  });
});
