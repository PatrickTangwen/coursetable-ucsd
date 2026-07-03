import clsx from 'clsx';

import { seatsColor } from '../../utilities/catalogView';
import styles from './SeatsDisplay.module.css';

const textClass = {
  critical: styles.critical,
  low: styles.low,
  medium: styles.medium,
  high: styles.high,
  available: styles.available,
};

const barClass = {
  critical: styles.barCritical,
  low: styles.barLow,
  medium: styles.barMedium,
  high: styles.barHigh,
  available: styles.barAvailable,
};

export default function SeatsDisplay({
  enrolled,
  capacity,
  variant = 'default',
}: {
  readonly enrolled: number | null;
  readonly capacity: number | null;
  readonly variant?: 'default' | 'subrow';
}) {
  if (enrolled === null || capacity === null || capacity <= 0) return null;
  const availableSeats = Math.max(capacity - enrolled, 0);
  const status = seatsColor(enrolled, capacity);
  const availablePct = Math.min((availableSeats / capacity) * 100, 100);

  if (variant === 'subrow') {
    return (
      <div className={clsx(styles.container, styles.subrow)}>
        <span className={clsx(styles.text, textClass[status])}>
          {availableSeats}/{capacity}
        </span>
        <div className={styles.bar}>
          <div
            className={clsx(styles.barFill, barClass[status])}
            style={{ width: `${availablePct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <span className={clsx(styles.text, textClass[status])}>
        {availableSeats} left
      </span>
    </div>
  );
}
