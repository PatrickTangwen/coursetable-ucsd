import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { useShallow } from 'zustand/react/shallow';

import { useToggleCourseHidden } from './WorksheetHideButton';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import type { WorksheetListingViewModel } from '../../types/worksheetCourse';
import { worksheetColorTokens } from '../../utilities/constants';
import { formatWorksheetSectionSuffix } from '../../utilities/course';
import styles from './WorksheetCourseMenus.module.css';

export type WorksheetControlsMenu = 'visibility' | 'settings' | 'export' | null;

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PaletteIcon({
  color,
  size,
}: {
  readonly color: string;
  readonly size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 1.1-3.22 1.8 1.8 0 0 1 1.1-3.22H18A3 3 0 0 0 21 11.5 8.6 8.6 0 0 0 12 3Z" />
      <circle cx="7.6" cy="10" r="1.25" fill={color} stroke="none" />
      <circle cx="10.5" cy="6.9" r="1.25" fill={color} stroke="none" />
      <circle cx="15" cy="7.3" r="1.25" fill={color} stroke="none" />
    </svg>
  );
}

function VisibilityIcon({
  hidden,
  size,
  style,
}: {
  readonly hidden: boolean;
  readonly size: number;
  readonly style: 'calendar' | 'list';
}) {
  if (style === 'list') {
    const Icon = hidden ? BsEyeSlash : BsEye;
    return <Icon size={size} aria-hidden="true" />;
  }

  return hidden ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ct-text-muted)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MenuOverlay({
  target,
  open,
  onClose,
  id,
  children,
}: {
  readonly target: RefObject<HTMLButtonElement | null>;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <Overlay
      target={target.current}
      show={open}
      placement="bottom-end"
      containerPadding={8}
      flip
      rootClose
      onHide={onClose}
    >
      {(overlayProps) => (
        <Popover {...overlayProps} id={id} className={styles.menu} role="menu">
          <Popover.Body
            className={styles.menuBody}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                target.current?.focus();
              }
            }}
          >
            {children}
          </Popover.Body>
        </Popover>
      )}
    </Overlay>
  );
}

export function WorksheetVisibilityMenuButton({
  courses,
  className,
  menuClassName,
  backdropClassName,
  iconSize,
  iconStyle = 'list',
  open,
  onOpenChange,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly className?: string;
  readonly menuClassName?: string;
  readonly backdropClassName?: string;
  readonly iconSize: number;
  readonly iconStyle?: 'calendar' | 'list';
  readonly open: boolean;
  readonly onOpenChange: (nextOpen: boolean) => void;
}) {
  const toggleCourseHidden = useToggleCourseHidden();
  const [pendingCrn, setPendingCrn] = useState<number | null>(null);
  if (!toggleCourseHidden) return null;

  const allHidden =
    courses.length > 0 && courses.every((course) => course.hidden);
  return (
    <>
      <button
        type="button"
        className={className}
        title="Choose courses to hide"
        aria-label="Choose courses to hide"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="worksheet-course-visibility-menu"
        onClick={() => onOpenChange(!open)}
      >
        <VisibilityIcon hidden={allHidden} size={iconSize} style={iconStyle} />
      </button>
      {open && (
        <>
          {backdropClassName && (
            <button
              type="button"
              className={backdropClassName}
              onClick={() => onOpenChange(false)}
              aria-label="Close course visibility menu"
              tabIndex={-1}
            />
          )}
          <div
            id="worksheet-course-visibility-menu"
            className={menuClassName}
            role="menu"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onOpenChange(false);
            }}
          >
            <div className={styles.menuLabel} data-visibility-heading>
              Hide courses
            </div>
            <div className={styles.menuHint}>
              Select a course to hide or restore it.
            </div>
            <div className={styles.menuList}>
              {courses.map((course) => {
                const hidden = Boolean(course.hidden);
                const courseLabel = `${course.listing.course_code}${formatWorksheetSectionSuffix(course.listing)}`;
                return (
                  <button
                    key={course.listing.crn}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={hidden}
                    className={styles.menuItem}
                    disabled={pendingCrn !== null}
                    onClick={async () => {
                      setPendingCrn(course.listing.crn);
                      try {
                        await toggleCourseHidden(course.listing.crn, hidden);
                      } finally {
                        setPendingCrn(null);
                      }
                    }}
                  >
                    <span className={styles.courseIdentity}>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: course.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.courseCode}>{courseLabel}</span>
                    </span>
                    <span className={styles.visibilityState}>
                      {hidden ? (
                        <BsEyeSlash size={15} aria-hidden="true" />
                      ) : (
                        <BsEye size={15} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function useSetWorksheetCourseColor() {
  const {
    viewedPerson,
    isReadonlyWorksheet,
    isAnonymousWorksheet,
    user,
    setAnonymousWorksheetListingColor,
    setActiveSavedWorksheetListingColor,
  } = useStore(
    useShallow((state) => ({
      viewedPerson: state.viewedPerson,
      isReadonlyWorksheet: state.worksheetMemo.getIsReadonlyWorksheet(state),
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      user: state.user,
      setAnonymousWorksheetListingColor:
        state.setAnonymousWorksheetListingColor,
      setActiveSavedWorksheetListingColor:
        state.setActiveSavedWorksheetListingColor,
    })),
  );

  if (isReadonlyWorksheet || viewedPerson !== 'me') return null;
  if (!isAnonymousWorksheet && !user) return null;

  return async (listing: WorksheetListingViewModel, color: string) => {
    if (isAnonymousWorksheet) {
      setAnonymousWorksheetListingColor(listing, color);
      return;
    }
    await setActiveSavedWorksheetListingColor(listing, color);
  };
}

export function WorksheetColorMenuButton({
  course,
  className,
  iconSize,
  open,
  onOpenChange,
}: {
  readonly course: WorksheetCourse;
  readonly className?: string;
  readonly iconSize: number;
  readonly open: boolean;
  readonly onOpenChange: (nextOpen: boolean) => void;
}) {
  const setCourseColor = useSetWorksheetCourseColor();
  const targetRef = useRef<HTMLButtonElement>(null);
  if (!setCourseColor) return null;

  return (
    <>
      <button
        ref={targetRef}
        type="button"
        className={className}
        title={`Change ${course.listing.course_code} color`}
        aria-label={`Change ${course.listing.course_code} color`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <PaletteIcon color={course.color} size={iconSize} />
      </button>
      <MenuOverlay
        target={targetRef}
        open={open}
        onClose={() => onOpenChange(false)}
        id={`worksheet-course-color-menu-${course.listing.crn}`}
      >
        <div className={styles.menuLabel}>Course color</div>
        <div className={styles.menuList}>
          {worksheetColorTokens.map((token) => {
            const active =
              token.solid.toLowerCase() === course.color.toLowerCase();
            return (
              <button
                key={token.hue}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={styles.menuItem}
                data-active={active || undefined}
                onClick={() => {
                  onOpenChange(false);
                  void setCourseColor(course.listing, token.solid);
                }}
              >
                <span className={styles.courseIdentity}>
                  <span
                    className={styles.colorDot}
                    style={{ backgroundColor: token.solid }}
                    aria-hidden="true"
                  />
                  <span>{token.hue}</span>
                </span>
                <span className={styles.checkSlot}>
                  {active && <CheckIcon />}
                </span>
              </button>
            );
          })}
        </div>
      </MenuOverlay>
    </>
  );
}
