export type TssSourceMeeting = {
  meeting_kind: string;
  specific_date: string | null;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  location_displayed: string | null;
  instructor: string | null;
  is_tba: boolean;
  is_arranged: boolean | null;
};

const tssDayOrder = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];

function dayTokens(value: string | null): string[] {
  return (value ?? '')
    .trim()
    .split(/\s+/u)
    .filter((day) => tssDayOrder.includes(day));
}

function meetingScheduleKey(meeting: TssSourceMeeting): string {
  return JSON.stringify({
    kind: meeting.meeting_kind,
    date: meeting.specific_date,
    startTime: meeting.start_time,
    endTime: meeting.end_time,
    location: meeting.location_displayed,
    isTba: meeting.is_tba,
    isArranged: meeting.is_arranged,
  });
}

function combineTssMeetingDays(
  meetings: TssSourceMeeting[],
): TssSourceMeeting[] {
  const combined = new Map<string, TssSourceMeeting>();
  for (const meeting of meetings) {
    const key = meetingScheduleKey(meeting);
    const existing = combined.get(key);
    if (!existing) {
      combined.set(key, { ...meeting });
      continue;
    }

    const days = new Set([
      ...dayTokens(existing.days),
      ...dayTokens(meeting.days),
    ]);
    existing.days =
      tssDayOrder.filter((day) => days.has(day)).join(' ') || null;
  }
  return [...combined.values()];
}

export function normalizeTssMeetingDays(
  term: string,
  meetings: TssSourceMeeting[],
): TssSourceMeeting[] {
  return term === 'FA26' ? combineTssMeetingDays(meetings) : meetings;
}
