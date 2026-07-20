import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import {
  isDownwardCloseGesture,
  type PointerPosition,
} from './bottomSheetGesture';
import styles from './BottomSheet.module.css';

/**
 * Shared mobile bottom-sheet chrome: dimmed backdrop, slide-up panel with a
 * drag handle, page-scroll lock, and Escape-to-close. Stays mounted so the
 * open/close transform can animate.
 */
export default function BottomSheet({
  open,
  onClose,
  swipeToClose = false,
  className,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly swipeToClose?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  const swipeStart = useRef<PointerPosition | null>(null);

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

  const handleSwipeStart = (event: React.PointerEvent) => {
    if (!swipeToClose) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const maybeCloseFromSwipe = (event: React.PointerEvent) => {
    const start = swipeStart.current;
    if (!swipeToClose || !start) return;
    if (isDownwardCloseGesture(start, { x: event.clientX, y: event.clientY })) {
      swipeStart.current = null;
      onClose();
    }
  };

  const handleSwipeEnd = (event: React.PointerEvent) => {
    maybeCloseFromSwipe(event);
    swipeStart.current = null;
  };

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
        <div
          className={styles.handle}
          aria-hidden="true"
          onPointerDown={handleSwipeStart}
          onPointerMove={maybeCloseFromSwipe}
          onPointerUp={handleSwipeEnd}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        />
        {children}
      </div>
    </>,
    document.body,
  );
}
