import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import clsx from 'clsx';
import { Overlay, Popover } from 'react-bootstrap';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { FaXmark } from 'react-icons/fa6';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';

import { useToggleCourseHidden } from './WorksheetHideButton';
import type { Crn } from '../../queries/graphql-types';
import type { WorksheetCourse } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import type { WorksheetListingViewModel } from '../../types/worksheetCourse';
import {
  getWorksheetColorAppearance,
  worksheetColorTokens,
} from '../../utilities/constants';
import { formatWorksheetSectionSuffix } from '../../utilities/course';
import BottomSheet from '../BottomSheet';
import styles from './WorksheetCourseMenus.module.css';

export type WorksheetControlsMenu = 'visibility' | 'settings' | 'export' | null;
export const worksheetColorMenuHostClassName = styles.boundedMenuHost;

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
  const theme = useStore((state) => state.theme);
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
            <div className={styles.menuHint}>Select courses to hide</div>
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
                        style={{
                          backgroundColor: getWorksheetColorAppearance(
                            course.color,
                            theme,
                          ).primary,
                        }}
                        aria-hidden="true"
                      />
                      <span className={styles.courseCode}>{courseLabel}</span>
                    </span>
                    <span
                      className={styles.visibilityCheckbox}
                      data-checked={hidden || undefined}
                      aria-hidden="true"
                    >
                      {hidden && <CheckIcon />}
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

function WorksheetColorOptions({
  course,
  theme,
  variant,
  onSelect,
}: {
  readonly course: WorksheetCourse;
  readonly theme: 'light' | 'dark';
  readonly variant: 'menu' | 'sheet';
  readonly onSelect: (color: string) => void;
}) {
  return worksheetColorTokens.map((token) => {
    const active = token.solid.toLowerCase() === course.color.toLowerCase();
    const sheetVariant = variant === 'sheet';
    const optionProps = sheetVariant
      ? {
          'aria-pressed': active,
          className: styles.colorSheetOption,
        }
      : {
          'aria-checked': active,
          className: styles.menuItem,
          role: 'menuitemradio' as const,
        };
    return (
      <button
        key={token.hue}
        type="button"
        {...optionProps}
        data-active={active || undefined}
        onClick={() => onSelect(token.solid)}
      >
        <span className={styles.courseIdentity}>
          <span
            className={clsx(
              styles.colorDot,
              sheetVariant && styles.colorSheetDot,
            )}
            style={{
              backgroundColor: getWorksheetColorAppearance(token.solid, theme)
                .primary,
            }}
            aria-hidden="true"
          />
          <span>{token.hue}</span>
        </span>
        <span className={styles.checkSlot}>{active && <CheckIcon />}</span>
      </button>
    );
  });
}

function useDisplayedColorCourse(
  courses: readonly WorksheetCourse[],
  selectedCrn: Crn | null,
) {
  const course =
    courses.find((candidate) => candidate.listing.crn === selectedCrn) ?? null;
  const [lastCourse, setLastCourse] = useState(course);
  useEffect(() => {
    if (course) setLastCourse(course);
  }, [course]);
  return course ?? lastCourse;
}

function WorksheetColorPickerContent({
  course,
  theme,
  onClose,
  onSelect,
}: {
  readonly course: WorksheetCourse;
  readonly theme: 'light' | 'dark';
  readonly onClose: () => void;
  readonly onSelect: (color: string) => void;
}) {
  const titleId = `worksheet-course-color-sheet-title-${course.listing.crn}`;
  return (
    <section aria-labelledby={titleId} className={styles.colorSheetInner}>
      <div className={styles.colorSheetHeader}>
        <h2 id={titleId} className={styles.colorSheetTitle}>
          {course.listing.course_code} color
        </h2>
        <button
          type="button"
          className={styles.colorSheetClose}
          onClick={onClose}
          aria-label="Close course color picker"
        >
          <FaXmark aria-hidden="true" />
        </button>
      </div>
      <div className={styles.colorSheetList}>
        <WorksheetColorOptions
          course={course}
          theme={theme}
          variant="sheet"
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

export function WorksheetColorPicker({
  courses,
  selectedCrn,
  onClose,
  presentation,
}: {
  readonly courses: readonly WorksheetCourse[];
  readonly selectedCrn: Crn | null;
  readonly onClose: () => void;
  readonly presentation: 'mobile-sheet' | 'contained-menu';
}) {
  const setCourseColor = useSetWorksheetCourseColor();
  const theme = useStore((state) => state.theme);
  const displayedCourse = useDisplayedColorCourse(courses, selectedCrn);
  const isContainedMenu = presentation === 'contained-menu';

  useEffect(() => {
    if (!isContainedMenu || selectedCrn === null) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isContainedMenu, onClose, selectedCrn]);

  if (!displayedCourse || !setCourseColor) return null;

  const selectColor = (color: string) => {
    onClose();
    void setCourseColor(displayedCourse.listing, color);
  };

  if (isContainedMenu) {
    if (selectedCrn === null) return null;
    return (
      <>
        <button
          type="button"
          className={styles.containedColorBackdrop}
          aria-label="Dismiss course color menu"
          onClick={onClose}
        />
        <div
          className={clsx(styles.menu, styles.containedColorMenu)}
          role="menu"
          aria-label={`${displayedCourse.listing.course_code} color`}
          tabIndex={-1}
        >
          <div className={styles.menuBody}>
            <div className={styles.menuLabel}>Course color</div>
            <div className={styles.menuList}>
              <WorksheetColorOptions
                course={displayedCourse}
                theme={theme}
                variant="menu"
                onSelect={selectColor}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <BottomSheet
      open={selectedCrn !== null}
      onClose={onClose}
      swipeToClose
      className={styles.colorSheet}
    >
      <WorksheetColorPickerContent
        course={displayedCourse}
        theme={theme}
        onClose={onClose}
        onSelect={selectColor}
      />
    </BottomSheet>
  );
}

export function WorksheetColorMenuButton({
  course,
  className,
  iconSize,
  boundedContainerRef,
  externalPicker,
  open,
  onOpenChange,
}: {
  readonly course: WorksheetCourse;
  readonly className?: string;
  readonly iconSize: number;
  readonly boundedContainerRef?: RefObject<HTMLDivElement | null>;
  readonly externalPicker?: 'dialog' | 'menu';
  readonly open: boolean;
  readonly onOpenChange: (nextOpen: boolean) => void;
}) {
  const setCourseColor = useSetWorksheetCourseColor();
  const theme = useStore((state) => state.theme);
  const isMobile = useStore((state) => state.isMobile);
  const targetRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const usesExternalPicker = isMobile || externalPicker !== undefined;
  const externalPickerRole = isMobile ? 'dialog' : externalPicker;
  const bounded = boundedContainerRef !== undefined && !usesExternalPicker;

  useEffect(() => {
    if (!bounded || !open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !targetRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        onOpenChange(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [bounded, onOpenChange, open]);

  if (!setCourseColor) return null;

  const menuContents = (
    <>
      <div className={styles.menuLabel}>Course color</div>
      <div className={styles.menuList}>
        <WorksheetColorOptions
          course={course}
          theme={theme}
          variant="menu"
          onSelect={(color) => {
            onOpenChange(false);
            void setCourseColor(course.listing, color);
          }}
        />
      </div>
    </>
  );

  return (
    <>
      <button
        ref={targetRef}
        type="button"
        className={className}
        title={`Change ${course.listing.course_code} color`}
        aria-label={`Change ${course.listing.course_code} color`}
        aria-haspopup={externalPickerRole ?? 'menu'}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <PaletteIcon
          color={getWorksheetColorAppearance(course.color, theme).primary}
          size={iconSize}
        />
      </button>
      {usesExternalPicker ? null : bounded ? (
        open &&
        boundedContainerRef.current &&
        createPortal(
          <div
            ref={menuRef}
            id={`worksheet-course-color-menu-${course.listing.crn}`}
            className={clsx(styles.menu, styles.boundedMenu)}
            role="menu"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onOpenChange(false);
                targetRef.current?.focus();
              }
            }}
          >
            <div className={styles.menuBody}>{menuContents}</div>
          </div>,
          boundedContainerRef.current,
        )
      ) : (
        <MenuOverlay
          target={targetRef}
          open={open}
          onClose={() => onOpenChange(false)}
          id={`worksheet-course-color-menu-${course.listing.crn}`}
        >
          {menuContents}
        </MenuOverlay>
      )}
    </>
  );
}

export function WorksheetColorMenuSlot({
  containerRef,
  className,
}: {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly className?: string;
}) {
  return (
    <div
      ref={containerRef}
      className={clsx(styles.boundedMenuSlot, className)}
    />
  );
}
