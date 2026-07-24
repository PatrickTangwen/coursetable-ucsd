import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaExpandAlt, FaTimes } from 'react-icons/fa';

import { useStore } from '../../store';
import SunGridCalendar from '../Worksheet/SunGridCalendar';
import WorksheetCalendarSidebar from '../Worksheet/WorksheetCalendarSidebar';
import styles from './FloatingWorksheetCalendar.module.css';

export default function FloatingWorksheetCalendar() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const changeWorksheetView = useStore((state) => state.changeWorksheetView);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(e.target instanceof Node) || root.contains(e.target))
        return;
      // The CalendarQuickModal opened from an event block is portaled to
      // <body>, so its clicks (including its backdrop) land outside the
      // root — those should only close the modal, not the preview.
      if (document.querySelector('[aria-modal="true"]')) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const expandToWorksheet = useCallback(() => {
    changeWorksheetView('calendar');
    void navigate('/worksheet');
  }, [changeWorksheetView, navigate]);

  return (
    <div ref={rootRef} className={styles.root}>
      {open && (
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- floating preview card with the page still interactive behind it, not a native modal <dialog>
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Worksheet calendar preview"
        >
          <button
            type="button"
            className={styles.expandButton}
            onClick={expandToWorksheet}
            aria-label="Open worksheet calendar"
            title="Open worksheet calendar"
          >
            <FaExpandAlt size={12} />
          </button>
          {/* Mirrors the mobile Worksheet calendar page: the calendar fills
              one panel height, and scrolling down reveals the sidebar
              (stats, controls, and course list) below it. */}
          <div className={styles.panelScroll}>
            <div className={styles.calendarZone}>
              <SunGridCalendar />
            </div>
            <div className={styles.sidebarZone}>
              <WorksheetCalendarSidebar />
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        aria-label={
          open
            ? 'Close worksheet calendar preview'
            : 'Open worksheet calendar preview'
        }
      >
        {open ? <FaTimes size={20} /> : <FaCalendarAlt size={20} />}
      </button>
    </div>
  );
}
