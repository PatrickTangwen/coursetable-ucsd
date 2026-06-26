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
          strokeLinejoin="round"
        />
        <path
          d="M16 2v4M8 2v4M3 10h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
