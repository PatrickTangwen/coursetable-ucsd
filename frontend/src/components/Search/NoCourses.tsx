import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import NoCoursesFound from '../../images/calendar_img_high_res.png';
import { useStore } from '../../store';
import { toSeasonString } from '../../utilities/course';
import { createCatalogLink } from '../../utilities/navigation';

function NoCourses({
  heading,
  children,
}: {
  readonly heading?: ReactNode;
  readonly children?: ReactNode;
}) {
  const viewedSeason = useStore((state) => state.viewedSeason);

  return (
    <div style={{ width: '100%' }} className="d-flex mb-5">
      <div className="text-center m-auto">
        <img
          alt="No courses found."
          className="py-4"
          src={NoCoursesFound}
          style={{ width: '60%', maxWidth: '280px', mixBlendMode: 'multiply' }}
        />
        <h3>
          {heading ?? `No courses found for ${toSeasonString(viewedSeason)}`}
        </h3>
        {children ?? (
          <div>
            Add some courses on the{' '}
            <Link to={createCatalogLink()}>Catalog</Link>.
          </div>
        )}
      </div>
    </div>
  );
}

export default NoCourses;
