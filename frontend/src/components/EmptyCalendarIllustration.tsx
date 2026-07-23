import clsx from 'clsx';

import noCoursesImg from '../images/calendar_img_high_res_transparent.png';
import styles from './EmptyCalendarIllustration.module.css';

export default function EmptyCalendarIllustration({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={clsx(styles.illustration, className)}
      draggable={false}
      src={noCoursesImg}
    />
  );
}
