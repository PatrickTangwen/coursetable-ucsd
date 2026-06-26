import clsx from 'clsx';

import type { DayFlags } from '../../utilities/catalogView';
import styles from './DayDots.module.css';

const DAY_LABELS: (keyof DayFlags)[] = ['M', 'Tu', 'W', 'Th', 'F'];

export default function DayDots({ days }: { readonly days: DayFlags }) {
  return (
    <div className={styles.container}>
      {DAY_LABELS.map((d) => (
        <span
          key={d}
          className={clsx(
            styles.dot,
            days[d] ? styles.active : styles.inactive,
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}
