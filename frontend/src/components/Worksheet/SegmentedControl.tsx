import clsx from 'clsx';

import styles from './SegmentedControl.module.css';

/**
 * Segmented control from the finalized SunGrid calendar design: a recessed
 * track with ONE raised white pill that slides between the two options.
 *
 * `wide` uses the slightly wider fixed buttons (Regular/Finals); `fullWidth`
 * stretches the track and splits it 50/50 (mobile menu variant).
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  wide = false,
  fullWidth = false,
  dataTutorial,
}: {
  readonly options: { value: T; label: React.ReactNode }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly wide?: boolean;
  readonly fullWidth?: boolean;
  readonly dataTutorial?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      className={clsx(styles.track, fullWidth && styles.trackFull)}
      data-tutorial={dataTutorial}
    >
      <span
        className={clsx(
          styles.pill,
          wide && styles.pillWide,
          fullWidth && styles.pillFull,
          activeIndex === 1 && styles.pillRight,
        )}
        aria-hidden="true"
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            styles.button,
            wide && styles.buttonWide,
            fullWidth && styles.buttonFull,
            option.value === value && styles.buttonActive,
          )}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
