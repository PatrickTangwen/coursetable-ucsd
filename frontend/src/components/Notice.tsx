import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { usePersistentDismissal } from '../utilities/browserStorage';
import styles from './Notice.module.css';

function Notice({
  children,
  id,
}: {
  readonly children?: React.ReactNode;
  readonly id: number;
}) {
  const { dismissed, dismiss } = usePersistentDismissal(
    'lastDismissedBanner',
    id,
  );

  if (dismissed || !children) return null;
  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div>{children}</div>
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={dismiss}
        aria-label="Close"
      >
        <FaTimes />
      </button>
    </div>
  );
}

export default Notice;
