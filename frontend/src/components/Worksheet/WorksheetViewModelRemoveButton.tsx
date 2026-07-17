import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { RemoveWorksheetButton } from './WorksheetToggleControls';
import { isLegacyUserInfo } from '../../queries/api';
import { useStore } from '../../store';
import type { WorksheetListingViewModel } from '../../types/worksheetCourse';

export default function WorksheetViewModelRemoveButton({
  listing,
  className,
}: {
  readonly listing: WorksheetListingViewModel;
  readonly className?: string;
}) {
  const {
    isAnonymousWorksheet,
    removeActiveSavedWorksheetListing,
    removeAnonymousWorksheetListing,
    user,
  } = useStore(
    useShallow((state) => ({
      isAnonymousWorksheet: state.worksheetMemo.getIsAnonymousWorksheet(state),
      removeActiveSavedWorksheetListing:
        state.removeActiveSavedWorksheetListing,
      removeAnonymousWorksheetListing: state.removeAnonymousWorksheetListing,
      user: state.user,
    })),
  );
  const hasSavedWorksheetAccount = Boolean(user && !isLegacyUserInfo(user));
  const remove = async () => {
    const changed = isAnonymousWorksheet
      ? removeAnonymousWorksheetListing(listing)
      : hasSavedWorksheetAccount
        ? await removeActiveSavedWorksheetListing(listing)
        : false;
    if (changed) toast.success('Removed from worksheet', { duration: 800 });
  };

  return (
    <RemoveWorksheetButton
      className={className}
      onClick={() => {
        remove().catch(() => toast.error('Unable to remove course'));
      }}
      disabled={!isAnonymousWorksheet && !hasSavedWorksheetAccount}
      ariaLabel="Remove from worksheet"
    />
  );
}
