import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { RemoveWorksheetButton } from './WorksheetToggleControls';
import { useStore } from '../../store';
import type { WorksheetListingViewModel } from '../../types/worksheetCourse';

export function useRemoveWorksheetListing(listing: WorksheetListingViewModel) {
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
  const hasSavedWorksheetAccount = Boolean(user);
  const canRemove = isAnonymousWorksheet || hasSavedWorksheetAccount;
  const remove = () => {
    const removeInternal = async () => {
      if (isAnonymousWorksheet) removeAnonymousWorksheetListing(listing);
      else if (hasSavedWorksheetAccount)
        await removeActiveSavedWorksheetListing(listing);
    };
    removeInternal().catch(() => toast.error('Unable to remove course'));
  };
  return { remove, canRemove };
}

export default function WorksheetViewModelRemoveButton({
  listing,
  className,
}: {
  readonly listing: WorksheetListingViewModel;
  readonly className?: string;
}) {
  const { remove, canRemove } = useRemoveWorksheetListing(listing);

  return (
    <RemoveWorksheetButton
      className={className}
      onClick={remove}
      disabled={!canRemove}
      ariaLabel="Remove from worksheet"
    />
  );
}
