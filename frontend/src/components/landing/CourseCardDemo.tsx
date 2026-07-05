import { useState } from 'react';
import clsx from 'clsx';
import DayChips from './DayChips';
import { ChevronDownIcon, PlusIcon } from './icons';
import styles from './CourseCardDemo.module.css';

const GRADE_ROWS = [
  {
    term: 'SP25',
    instr: 'Braswell, Geoffrey E.',
    gpa: '3.42',
    a: '48.2',
    b: '30.1',
    c: '14.5',
    d: '3.8',
    f: '1.2',
    w: '2.2',
  },
  {
    term: 'S125',
    instr: 'Braswell, Geoffrey E.',
    gpa: '3.40',
    a: '47.1',
    b: '30.8',
    c: '15.0',
    d: '3.5',
    f: '1.4',
    w: '2.2',
  },
  {
    term: 'FA24',
    instr: 'Braswell, Geoffrey E.',
    gpa: '3.38',
    a: '45.6',
    b: '31.8',
    c: '15.2',
    d: '4.0',
    f: '1.5',
    w: '1.9',
  },
  {
    term: 'S224',
    instr: 'Anderson, Sarah K.',
    gpa: '3.62',
    a: '55.4',
    b: '26.0',
    c: '12.1',
    d: '2.9',
    f: '0.7',
    w: '2.9',
  },
  {
    term: 'SP24',
    instr: 'Anderson, Sarah K.',
    gpa: '3.55',
    a: '52.3',
    b: '28.4',
    c: '12.8',
    d: '3.1',
    f: '0.8',
    w: '2.6',
  },
  {
    term: 'S323',
    instr: 'Braswell, Geoffrey E.',
    gpa: '3.29',
    a: '41.0',
    b: '33.8',
    c: '16.6',
    d: '4.6',
    f: '2.1',
    w: '1.9',
  },
];

const DISCUSSIONS = [
  {
    sec: 'A01',
    days: ['M', 'W'],
    time: '11:00–11:50a',
    seats: '6 seats left',
    seatTone: styles.seatsOk,
    selected: true,
  },
  {
    sec: 'A02',
    days: ['M', 'W'],
    time: '12:00–12:50p',
    seats: '3 seats left',
    seatTone: styles.seatsLow,
  },
  {
    sec: 'A03',
    days: ['Tu', 'Th'],
    time: '11:00–11:50a',
    seats: 'FULL · WL(3)',
    seatTone: styles.seatsFull,
  },
];

function TypeBadge({
  tone,
  short,
  label,
}: {
  readonly tone: string | undefined;
  readonly short: string;
  readonly label: string;
}) {
  return (
    <div className={styles.typeCell}>
      <span className={clsx(styles.typeBadge, tone)}>{short}</span>
      <span className={styles.typeLabel}>{label}</span>
    </div>
  );
}

function OverviewPanel() {
  return (
    <div className={styles.panel}>
      <p className={styles.desc}>
        A survey of ancient Egyptian civilization from the Predynastic Period
        through the Roman conquest. Topics include pharaonic history, religious
        beliefs, mummification, pyramid construction, and hieroglyphic writing.
      </p>
      <div className={styles.chipRow}>
        <span className={clsx(styles.chip, styles.chipGreen)}>4 Units</span>
        <span className={clsx(styles.chip, styles.chipRed)}>
          Upper Division
        </span>
        <span className={clsx(styles.chip, styles.chipRed)}>Restrictions</span>
        <span className={clsx(styles.chip, styles.chipPurple)}>
          Prerequisites
          <ChevronDownIcon size={10} color="currentColor" strokeWidth={1.6} />
        </span>
        <span className={clsx(styles.chip, styles.chipBlue)}>
          Catalog
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 7L7 3M7 3H4.5M7 3V5.5" />
          </svg>
        </span>
      </div>
      <div className={styles.scheduleHead}>
        <span className={styles.scheduleTitle}>Schedule Options</span>
        <span className={styles.scheduleCount}>2 offering groups</span>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionName}>Section A</div>
            <div className={styles.sectionTime}>8:00 – 10:50 AM</div>
          </div>
          <div className={styles.sectionInstr}>Braswell, Geoffrey E.</div>
        </div>
        <div className={styles.meetingRow}>
          <div />
          <TypeBadge tone={styles.badgeLe} short="LE" label="Lecture" />
          <span className={styles.meetingSec}>A00</span>
          <DayChips size="md" on={['M', 'W', 'F']} />
          <div className={styles.meetingRight}>
            <div className={styles.meetingTime}>8:00–10:50a</div>
            <div className={styles.meetingLoc}>RCLAS R01</div>
          </div>
        </div>
        <div className={styles.meetingRow}>
          <div />
          <TypeBadge tone={styles.badgeFi} short="FI" label="Final" />
          <span className={styles.meetingSec}>A00</span>
          <DayChips size="md" days={['Tu', 'Sa']} on={['Sa']} />
          <div className={styles.meetingRight}>
            <div className={styles.meetingTime}>8:00–11:00a</div>
            <div className={styles.meetingLoc}>Aug 8, 2026</div>
          </div>
        </div>
        <div className={styles.chooseLabel}>CHOOSE DISCUSSION</div>
        {DISCUSSIONS.map((disc) => (
          <div
            key={disc.sec}
            className={clsx(
              styles.meetingRow,
              styles.discRow,
              disc.selected && styles.discSelected,
            )}
          >
            <span
              className={clsx(
                styles.radio,
                disc.selected && styles.radioSelected,
              )}
            >
              {disc.selected && <span className={styles.radioDot} />}
            </span>
            <TypeBadge tone={styles.badgeDi} short="DI" label="Disc" />
            <span className={styles.meetingSec}>{disc.sec}</span>
            <DayChips size="md" on={disc.days} />
            <div className={styles.meetingRight}>
              <div className={styles.meetingTime}>{disc.time}</div>
              <div className={clsx(styles.seats, disc.seatTone)}>
                {disc.seats}
              </div>
            </div>
          </div>
        ))}
        <div className={styles.addRow}>
          <div className={styles.addBtn}>
            <PlusIcon size={14} color="currentColor" />
            Add A01 to Worksheet
          </div>
        </div>
      </div>

      <div className={styles.sectionCollapsed}>
        <div>
          <div className={styles.sectionName}>Section B</div>
          <div className={styles.sectionTime}>TuTh · 2:00 – 4:50 PM</div>
        </div>
        <div className={styles.collapsedRight}>
          <span className={styles.sectionInstr}>Anderson, Sarah K.</span>
          <ChevronDownIcon size={12} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function GradesPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.gradesCard}>
        <div className={styles.gradesHead}>
          <div>
            <div className={styles.gradesTitle}>Grade Distribution</div>
            <div className={styles.gradesSub}>6 terms on record</div>
          </div>
          <span className={styles.gradesNote}>% of enrolled by grade</span>
        </div>
        <div className={styles.gradeTableHead}>
          <span>TERM</span>
          <span>INSTRUCTOR</span>
          <span className={styles.centered}>GPA</span>
          <span className={styles.centered}>A</span>
          <span className={styles.centered}>B</span>
          <span className={styles.centered}>C</span>
          <span className={styles.centered}>D</span>
          <span className={styles.centered}>F</span>
          <span className={styles.centered}>W</span>
          <span className={styles.centered}>P</span>
          <span className={styles.centered}>NP</span>
        </div>
        {GRADE_ROWS.map((row) => (
          <div key={row.term} className={styles.gradeRow}>
            <span className={styles.termChip}>{row.term}</span>
            <span className={styles.gradeInstr}>{row.instr}</span>
            <span className={styles.gpaChip}>{row.gpa}</span>
            <span className={clsx(styles.centered, styles.gradeA)}>
              {row.a}
            </span>
            <span className={clsx(styles.centered, styles.gradeMid)}>
              {row.b}
            </span>
            <span className={clsx(styles.centered, styles.gradeMid)}>
              {row.c}
            </span>
            <span className={clsx(styles.centered, styles.gradeSoft)}>
              {row.d}
            </span>
            <span className={clsx(styles.centered, styles.gradeSoft)}>
              {row.f}
            </span>
            <span className={clsx(styles.centered, styles.gradeSoft)}>
              {row.w}
            </span>
            <span className={clsx(styles.centered, styles.gradeNone)}>—</span>
            <span className={clsx(styles.centered, styles.gradeNone)}>—</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The course-detail modal "screenshot" with a working Overview / Past Grades
// drawer, matching the real course modal's layout.
export default function CourseCardDemo() {
  const [tab, setTab] = useState<'overview' | 'grades'>('overview');
  const onOverview = tab === 'overview';
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <div className={styles.courseTitle}>
              Pharaohs, Mummies, and Pyramids: Introduction to Egyptology
            </div>
            <div className={styles.courseMeta}>
              <span className={styles.courseCode}>ANAR 144</span>
              <span className={styles.metaDot} />
              <span>Summer Session 1 2026</span>
            </div>
          </div>
          <div className={styles.closeBtn}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </div>
        </div>
        <div className={styles.tabRow}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={clsx(styles.tab, onOverview && styles.tabActive)}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={clsx(styles.tab, !onOverview && styles.tabActive)}
              onClick={() => setTab('grades')}
            >
              Past Grades
            </button>
          </div>
          <div className={styles.controls}>
            <div className={styles.sectionSelect}>
              Section A
              <ChevronDownIcon
                size={10}
                color="currentColor"
                strokeWidth={1.6}
              />
            </div>
            <div className={styles.iconBtn}>
              <PlusIcon size={16} color="currentColor" />
            </div>
            <div className={styles.iconBtn}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 3v10" />
                <path d="M6 7l4-4 4 4" />
                <path d="M4 13v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
              </svg>
            </div>
            <div className={styles.iconBtn}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <circle cx="4" cy="10" r="1.6" />
                <circle cx="10" cy="10" r="1.6" />
                <circle cx="16" cy="10" r="1.6" />
              </svg>
            </div>
          </div>
        </div>
        <div className={styles.headDivider} />
      </div>
      <div className={styles.drawer}>
        <div
          className={styles.drawerTrack}
          style={{
            transform: onOverview ? 'translateX(0)' : 'translateX(-50%)',
          }}
        >
          <OverviewPanel />
          <GradesPanel />
        </div>
      </div>
    </div>
  );
}
