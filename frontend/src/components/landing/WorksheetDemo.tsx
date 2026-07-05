import { CalendarIcon, ChevronDownIcon, EyeIcon, WarnIcon } from './icons';
import styles from './WorksheetDemo.module.css';

// Color palettes matching the worksheet calendar's per-course tints.
const PAL = {
  purple: {
    bg: '#EDECFB',
    border: '#DAD6F0',
    strong: '#3A3486',
    sec: '#7C77B4',
    mid: '#6B66A8',
    soft: '#8A85B8',
  },
  amber: {
    bg: '#FBF1DC',
    border: '#ECDDB4',
    strong: '#6B4A16',
    sec: '#A78645',
    mid: '#977536',
    soft: '#A78645',
  },
  green: {
    bg: '#E4F5EF',
    border: '#C2E7DA',
    strong: '#0B5A47',
    sec: '#3E8873',
    mid: '#3E8873',
    soft: '#5A9C87',
  },
  olive: {
    bg: '#EEF5DE',
    border: '#DAE6BC',
    strong: '#4B6320',
    sec: '#7E9A4D',
    mid: '#6E8A3E',
    soft: '#7E9A4D',
  },
  red: {
    bg: '#FCEBEB',
    border: '#F2CCCC',
    strong: '#A32D2D',
    sec: '#C57575',
    mid: '#B85555',
    soft: '#C57575',
  },
} as const;

type DemoEvent = {
  top: number;
  height: number;
  pal: keyof typeof PAL;
  code: string;
  sec?: string;
  kind?: string;
  time?: string;
  loc?: string;
  // 'disc' is the two-line compact block; 'kind' shows only the kind label.
  variant?: 'disc' | 'kind';
  left?: number;
  right?: number;
  shadow?: boolean;
};

const EVENTS: readonly (readonly DemoEvent[])[] = [
  // Monday
  [
    {
      top: 1,
      height: 52,
      pal: 'purple',
      code: 'ECON 120A',
      sec: 'A01',
      kind: 'Lecture',
      time: '8–9:20',
      loc: 'COA 130',
    },
    {
      top: 67,
      height: 46,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Lab',
      time: '9:50–10:50',
      loc: 'WLH 2207',
    },
    {
      top: 161,
      height: 52,
      pal: 'green',
      code: 'DSC 20R',
      sec: 'A01',
      kind: 'Discussion',
      time: '12–1:20',
      loc: 'RCLAS R115',
    },
    {
      top: 241,
      height: 52,
      pal: 'olive',
      code: 'MATH 20C',
      sec: 'B01',
      kind: 'Lecture',
      time: '2–3:20',
      loc: 'PCYNH 109',
    },
    {
      top: 361,
      height: 52,
      pal: 'green',
      code: 'DSC 20R',
      sec: 'A01',
      kind: 'Lecture',
      time: '5–6:20',
      loc: 'RCLAS R05',
    },
  ],
  // Tuesday
  [
    {
      top: 61,
      height: 52,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Lecture',
      time: '9:30–10:50',
      loc: 'WLH 2207',
    },
    {
      top: 121,
      height: 32,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Discussion',
      time: '11–11:50',
      variant: 'disc',
    },
    {
      top: 301,
      height: 52,
      pal: 'red',
      code: 'COGS 108',
      sec: 'A01',
      kind: 'Lecture',
      time: '3:30–4:50',
      loc: 'CENTR 115',
    },
  ],
  // Wednesday
  [
    {
      top: 1,
      height: 52,
      pal: 'purple',
      code: 'ECON 120A',
      sec: 'A01',
      kind: 'Lecture',
      time: '8–9:20',
      loc: 'COA 130',
    },
    {
      top: 67,
      height: 46,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Lab',
      time: '9:50–10:50',
      loc: 'WLH 2207',
    },
    {
      top: 241,
      height: 52,
      pal: 'olive',
      code: 'MATH 20C',
      sec: 'B01',
      kind: 'Lecture',
      time: '2–3:20',
      loc: 'PCYNH 109',
    },
    {
      top: 361,
      height: 52,
      pal: 'green',
      code: 'DSC 20R',
      sec: 'A01',
      kind: 'Lecture',
      time: '5–6:20',
      loc: 'RCLAS R05',
    },
  ],
  // Thursday — MATH discussion and COGS lecture overlap on purpose
  [
    {
      top: 61,
      height: 52,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Lecture',
      time: '9:30–10:50',
      loc: 'WLH 2207',
    },
    {
      top: 121,
      height: 32,
      pal: 'amber',
      code: 'ECE 15',
      sec: 'A01',
      kind: 'Discussion',
      time: '11–11:50',
      variant: 'disc',
    },
    {
      top: 281,
      height: 40,
      pal: 'olive',
      code: 'MATH 20C',
      kind: 'Discussion',
      variant: 'kind',
      right: 22,
    },
    {
      top: 301,
      height: 52,
      pal: 'red',
      code: 'COGS 108',
      kind: 'Lecture',
      time: '3:30–4:50',
      loc: 'CENTR 115',
      left: 20,
      shadow: true,
    },
  ],
  // Friday
  [
    {
      top: 161,
      height: 72,
      pal: 'red',
      code: 'COGS 108',
      sec: 'A01',
      kind: 'Lab',
      time: '12–1:50',
      loc: 'CSB 002',
    },
    {
      top: 241,
      height: 52,
      pal: 'olive',
      code: 'MATH 20C',
      sec: 'B01',
      kind: 'Lecture',
      time: '2–3:20',
      loc: 'PCYNH 109',
    },
  ],
];

const HOURS = [
  { top: 1, label: '8', suffix: 'AM' },
  { top: 36, label: '9', suffix: 'AM' },
  { top: 76, label: '10', suffix: 'AM' },
  { top: 116, label: '11', suffix: 'AM' },
  { top: 156, label: '12', suffix: 'PM' },
  { top: 196, label: '1', suffix: 'PM' },
  { top: 236, label: '2', suffix: 'PM' },
  { top: 276, label: '3', suffix: 'PM' },
  { top: 316, label: '4', suffix: 'PM' },
  { top: 356, label: '5', suffix: 'PM' },
  { top: 396, label: '6', suffix: 'PM' },
  { top: 432, label: '7', suffix: 'PM' },
];

const COURSES = [
  {
    color: '#3B82F6',
    code: 'DSC 197',
    sec: '001',
    title: 'Data Science Internship',
  },
  {
    color: '#17A277',
    code: 'DSC 20R',
    sec: 'A01',
    title: 'Programming and Basic Dat…',
  },
  {
    color: '#D3871B',
    code: 'ECE 15',
    sec: 'A01',
    title: 'Engineering Computation: In…',
  },
  { color: '#8983E0', code: 'ECON 120A', sec: 'A01', title: 'Econometrics A' },
  {
    color: '#5E8A2B',
    code: 'MATH 20C',
    sec: 'B01',
    title: 'Calculus and Analytic Geom…',
    warn: true,
  },
  {
    color: '#E0524D',
    code: 'COGS 108',
    sec: 'A01',
    title: 'Data Science in Practice',
    warn: true,
  },
];

function EventBlock({ event }: { readonly event: DemoEvent }) {
  const pal = PAL[event.pal];
  return (
    <div
      className={styles.event}
      style={{
        top: event.top,
        height: event.height,
        left: event.left ?? 3,
        right: event.right ?? 3,
        background: pal.bg,
        borderColor: pal.border,
        boxShadow: event.shadow ? '0 3px 10px rgb(163 45 45 / 16%)' : undefined,
        padding: event.variant === 'disc' ? '3px 6px' : undefined,
      }}
    >
      <div className={styles.evCode} style={{ color: pal.strong }}>
        {event.code}{' '}
        {event.sec && (
          <span className={styles.evSec} style={{ color: pal.sec }}>
            {event.sec}
          </span>
        )}
      </div>
      {event.variant === 'disc' ? (
        <div className={styles.evMeta} style={{ color: pal.mid }}>
          {event.kind} ·<br />
          {event.time}
        </div>
      ) : event.variant === 'kind' ? (
        <div className={styles.evMeta} style={{ color: pal.mid }}>
          {event.kind}
        </div>
      ) : (
        <>
          <div className={styles.evKind} style={{ color: pal.mid }}>
            {event.kind}
          </div>
          <div className={styles.evMeta} style={{ color: pal.soft }}>
            {event.time}
          </div>
          <div className={styles.evMeta} style={{ color: pal.soft }}>
            {event.loc}
          </div>
        </>
      )}
    </div>
  );
}

function StatTiles() {
  return (
    <>
      <div className={styles.tileGrid3}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Courses</div>
          <div className={styles.tileValue}>6</div>
          <div className={styles.tileSub}>planned</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Credits</div>
          <div className={styles.tileValue}>21</div>
          <div className={styles.tileSubRow}>
            <span className={styles.redDotSm} />
            <span className={styles.tileSub}>Heavy</span>
          </div>
        </div>
        <div className={styles.tileRelative}>
          <span className={styles.redDotCorner} />
          <div className={styles.tileLabel}>Conflicts</div>
          <div className={styles.tileValue}>2</div>
          <div className={styles.tileLink}>View ›</div>
        </div>
      </div>
      <div className={styles.tileGrid2}>
        <div className={styles.tile}>
          <div className={styles.tileIconRow}>
            <CalendarIcon size={9} />
            <span className={styles.tileIconLabel}>Exams</span>
          </div>
          <div className={styles.tileValueSm}>in 32d</div>
          <div className={styles.tileSub}>First · Aug 5 ›</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileIconRow}>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className={styles.tileIconLabel}>Busiest day</span>
          </div>
          <div className={styles.tileValueSm}>Mon</div>
          <div className={styles.tileSub}>5 classes</div>
        </div>
      </div>
    </>
  );
}

// A static "screenshot" of the worksheet page: weekly calendar plus sidebar.
export default function WorksheetDemo() {
  return (
    <div className={styles.frame}>
      <div className={styles.split}>
        <div className={styles.calendar}>
          <div className={styles.dayHead}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
              <div key={day} className={styles.dayHeadCell}>
                {day}
              </div>
            ))}
          </div>
          <div className={styles.gridBody}>
            <div className={styles.timeAxis}>
              {HOURS.map((hour) => (
                <div
                  key={`${hour.label}${hour.suffix}`}
                  className={styles.hourLabel}
                  style={{ top: hour.top }}
                >
                  {hour.label}
                  <span className={styles.hourSuffix}>{hour.suffix}</span>
                </div>
              ))}
            </div>
            {EVENTS.map((dayEvents, dayIndex) => (
              <div key={dayIndex} className={styles.dayCol}>
                {dayEvents.map((event) => (
                  <EventBlock
                    key={`${event.code}-${event.top}`}
                    event={event}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.sidebar}>
          <div className={styles.infoZone}>
            <div className={styles.wsHeader}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="#E0A020"
                stroke="#E0A020"
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span className={styles.wsTitle}>Main Worksheet</span>
              <ChevronDownIcon size={10} strokeWidth={2.4} />
            </div>
            <StatTiles />
            <div className={styles.actionRow}>
              <div className={styles.actionBtn}>
                <EyeIcon size={14} color="currentColor" />
              </div>
              <div className={styles.actionBtn}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <ChevronDownIcon
                  size={9}
                  color="currentColor"
                  strokeWidth={2.4}
                />
              </div>
              <div className={styles.actionBtn}>
                <CalendarIcon size={13} />
                <ChevronDownIcon
                  size={9}
                  color="currentColor"
                  strokeWidth={2.4}
                />
              </div>
            </div>
          </div>
          <div className={styles.courseList}>
            {COURSES.map((course) => (
              <div key={course.code} className={styles.courseRow}>
                <span
                  className={styles.courseBar}
                  style={{ background: course.color }}
                />
                <div className={styles.courseInfo}>
                  <div className={styles.courseCode}>
                    {course.code}{' '}
                    <span className={styles.courseSec}>{course.sec}</span>
                    {course.warn && <WarnIcon />}
                  </div>
                  <div className={styles.courseTitle}>{course.title}</div>
                </div>
                <EyeIcon />
                <ChevronDownIcon size={10} color="#C9C7C1" strokeWidth={2.4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
