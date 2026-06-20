import { useMemo } from 'react';
import WorksheetCalendarList from './WorksheetCalendarList';
import WorksheetStats from './WorksheetStats';
import styles from './WorksheetList.module.css';

function WorksheetList() {
  const emptyMissingBuildingCodes = useMemo(() => new Set<string>(), []);

  return (
    <div className={styles.container}>
      <WorksheetStats />
      <WorksheetCalendarList
        highlightBuilding={null}
        showLocation
        showMissingLocationIcon={false}
        controlsMode="full"
        missingBuildingCodes={emptyMissingBuildingCodes}
        hideTooltipContext="calendar"
      />
    </div>
  );
}

export default WorksheetList;
