import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';

import { FAQ_URL } from '../landing/links';
import styles from './CatalogDisclaimer.module.css';

let dismissedForPageLoad = false;

export default function CatalogDisclaimer() {
  const [dismissed, setDismissed] = useState(dismissedForPageLoad);

  const dismiss = () => {
    dismissedForPageLoad = true;
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <aside className={styles.notice} aria-label="Catalog notice">
      <p className={styles.message}>
        SunGrid is not affiliated with UC San Diego. Seats are not live.
        Selecting courses here does not enroll you in TSS.{' '}
        <a href={FAQ_URL} target="_blank" rel="noopener noreferrer">
          FAQ
        </a>
        . New here? Read the <Link to="/tutorial">tutorial</Link>.
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
