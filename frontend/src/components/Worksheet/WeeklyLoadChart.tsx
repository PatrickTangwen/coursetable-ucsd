import { useEffect, useMemo, useRef, useState } from 'react';

import { buildWeeklyLoad, formatHours } from './worksheetInsights';
import {
  scrollToRequestedWeeklyLoad,
  WEEKLY_LOAD_TARGET_ID,
} from './worksheetNavigation';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import styles from './WeeklyLoadChart.module.css';

const CHART_MAX_PX = 40;
const fullDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function WeeklyLoadChart({
  courses,
  busiestLabel,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly busiestLabel: string | null;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredCrn, setHoveredCrn] = useState<Crn | null>(null);
  const load = useMemo(() => buildWeeklyLoad(courses), [courses]);
  const maxDayMinutes = Math.max(1, ...load.days.map((day) => day.minutes));
  const hoveredColor = hoveredCrn
    ? (load.legend.find((item) => item.crn === hoveredCrn)?.color ?? null)
    : null;

  useEffect(() => {
    if (chartRef.current) scrollToRequestedWeeklyLoad(chartRef.current);
  }, []);

  return (
    <div id={WEEKLY_LOAD_TARGET_ID} ref={chartRef} className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
          Weekly load
        </span>
        <span className={styles.chartTotal}>
          {formatHours(load.totalMinutes)}/wk
        </span>
      </div>
      <div className={styles.chartBars}>
        {load.days.map((day, index) => {
          const isBusiest =
            busiestLabel === fullDayLabels[index] && day.minutes > 0;
          const barPx =
            day.minutes > 0
              ? Math.max(
                  6,
                  Math.round((day.minutes / maxDayMinutes) * CHART_MAX_PX),
                )
              : 3;
          let hoursLabel = day.minutes > 0 ? formatHours(day.minutes) : '–';
          let labelColor =
            day.minutes > 0
              ? isBusiest
                ? 'var(--ct-ink)'
                : 'var(--ct-text-secondary)'
              : 'var(--ct-text-faint)';
          let labelWeight = isBusiest ? 700 : 500;
          if (hoveredCrn) {
            const courseMinutes = day.segments
              .filter((segment) => segment.crn === hoveredCrn)
              .reduce((sum, segment) => sum + segment.minutes, 0);
            if (courseMinutes > 0) {
              hoursLabel = formatHours(courseMinutes);
              labelColor = hoveredColor ?? 'var(--ct-ink)';
              labelWeight = 700;
            } else {
              hoursLabel = '–';
              labelColor = 'var(--ct-text-faint)';
              labelWeight = 500;
            }
          }
          return (
            <div key={day.label} className={styles.chartColumn}>
              <span
                className={styles.chartHours}
                style={{ color: labelColor, fontWeight: labelWeight }}
              >
                {hoursLabel}
              </span>
              <div className={styles.chartBar} style={{ height: barPx }}>
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
