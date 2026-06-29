import type { MouseEventHandler } from 'react';
import clsx from 'clsx';
import { Button } from 'react-bootstrap';
import { BsTrash } from 'react-icons/bs';

import styles from './WorksheetToggleControls.module.css';

function PlusMinusGlyph() {
  return (
    <>
      <span
        className={clsx(styles.toggleButtonBar, styles.toggleButtonBarH)}
        aria-hidden="true"
      />
      <span
        className={clsx(styles.toggleButtonBar, styles.toggleButtonBarV)}
        aria-hidden="true"
      />
    </>
  );
}

export function AddWorksheetButton({
  added,
  disabled,
  ariaLabel,
  className,
  onClick,
}: {
  readonly added?: boolean;
  readonly disabled?: boolean;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      variant="toggle"
      className={clsx(
        className,
        styles.toggleButton,
        added && styles.isAdded,
        disabled && styles.disabledButton,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <PlusMinusGlyph />
    </Button>
  );
}

export function RemoveWorksheetButton({
  disabled,
  ariaLabel,
  className,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      variant="toggle"
      className={clsx(styles.removeButton, className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <BsTrash size={13} aria-hidden="true" />
      <span>Remove this course</span>
    </Button>
  );
}
