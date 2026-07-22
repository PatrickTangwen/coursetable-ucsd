import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

import { FAQ_URL } from '../landing/links';
import styles from './CatalogDisclaimer.module.css';

export default function CatalogDisclaimer() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside className={styles.notice} aria-label="Catalog notice">
      <p className={styles.message}>
        SunGrid is not affiliated with UC San Diego. Seats are not live.
        Selecting courses here does not enroll you in TSS.{' '}
        <a href={FAQ_URL} target="_blank" rel="noopener noreferrer">
          FAQ
        </a>
        .
      </p>
      <button
        type="button"
        className={styles.dismissButton}
        aria-label="Dismiss catalog notice"
        onClick={() => setDismissed(true)}
      >
        <FaTimes aria-hidden="true" />
      </button>
    </aside>
  );
}
