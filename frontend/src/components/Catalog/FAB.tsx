import { useNavigate } from 'react-router-dom';

import styles from './FAB.module.css';

export default function FAB() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={() => navigate('/worksheet')}
      aria-label="Go to worksheet"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 4V2M16 4V2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8 14h2M14 14h2M8 18h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
