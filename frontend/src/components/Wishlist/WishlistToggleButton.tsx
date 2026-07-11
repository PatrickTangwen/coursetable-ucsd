import React, { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';
import { toast } from 'sonner';

import { useShallow } from 'zustand/react/shallow';
import type { CourseModalPrefetchListingDataFragment } from '../../generated/graphql-types';
import { useWishlist } from '../../hooks/useWishlist';
import { isLegacyUserInfo, updateWishlistCourses } from '../../queries/api';
import type { Crn, Season } from '../../queries/graphql-types';
import { useStore } from '../../store';
import { isInWishlist } from '../../utilities/course';
import styles from './WishlistToggleButton.module.css';

function WishlistToggleButton({
  listing,
  modal,
}: {
  readonly listing: CourseModalPrefetchListingDataFragment;
  readonly modal: boolean;
}) {
  const { worksheets, wishlistRefresh, isLgDesktop, user } = useStore(
    useShallow((state) => ({
      worksheets: state.worksheets,
      wishlistRefresh: state.wishlistRefresh,
      isLgDesktop: state.isLgDesktop,
      user: state.user,
    })),
  );
  const tooltipId = `wishlist-tooltip-${listing.course.season_code}-${listing.crn}`;

  const { wishlistCourses } = useWishlist();

  const inWishlist = useMemo(
    () => isInWishlist(listing.course.same_course_id, wishlistCourses),
    [listing.course.same_course_id, wishlistCourses],
  );

  // Should theoretically only be one course (unique by same_course_id)
  const sameCoursesInWishlist = useMemo(
    () =>
      wishlistCourses.filter(
        (item) => item.sameCourseId === listing.course.same_course_id,
      ),
    [listing.course.same_course_id, wishlistCourses],
  );

  const buttonLabel = inWishlist
    ? 'Remove from Wishlist'
    : 'Add to Wishlist (Beta!)';

  const toggleWishlist = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (!inWishlist) {
          // ALREADY_BOOKMARKED etc. toast in api.ts handleErrorCode
          const ok = await updateWishlistCourses({
            action: 'add',
            season: listing.course.season_code,
            crn: listing.crn,
          });
          if (ok) toast.info('Saved to your wishlist');
        } else {
          const failures: { season: Season; crn: Crn }[] = [];
          for (const course of sameCoursesInWishlist) {
            try {
              const ok = await updateWishlistCourses({
                action: 'remove',
                season: course.season,
                crn: course.crn,
              });
              if (!ok)
                failures.push({ season: course.season, crn: course.crn });
            } catch {
              failures.push({ season: course.season, crn: course.crn });
            }
          }
          if (failures.length > 0) {
            toast.error(
              failures.length === sameCoursesInWishlist.length
                ? 'Could not remove these courses from your wishlist.'
                : `Could not remove ${failures.length} item(s) from your wishlist.`,
            );
          } else if (sameCoursesInWishlist.length > 0) {
            toast.success('Removed from wishlist');
          }
        }
      } finally {
        await wishlistRefresh();
      }
    },
    [
      inWishlist,
      wishlistRefresh,
      listing.course.season_code,
      listing.crn,
      sameCoursesInWishlist,
    ],
  );

  const size = modal ? 20 : isLgDesktop ? 16 : 14;
  const Icon = inWishlist ? FaBookmark : FaRegBookmark;

  if (!isLegacyUserInfo(user) || !worksheets) return null;

  return (
    <div className={styles.container}>
      <OverlayTrigger
        placement="top"
        delay={modal ? { show: 300, hide: 0 } : undefined}
        overlay={(props) => (
          <Tooltip id={tooltipId} {...props}>
            <small>{buttonLabel}</small>
          </Tooltip>
        )}
      >
        <Button
          variant="toggle"
          className={clsx(
            'py-auto px-1 d-flex align-items-center',
            styles.toggleButton,
          )}
          onClick={toggleWishlist}
          aria-label={buttonLabel}
        >
          <Icon size={size} />
        </Button>
      </OverlayTrigger>
    </div>
  );
}

export default WishlistToggleButton;
