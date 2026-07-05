import clsx from 'clsx';
import styles from './DayChips.module.css';

const WEEK = ['M', 'Tu', 'W', 'Th', 'F'];

export default function DayChips({
  days = WEEK,
  on,
  size = 'sm',
}: {
  readonly days?: readonly string[];
  readonly on: readonly string[];
  readonly size?: 'sm' | 'md';
}) {
  return (
    <div className={styles.chips}>
      {days.map((day) => (
        <span
          key={day}
          className={clsx(
            styles.chip,
            size === 'md' ? styles.md : styles.sm,
            on.includes(day) && styles.on,
          )}
        >
          {day}
        </span>
      ))}
    </div>
  );
}
