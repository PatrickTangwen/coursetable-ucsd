import clsx from 'clsx';

import { seatsColor } from '../../utilities/catalogView';
import styles from './SeatsDisplay.module.css';

const textClass = {
  available: styles.available,
  filling: styles.filling,
  'nearly-full': styles.nearlyFull,
};

const barClass = {
  available: styles.barAvailable,
  filling: styles.barFilling,
  'nearly-full': styles.barNearlyFull,
};

export default function SeatsDisplay({
  enrolled,
  capacity,
}: {
  readonly enrolled: number | null;
  readonly capacity: number | null;
}) {
  if (enrolled === null && capacity === null) return null;
  const status = seatsColor(enrolled, capacity);
  const pct =
    enrolled !== null && capacity !== null && capacity > 0
      ? Math.min((enrolled / capacity) * 100, 100)
      : 0;

  return (
    <div className={styles.container}>
      <span className={clsx(styles.text, textClass[status])}>
        {enrolled ?? '–'}/{capacity ?? '–'}
      </span>
      <div className={styles.bar}>
        <div
          className={clsx(styles.barFill, barClass[status])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
