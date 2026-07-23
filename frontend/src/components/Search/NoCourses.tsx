import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import { createCatalogLink } from '../../utilities/navigation';
import EmptyCalendarIllustration from '../EmptyCalendarIllustration';
import styles from './NoCourses.module.css';

function NoCourses({
  heading,
  children,
  presentation = 'inline',
}: {
  readonly heading?: ReactNode;
  readonly children?: ReactNode;
  readonly presentation?: 'inline' | 'page';
}) {
  const viewedSeason = useStore((state) => state.viewedSeason);
  const isPagePresentation = presentation === 'page';

  return (
    <div
      className={clsx(
        styles.container,
        isPagePresentation && styles.pageContainer,
      )}
    >
      <EmptyCalendarIllustration
        className={clsx(
          styles.illustration,
          isPagePresentation && styles.pageIllustration,
        )}
      />
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
