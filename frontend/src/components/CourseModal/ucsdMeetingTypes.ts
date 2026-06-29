const UCSD_MEETING_TYPES = {
  AC: 'Activity',
  CL: 'Clinical Clerkship',
  CO: 'Conference',
  DI: 'Discussion',
  FI: 'Final Exam',
  FM: 'Film',
  FW: 'Fieldwork',
  IN: 'Independent Study',
  IT: 'Internship',
  LA: 'Laboratory',
  LE: 'Lecture',
  MI: 'Midterm',
  MU: 'Make-up Session',
  OT: 'Other Additional Meeting',
  PB: 'Problem Session',
  PR: 'Practicum',
  RE: 'Review Session',
  SE: 'Seminar',
  ST: 'Studio',
  TU: 'Tutorial',
} as const;

type UcsdMeetingTypeCode = keyof typeof UCSD_MEETING_TYPES;

const DESCRIPTION_TO_CODE = new Map(
  Object.entries(UCSD_MEETING_TYPES).map(([code, label]) => [
    label.toLowerCase(),
    code as UcsdMeetingTypeCode,
  ]),
);

const ALIASES = new Map<string, UcsdMeetingTypeCode>([
  ['lab', 'LA'],
  ['final', 'FI'],
  ['makeup session', 'MU'],
  ['other meeting', 'OT'],
  ['review', 'RE'],
]);

export function ucsdMeetingTypeCode(
  meetingType: string | null | undefined,
): string {
  const trimmed = meetingType?.trim();
  if (!trimmed) return 'OT';

  const upper = trimmed.toUpperCase();
  if (Object.hasOwn(UCSD_MEETING_TYPES, upper))
    return upper as UcsdMeetingTypeCode;

  const normalized = trimmed.toLowerCase();
  return (
    DESCRIPTION_TO_CODE.get(normalized) ??
    ALIASES.get(normalized) ??
    trimmed.slice(0, 2).toUpperCase()
  );
}

export function ucsdMeetingTypeLabel(
  meetingType: string | null | undefined,
): string {
  const code = ucsdMeetingTypeCode(meetingType);
  if (Object.hasOwn(UCSD_MEETING_TYPES, code))
    return UCSD_MEETING_TYPES[code as UcsdMeetingTypeCode];
  return code;
}

export function isUcsdInfoMeeting(
  meetingType: string | null | undefined,
): boolean {
  const code = ucsdMeetingTypeCode(meetingType);
  return code === 'FI' || code === 'MI' || code === 'RE';
}
