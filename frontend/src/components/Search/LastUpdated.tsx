import { useMemo } from 'react';
import { MdUpdate } from 'react-icons/md';
import { useFerry } from '../../hooks/useFerry';
import {
  getCatalogLastUpdated,
  toRelativeUpdateTime,
} from '../../utilities/catalogFreshness';
import { TextComponent } from '../Typography';

export default function LastUpdated() {
  const { courses } = useFerry();
  const { lastUpdated, relative } = useMemo(() => {
    const lastUpdated = getCatalogLastUpdated(courses);
    const relative = toRelativeUpdateTime(lastUpdated);
    return { lastUpdated, relative };
  }, [courses]);
  return (
    <TextComponent type="tertiary" small className="mb-2 text-end" as="div">
      <MdUpdate className="me-1" />
      Updated{' '}
      <time title={lastUpdated.toString()} dateTime={lastUpdated.toISOString()}>
        {relative} ago
      </time>
    </TextComponent>
  );
}
