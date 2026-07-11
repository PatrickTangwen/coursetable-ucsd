import { useEffect } from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import styles from './BottomSheet.module.css';

/**
 * Shared mobile bottom-sheet chrome: dimmed backdrop, slide-up panel with a
 * drag handle, page-scroll lock, and Escape-to-close. Stays mounted so the
 * open/close transform can animate.
 */
export default function BottomSheet({
  open,
  onClose,
  className,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return createPortal(
    <>
      <button
        type="button"
        className={clsx(styles.backdrop, open && styles.backdropOpen)}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        className={clsx(styles.sheet, className, open && styles.sheetOpen)}
        aria-hidden={!open}
      >
        <div className={styles.handle} />
        {children}
      </div>
    </>,
    document.body,
  );
}
