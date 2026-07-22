import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';

import MobileFilterSheet from './MobileFilterSheet';
import { useCoursePlanningCatalog } from '../../hooks/useCoursePlanning';
import { useSearch } from '../../hooks/useSearch';
import type { Season } from '../../queries/graphql-types';
import { buildCatalogSearchSuggestions } from '../../search/catalogSearchSuggestions';
import { useStore } from '../../store';
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

function FunnelIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </svg>
  );
}

function MobileFiltersButton() {
  const [open, setOpen] = useState(false);
  const filterCount = useStore(
    useShallow(
      (s) =>
        s.searchFilters.selectSubjects.length +
        s.searchFilters.selectSeasons.length +
        s.searchFilters.selectDays.length +
        s.catalogTypeFilters.length,
    ),
  );

  return (
    <>
      <button
        type="button"
        className={styles.filtersBtn}
        onClick={() => setOpen(true)}
      >
        <FunnelIcon />
        Filters
        {filterCount > 0 && (
          <span className={styles.filtersBadge}>{filterCount}</span>
        )}
      </button>
      <MobileFilterSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function CatalogNavSearch() {
  const { filters, setStartTime } = useSearch();
  const { courses } = useCoursePlanningCatalog();
  const {
    isMobile,
    isTablet,
    isSmDesktop,
    selectedSeasons,
    searchSelection,
    setSearchSelection,
  } = useStore(
    useShallow((s) => ({
      isMobile: s.isMobile,
      isTablet: s.isTablet,
      isSmDesktop: s.isSmDesktop,
      selectedSeasons: s.searchFilters.selectSeasons,
      searchSelection: s.catalogSearchSelection,
      setSearchSelection: s.setCatalogSearchSelection,
    })),
  );
  const { searchText } = filters;
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const listings = useMemo(() => {
    const seasons =
      selectedSeasons.length > 0
        ? selectedSeasons.map(({ value }) => value)
        : (Object.keys(courses) as Season[]);
    return seasons.flatMap((season) => [
      ...(courses[season]?.listings.values() ?? []),
    ]);
  }, [courses, selectedSeasons]);
  const suggestions = useMemo(
    () => buildCatalogSearchSuggestions(listings, searchText.value),
    [listings, searchText.value],
  );
  const showSuggestions = suggestionsOpen && suggestions.length > 0;
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (searchSelection && searchSelection.value !== searchText.value)
      setSearchSelection(null);
  }, [searchSelection, searchText.value, setSearchSelection]);
  const searchPrompt = isMobile
    ? 'Search'
    : isTablet
      ? 'Search any column'
      : isSmDesktop
        ? 'Search any column'
        : 'Search any column: code, title, instructor, time, or location';

  const selectSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    setSearchSelection(suggestion);
    searchText.set(suggestion.value);
    setStartTime(Date.now());
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>
          <SearchIcon />
        </span>
        <input
          type="text"
          className={styles.input}
          aria-label="Search courses"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions && activeSuggestion >= 0
              ? `${listboxId}-${activeSuggestion}`
              : undefined
          }
          value={searchText.value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchSelection(null);
            searchText.set(e.target.value);
            setStartTime(Date.now());
            setSuggestionsOpen(true);
            setActiveSuggestion(-1);
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setSuggestionsOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setSuggestionsOpen(false), 0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && suggestions.length > 0) {
              event.preventDefault();
              setSuggestionsOpen(true);
              setActiveSuggestion((current) =>
                current >= suggestions.length - 1 ? 0 : current + 1,
              );
            } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
              event.preventDefault();
              setSuggestionsOpen(true);
              setActiveSuggestion((current) =>
                current <= 0 ? suggestions.length - 1 : current - 1,
              );
            } else if (event.key === 'Enter' && activeSuggestion >= 0) {
              event.preventDefault();
              selectSuggestion(activeSuggestion);
            } else if (event.key === 'Escape') {
              setSuggestionsOpen(false);
              setActiveSuggestion(-1);
            }
          }}
        />
        {!searchText.value && (
          <span className={styles.placeholder} aria-hidden="true">
            {searchPrompt}
          </span>
        )}
        {searchText.value && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setSearchSelection(null);
              searchText.resetToEmpty();
              setStartTime(Date.now());
              setSuggestionsOpen(false);
              setActiveSuggestion(-1);
            }}
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        )}
        {showSuggestions && (
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- editable combobox suggestions require a custom listbox so selecting a value can preserve the search input's display and URL contract
          <div
            id={listboxId}
            className={styles.suggestions}
            role="listbox"
            aria-label="Search suggestions"
          >
            {suggestions.map((suggestion, index) => (
              // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- interactive custom combobox option, not a native select option
              <button
                key={`${suggestion.column}:${suggestion.label}`}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeSuggestion === index}
                className={clsx(
                  styles.suggestion,
                  activeSuggestion === index && styles.suggestionActive,
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSuggestion(index)}
                onFocus={() => setActiveSuggestion(index)}
                onClick={() => selectSuggestion(index)}
              >
                <span className={styles.suggestionLabel}>
                  {suggestion.label}
                </span>
                <span className={styles.suggestionColumn}>
                  {suggestion.column}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {isMobile && <MobileFiltersButton />}
    </div>
  );
}
