import type React from 'react';

import { useSearch } from '../../hooks/useSearch';
import styles from './CatalogNavSearch.module.css';

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.2" y1="10.2" x2="14" y2="14" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CatalogResultCount() {
  const { searchData, coursesLoading } = useSearch();
  return (
    <div className={styles.resultCount}>
      {coursesLoading
        ? 'Searching…'
        : `Showing ${searchData?.length ?? 0} results`}
    </div>
  );
}

export default function CatalogNavSearch() {
  const { filters, setStartTime } = useSearch();
  const { searchText } = filters;

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>
          <SearchIcon />
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder="Search by course code, title, instructor, or description"
          value={searchText.value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            searchText.set(e.target.value);
            setStartTime(Date.now());
          }}
        />
        {searchText.value && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              searchText.resetToEmpty();
              setStartTime(Date.now());
            }}
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        )}
      </div>
    </div>
  );
}
