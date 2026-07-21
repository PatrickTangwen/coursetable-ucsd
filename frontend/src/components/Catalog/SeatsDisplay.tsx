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
  capacityKind = null,
  variant = 'default',
}: {
  readonly enrolled: number | null;
  readonly capacity: number | null;
  readonly availableSeats?: number | null;
  readonly capacityKind?: 'bounded' | 'effectively_unbounded' | null;
  readonly variant?: 'default' | 'subrow';
}) {
  if (capacityKind === 'effectively_unbounded') {
    return (
      <div
        className={clsx(
          styles.container,
          variant === 'subrow' && styles.subrow,
        )}
      >
        <span className={clsx(styles.text, textClass.available)}>
          Open · no fixed cap
        </span>
      </div>
    );
  }
  const hasCapacity = capacity !== null && capacity > 0;
  const displayedAvailableSeats =
    availableSeats ??
    (enrolled !== null && capacity !== null
      ? Math.max(capacity - enrolled, 0)
      : null);
  if (displayedAvailableSeats === null) return null;
  const status = hasCapacity
    ? seatsColor(enrolled, capacity, displayedAvailableSeats)
    : 'available';
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
