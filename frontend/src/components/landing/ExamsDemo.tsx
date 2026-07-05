import { useState } from 'react';
import clsx from 'clsx';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from './icons';
import carousel from './carousel.module.css';
import styles from './ExamsDemo.module.css';

const EXAMS = [
  {
    dot: '#17A277',
    code: 'DSC 20R',
    sec: 'A01',
    title: 'Programming and Basic Data Structures for Data Science',
    date: 'July 15, 2026',
    meta: '11:00 AM–12:20 PM · CENTR 115',
  },
  {
    dot: '#D3871B',
    code: 'ECE 15',
    sec: 'A01',
    title: 'Engineering Computation: Introduction to Programming in C',
    date: 'July 17, 2026',
    meta: '9:30–10:50 AM · WLH 2207',
  },
  {
    dot: '#8983E0',
    code: 'ECON 120A',
    sec: 'A01',
    title: 'Econometrics A',
    date: 'July 20, 2026',
    meta: '8:00–9:20 AM · COA 130',
  },
];

const CONFLICTS = [
  {
    kind: 'FINAL EXAM',
    pill: '150 min overlap',
    a: { color: '#3B82F6', code: 'DSC 197', sec: '001' },
    b: { color: '#17A277', code: 'DSC 20R', sec: 'A01' },
    when: 'August 1, 2026',
    window: '11:30 AM – 2 PM',
  },
  {
    kind: 'TIME CONFLICT',
    pill: 'Same time slot',
    a: { color: '#D3871B', code: 'ECE 15', sec: 'A01' },
    b: { color: '#8983E0', code: 'ECON 120A', sec: 'A01' },
    when: 'Friday',
    window: '8 AM – 8:50 AM',
  },
  {
    kind: 'TIME CONFLICT',
    pill: '20 min overlap',
    a: { color: '#5E8A2B', code: 'MATH 20C', sec: 'B01' },
    b: { color: '#E0524D', code: 'COGS 108', sec: 'A01' },
    when: 'Wednesday',
    window: '2:00 PM – 2:20 PM',
  },
];

function CloseButton() {
  return (
    <div className={styles.closeBtn}>
      <XIcon />
    </div>
  );
}

function ExamsListSlide() {
  return (
    <div className={clsx(carousel.slide, styles.modal)}>
      <div className={styles.modalHead}>
        <div className={styles.modalTitleRow}>
          <span className={styles.modalTitle}>Exams</span>
          <CloseButton />
        </div>
        <div className={styles.modalSubRow}>
          <span className={styles.modalSub}>3 exams</span>
          <div className={styles.toggle}>
            <span className={clsx(styles.toggleOpt, styles.toggleActive)}>
              Date
            </span>
            <span className={styles.toggleOpt}>Course</span>
          </div>
        </div>
      </div>
      <div className={styles.examList}>
        {EXAMS.map((exam) => (
          <div key={exam.code} className={styles.examItem}>
            <div className={styles.examCodeRow}>
              <span
                className={styles.examDot}
                style={{ background: exam.dot }}
              />
              <span className={styles.examCode}>{exam.code}</span>
              <span className={styles.examSec}>{exam.sec}</span>
            </div>
            <div className={styles.examTitle}>{exam.title}</div>
            <div className={styles.examBadgeRow}>
              <span className={styles.miBadge}>MI</span>
              <span className={styles.miLabel}>Midterm</span>
            </div>
            <div className={styles.examDate}>{exam.date}</div>
            <div className={styles.examMeta}>{exam.meta}</div>
          </div>
        ))}
      </div>
      <div className={styles.modalFoot}>
        <div className={styles.gotIt}>Got it</div>
      </div>
    </div>
  );
}

function ConflictsSlide() {
  return (
    <div className={clsx(carousel.slide, styles.modal)}>
      <div className={styles.modalHead}>
        <div className={styles.modalTitleRow}>
          <span className={styles.modalTitle}>Schedule conflicts</span>
          <CloseButton />
        </div>
        <div className={styles.modalSub}>
          3 issues in this worksheet · 2 time · 1 final
        </div>
      </div>
      <div className={styles.conflictBody}>
        <div className={styles.conflictCard}>
          {CONFLICTS.map((conflict) => (
            <div
              key={`${conflict.a.code}-${conflict.b.code}`}
              className={styles.conflictRow}
            >
              <div className={styles.conflictKindRow}>
                <span className={styles.conflictKind}>{conflict.kind}</span>
                <span className={styles.conflictSpacer} />
                <span className={styles.conflictPill}>{conflict.pill}</span>
              </div>
              <div className={styles.conflictCourses}>
                <span
                  className={styles.courseSquare}
                  style={{ background: conflict.a.color }}
                />
                <b className={styles.conflictCode}>{conflict.a.code}</b>
                <span className={styles.conflictSec}>{conflict.a.sec}</span>
                <span className={styles.conflictVs}>vs</span>
                <span
                  className={styles.courseSquare}
                  style={{ background: conflict.b.color }}
                />
                <b className={styles.conflictCode}>{conflict.b.code}</b>
                <span className={styles.conflictSec}>{conflict.b.sec}</span>
              </div>
              <div className={styles.conflictMeta}>
                {conflict.when} · overlap{' '}
                <b className={styles.conflictWindow}>{conflict.window}</b>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.modalFoot}>
        <div className={styles.gotIt}>Got it</div>
      </div>
    </div>
  );
}

// Two-slide carousel of the exams-list and schedule-conflicts modals.
export default function ExamsDemo() {
  const [slide, setSlide] = useState(0);
  return (
    <div className={styles.vis}>
      <div className={styles.slideDots}>
        {[0, 1].map((index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show exams slide ${index + 1}`}
            className={clsx(styles.dot, slide === index && styles.dotActive)}
            onClick={() => setSlide(index)}
          />
        ))}
      </div>
      <div className={styles.viewport}>
        <div
          className={clsx(carousel.track, styles.trackTop)}
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          <ExamsListSlide />
          <ConflictsSlide />
        </div>
      </div>
      <button
        type="button"
        aria-label="Previous slide"
        className={clsx(carousel.arrow, carousel.prev)}
        onClick={() => setSlide((current) => (current + 1) % 2)}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className={clsx(carousel.arrow, carousel.next)}
        onClick={() => setSlide((current) => (current + 1) % 2)}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
