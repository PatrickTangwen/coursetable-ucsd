import clsx from 'clsx';
import {
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dropdown,
} from 'react-bootstrap';
import { useShallow } from 'zustand/react/shallow';
import SeasonDropdown from './SeasonDropdown';
import WorksheetNumDropdown from './WorksheetNumberDropdown';

import type { WorksheetView } from '../../slices/WorksheetSlice';
import { useStore } from '../../store';
import styles from './NavbarWorksheetSearch.module.css';

type VisibleWorksheetView = Exclude<WorksheetView, 'map'>;

const visibleWorksheetViews: VisibleWorksheetView[] = ['calendar', 'list'];

const viewLabels: { [key in VisibleWorksheetView]: string } = {
  calendar: 'Calendar',
  list: 'List',
};

export function NavbarWorksheetSearch({
  isMobile,
}: {
  readonly isMobile: boolean;
}) {
  const {
    worksheetView,
    changeWorksheetView,
    isExoticWorksheet,
    exitExoticWorksheet,
  } = useStore(
    useShallow((state) => ({
      worksheetView: state.worksheetView,
      changeWorksheetView: state.changeWorksheetView,
      isExoticWorksheet: state.worksheetMemo.getIsExoticWorksheet(state),
      exitExoticWorksheet: state.exitExoticWorksheet,
    })),
  );

  const authStatus = useStore((state) => state.authStatus);
  const visibleWorksheetView =
    worksheetView === 'list' ? worksheetView : 'calendar';

  // Mobile: dropdown styled like toggle, flush right next to hamburger
  if (isMobile) {
    return (
      <div className={styles.containerMobile}>
        <Dropdown align="end">
          <Dropdown.Toggle className={styles.viewDropdownToggle}>
            <span className={styles.toggleButtonContent}>
              <span>{viewLabels[visibleWorksheetView]}</span>
            </span>
          </Dropdown.Toggle>
          <Dropdown.Menu className={styles.viewDropdownMenu}>
            {visibleWorksheetViews.map((view) => (
              <Dropdown.Item
                key={view}
                className={clsx(
                  styles.viewDropdownItem,
                  visibleWorksheetView === view &&
                    styles.viewDropdownItemActive,
                )}
                onClick={() => changeWorksheetView(view)}
              >
                <span className={styles.toggleButtonContent}>
                  <span>{viewLabels[view]}</span>
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }

  // Desktop: show full toggle with controls
  return (
    <div className={clsx(styles.container, 'd-flex align-items-center')}>
      <ToggleButtonGroup
        name="worksheet-view-toggle"
        type="radio"
        value={visibleWorksheetView}
        onChange={(val: VisibleWorksheetView) => changeWorksheetView(val)}
        className={clsx(styles.toggleButtonGroup, 'ms-2 me-3')}
        data-tutorial="worksheet-2"
      >
        <ToggleButton
          id="view-toggle-calendar"
          className={styles.toggleButton}
          value="calendar"
        >
          Calendar
        </ToggleButton>
        <ToggleButton
          id="view-toggle-list"
          className={styles.toggleButton}
          value="list"
        >
          List
        </ToggleButton>
      </ToggleButtonGroup>
      {isExoticWorksheet ? (
        <div className={styles.exoticWorksheetContainer}>
          <span className={styles.exoticWorksheetText}>
            Viewing exported worksheet
          </span>
          <Button
            variant="primary"
            className={styles.exoticExitButton}
            onClick={exitExoticWorksheet}
          >
            Exit
          </Button>
        </div>
      ) : authStatus === 'authenticated' ? (
        <>
          <SeasonDropdown mobile={false} />
          <WorksheetNumDropdown mobile={false} />
        </>
      ) : null}
    </div>
  );
}
