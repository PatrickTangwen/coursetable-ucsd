import { FaTimes } from 'react-icons/fa';

import { usePersistentDismissal } from '../../utilities/browserStorage';
import { FAQ_URL } from '../landing/links';
import styles from './CatalogDisclaimer.module.css';

const NOTICE_VERSION = 1;

export default function CatalogDisclaimer() {
  const { dismissed, dismiss } = usePersistentDismissal(
    'dismissedCatalogDisclaimer',
    NOTICE_VERSION,
  );

  if (dismissed) return null;

  return (
    <aside className={styles.notice} aria-label="Catalog notice">
      <p className={styles.message}>
        SunGrid is an independent planning tool and is not affiliated with UC
        San Diego. Seat counts are not real-time, and course selections here do
        not enroll you in TSS.{' '}
        <a href={FAQ_URL} target="_blank" rel="noopener noreferrer">
          Read the FAQ
        </a>
        .
      </p>
      <button
        type="button"
        className={styles.dismissButton}
        aria-label="Dismiss catalog notice"
        onClick={dismiss}
      >
        <FaTimes aria-hidden="true" />
      </button>
    </aside>
  );
}
