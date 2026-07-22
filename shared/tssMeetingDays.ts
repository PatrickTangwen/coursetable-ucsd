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
  const { days: _days, instructor: _instructor, ...schedule } = meeting;
  return JSON.stringify(schedule);
}

function combineTssMeetingDays<T extends TssSourceMeeting>(meetings: T[]): T[] {
  const combined = new Map<string, T>();
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

export function normalizeTssMeetingDays<T extends TssSourceMeeting>(
  term: string,
  meetings: T[],
): T[] {
  return term === 'FA26' ? combineTssMeetingDays(meetings) : meetings;
}
