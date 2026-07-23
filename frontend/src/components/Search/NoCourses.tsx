import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import { createCatalogLink } from '../../utilities/navigation';
import EmptyCalendarIllustration from '../EmptyCalendarIllustration';
import styles from './NoCourses.module.css';

function NoCourses({
  heading,
  children,
}: {
  readonly heading?: ReactNode;
  readonly children?: ReactNode;
}) {
  const viewedSeason = useStore((state) => state.viewedSeason);

  return (
    <div className={styles.container}>
      <EmptyCalendarIllustration className={styles.illustration} />
      <h3 className={styles.heading}>
        {heading ?? `Nothing planned for ${toSeasonString(viewedSeason)} yet`}
      </h3>
      {children ?? (
        <>
          <p className={styles.hint}>
            Browse the catalog and click + on a course to add it to your
            worksheet.
          </p>
          <Link to={createCatalogLink()} className={styles.catalogButton}>
            Browse Catalog
          </Link>
        </>
      )}
    </div>
  );
}

export default NoCourses;
