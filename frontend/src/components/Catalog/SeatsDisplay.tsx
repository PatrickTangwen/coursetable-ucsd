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
  availableSeats,
  variant = 'default',
}: {
  readonly enrolled: number | null;
  readonly capacity: number | null;
  readonly availableSeats?: number | null;
  readonly variant?: 'default' | 'subrow';
}) {
  const hasCapacity = enrolled !== null && capacity !== null && capacity > 0;
  const displayedAvailableSeats = hasCapacity
    ? Math.max(capacity - enrolled, 0)
    : availableSeats;
  if (displayedAvailableSeats === null || displayedAvailableSeats === undefined)
    return null;
  const status = hasCapacity ? seatsColor(enrolled, capacity) : 'available';
  const availablePct = hasCapacity
    ? Math.min((displayedAvailableSeats / capacity) * 100, 100)
    : null;

  if (variant === 'subrow') {
    return (
      <div className={clsx(styles.container, styles.subrow)}>
        <span className={clsx(styles.text, textClass[status])}>
          {hasCapacity
            ? `${displayedAvailableSeats}/${capacity}`
            : `${displayedAvailableSeats} left`}
        </span>
        {availablePct !== null && (
          <div className={styles.bar}>
            <div
              className={clsx(styles.barFill, barClass[status])}
              style={{ width: `${availablePct}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <span className={clsx(styles.text, textClass[status])}>
        {displayedAvailableSeats} left
      </span>
    </div>
  );
}
