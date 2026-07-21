export type DayFlags = {
  M: boolean;
  Tu: boolean;
  W: boolean;
  Th: boolean;
  F: boolean;
  Sa: boolean;
  Su: boolean;
};

export function parseDays(raw: string): DayFlags {
  const flags: DayFlags = {
    M: false,
    Tu: false,
    W: false,
    Th: false,
    F: false,
    Sa: false,
    Su: false,
  };
  if (!raw || raw === 'TBA') return flags;

  let i = 0;
  while (i < raw.length) {
    if (raw[i] === 'M') {
      flags.M = true;
      i += 1;
    } else if (raw[i] === 'T' && raw[i + 1] === 'h') {
      flags.Th = true;
      i += 2;
    } else if (raw[i] === 'T' && raw[i + 1] === 'u') {
      flags.Tu = true;
      i += 2;
    } else if (raw[i] === 'T') {
      flags.Tu = true;
      i += 1;
    } else if (raw[i] === 'W') {
      flags.W = true;
      i += 1;
    } else if (raw[i] === 'F') {
      flags.F = true;
      i += 1;
    } else if (raw[i] === 'S' && raw[i + 1] === 'u') {
      flags.Su = true;
      i += 2;
    } else if (raw[i] === 'S' && raw[i + 1] === 'a') {
      flags.Sa = true;
      i += 2;
    } else if (raw[i] === 'S') {
      flags.Sa = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return flags;
}

function to12Hour(time24: string) {
  const [hStr, mStr] = time24.split(':');
  let h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { display: `${h}:${mStr ?? '00'}`, period };
}

export function formatTime(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return 'TBA';
  const s = to12Hour(start);
  const e = to12Hour(end);
  if (s.period === e.period) return `${s.display} – ${e.display} ${e.period}`;
  return `${s.display} ${s.period} – ${e.display} ${e.period}`;
}

export type SeatsStatus = 'critical' | 'low' | 'medium' | 'high' | 'available';

export function seatsColor(
  enrolled: number | null,
  capacity: number | null,
  availableSeats?: number | null,
): SeatsStatus {
  if (capacity === null || capacity === 0) return 'available';
  const available =
    availableSeats ??
    (enrolled === null ? null : Math.max(capacity - enrolled, 0));
  if (available === null) return 'available';
  const availablePct = (available / capacity) * 100;
  if (availablePct < 25) return 'critical';
  if (availablePct < 50) return 'low';
  if (availablePct < 75) return 'medium';
  if (availablePct < 90) return 'high';
  return 'available';
}

type SectionInput = {
  section_id: string;
  course_id: string;
  section_code: string | null;
  meeting_type: string | null;
  instructors: string[];
  meetings: {
    days: string[];
    date?: string | null;
    start_time: string | null;
    end_time: string | null;
    building: string | null;
    room: string | null;
    is_tba: boolean;
    meeting_type?: string | null;
    raw_days: string | null;
    raw_time?: string | null;
    raw_location?: string | null;
  }[];
  enrolled: number | null;
  capacity: number | null;
  available_seats: number | null;
  capacity_kind: 'bounded' | 'effectively_unbounded' | null;
  waitlist_count: number | null;
};

export type OfferingGroup = {
  familyPrefix: string;
  sections: SectionInput[];
  sharedMeetings: SectionInput['meetings'];
  totalEnrolled: number;
  totalCapacity: number;
  totalAvailableSeats: number | null;
  capacityKind: 'bounded' | 'effectively_unbounded' | null;
};

function getFamilyPrefix(code: string | null): string {
  if (!code) return '';
  const [first] = code;
  if (first && /[A-Za-z]/u.test(first)) return first.toUpperCase();
  return code;
}

function meetingKey(m: SectionInput['meetings'][number]): string {
  return [
    m.meeting_type ?? '',
    m.date ?? '',
    m.raw_days ?? m.days.join(','),
    m.start_time ?? '',
    m.end_time ?? '',
    m.raw_location ?? '',
    m.building ?? '',
    m.room ?? '',
  ].join('|');
}

function findSharedMeetings(
  sections: SectionInput[],
): SectionInput['meetings'] {
  if (sections.length <= 1) return [];
  const first = sections[0]!;
  const shared: SectionInput['meetings'] = [];
  for (const meeting of first.meetings) {
    const key = meetingKey(meeting);
    const isShared = sections
      .slice(1)
      .every((s) => s.meetings.some((m) => meetingKey(m) === key));
    if (isShared) shared.push(meeting);
  }
  return shared;
}

export function buildOfferingGroups(sections: SectionInput[]): OfferingGroup[] {
  const familyMap = new Map<string, SectionInput[]>();
  for (const section of sections) {
    const prefix = getFamilyPrefix(section.section_code);
    const list = familyMap.get(prefix);
    if (list) list.push(section);
    else familyMap.set(prefix, [section]);
  }

  const groups: OfferingGroup[] = [];
  for (const [prefix, familySections] of familyMap) {
    const shared = findSharedMeetings(familySections);
    const unboundedCount = familySections.filter(
      (section) => section.capacity_kind === 'effectively_unbounded',
    ).length;
    const allUnbounded = unboundedCount === familySections.length;
    const mixedCapacityKinds = unboundedCount > 0 && !allUnbounded;
    const includeNumericTotals = unboundedCount === 0;
    let totalEnrolled = 0;
    let totalCapacity = 0;
    let totalAvailableSeats = 0;
    let hasCompleteAvailableSeats = true;
    for (const s of familySections) {
      if (includeNumericTotals && s.enrolled !== null)
        totalEnrolled += s.enrolled;
      if (includeNumericTotals && s.capacity !== null)
        totalCapacity += s.capacity;
      if (!includeNumericTotals || s.available_seats === null)
        hasCompleteAvailableSeats = false;
      else totalAvailableSeats += s.available_seats;
    }
    groups.push({
      familyPrefix: prefix,
      sections: familySections,
      sharedMeetings: shared,
      totalEnrolled,
      totalCapacity,
      totalAvailableSeats:
        familySections.length === 1 && hasCompleteAvailableSeats
          ? totalAvailableSeats
          : null,
      capacityKind: allUnbounded
        ? 'effectively_unbounded'
        : mixedCapacityKinds
          ? null
          : 'bounded',
    });
  }

  groups.sort((a, b) => a.familyPrefix.localeCompare(b.familyPrefix));
  return groups;
}
