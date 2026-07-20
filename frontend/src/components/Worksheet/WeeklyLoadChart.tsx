import { useMemo, useState } from 'react';

import { buildWeeklyLoad, formatHours } from './worksheetInsights';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import styles from './WeeklyLoadChart.module.css';

const fullDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function WeeklyLoadChart({
  courses,
  busiestLabel,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly busiestLabel: string | null;
}) {
  const [hoveredCrn, setHoveredCrn] = useState<Crn | null>(null);
  const load = useMemo(() => buildWeeklyLoad(courses), [courses]);
  const maxDayMinutes = Math.max(1, ...load.days.map((day) => day.minutes));
  const hoveredColor = hoveredCrn
    ? (load.legend.find((item) => item.crn === hoveredCrn)?.color ?? null)
    : null;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>Weekly load</span>
        <span className={styles.chartTotal}>
          {formatHours(load.totalMinutes)}/wk
        </span>
      </div>
      <div className={styles.chartBars}>
        {load.days.map((day, index) => {
          const isBusiest =
            busiestLabel === fullDayLabels[index] && day.minutes > 0;
          const barPct =
            day.minutes > 0
              ? Math.max(4, (day.minutes / maxDayMinutes) * 100)
              : 2;
          let hoursLabel = day.minutes > 0 ? formatHours(day.minutes) : '–';
          let labelColor = 'var(--ct-text-muted)';
          if (hoveredCrn) {
            const courseMinutes = day.segments
              .filter((segment) => segment.crn === hoveredCrn)
              .reduce((sum, segment) => sum + segment.minutes, 0);
            if (courseMinutes > 0) {
              hoursLabel = formatHours(courseMinutes);
              labelColor = hoveredColor ?? 'var(--ct-ink)';
            } else {
              hoursLabel = '–';
              labelColor = 'var(--ct-text-faint)';
            }
          }
          return (
            <div key={day.label} className={styles.chartColumn}>
              <div className={styles.chartBarArea}>
                <span
                  className={styles.chartHours}
                  style={{
                    color: labelColor,
                    bottom: `calc(${barPct}% + 6px)`,
                  }}
                >
                  {hoursLabel}
                </span>
                <div
                  className={styles.chartBar}
                  style={{ height: `${barPct}%` }}
                >
                  {day.segments.map((segment, segmentIndex) => (
                    <div
                      key={segmentIndex}
                      className={styles.chartSegment}
                      style={{
                        flexGrow: segment.minutes,
                        background: segment.color,
                        opacity:
                          hoveredCrn && hoveredCrn !== segment.crn ? 0.22 : 1,
                      }}
                      onMouseEnter={() => setHoveredCrn(segment.crn)}
                      onMouseLeave={() => setHoveredCrn(null)}
                      onFocus={() => setHoveredCrn(segment.crn)}
                      onBlur={() => setHoveredCrn(null)}
                    />
                  ))}
                </div>
              </div>
              <span
                className={styles.chartDayLabel}
                style={
                  isBusiest
                    ? { color: 'var(--ct-ink)', fontWeight: 700 }
                    : undefined
                }
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      {load.legend.length > 0 && (
        <div className={styles.chartLegend}>
          {load.legend.map((item) => (
            <span
              key={item.crn}
              className={styles.legendItem}
              style={{
                opacity: hoveredCrn && hoveredCrn !== item.crn ? 0.4 : 1,
              }}
              onMouseEnter={() => setHoveredCrn(item.crn)}
              onMouseLeave={() => setHoveredCrn(null)}
              onFocus={() => setHoveredCrn(item.crn)}
              onBlur={() => setHoveredCrn(null)}
            >
              <span
                className={styles.legendSwatch}
                style={{ background: item.color }}
                aria-hidden="true"
              />
              <span className={styles.legendCode}>{item.code}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
