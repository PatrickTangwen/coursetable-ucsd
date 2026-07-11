import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Modal, Button } from 'react-bootstrap';
import { MdDelete, MdSavedSearch } from 'react-icons/md';
import { toast } from 'sonner';

import { Popout } from './Popout';
import { useSearch } from '../../hooks/useSearch';
import {
  fetchSavedSearches,
  deleteSavedSearch,
  createSavedSearch,
  type SavedSearch,
} from '../../queries/api';
import { defaultFilters } from '../../search/searchConstants';
import { getFilterValues } from '../../search/searchTypes';
import { useStore } from '../../store';
import {
  buildSavedSearchQueryString,
  sanitizeSavedSearchQueryString,
} from '../../utilities/params';
import { PUBLIC_LOGIN_ENABLED } from '../../utilities/publicLogin';
import Spinner from '../Spinner';
import { Input } from '../Typography';
import styles from './SavedSearchesDropdown.module.css';

interface SavedSearchesDropdownProps {
  readonly onSearchApplied?: () => void;
  readonly refreshKey?: number;
}

const savedCatalogFilterKeys = new Set([
  'searchText',
  'selectSubjects',
  'selectSkillsAreas',
  'selectDays',
  'timeBounds',
  'numBounds',
  'selectSchools',
  'selectCredits',
  'selectCourseInfoAttributes',
  'selectBuilding',
  'searchDescription',
  'hideCancelled',
  'hideConflicting',
  'includeAttributes',
  'excludeAttributes',
  'intersectingFilters',
  'selectSortBy',
  'sortOrder',
]);

const savedCatalogSorts = new Set([
  'course_code',
  'title',
  'last_modified',
  'added',
  'time',
  'location',
]);

function sanitizeCatalogSavedSearchQueryString(queryString: string) {
  const sanitized = sanitizeSavedSearchQueryString(queryString, defaultFilters);
  const params = new URLSearchParams(
    sanitized.startsWith('?') ? sanitized.slice(1) : sanitized,
  );

  for (const key of [...params.keys()])
    if (!savedCatalogFilterKeys.has(key)) params.delete(key);

  const sortBy = params.get('selectSortBy');
  if (sortBy && !savedCatalogSorts.has(sortBy)) {
    params.delete('selectSortBy');
    params.delete('sortOrder');
  }

  const next = params.toString();
  return next ? `?${next}` : '';
}

export default function SavedSearchesDropdown({
  onSearchApplied,
  refreshKey = 0,
}: SavedSearchesDropdownProps) {
  const navigate = useNavigate();
  const authStatus = useStore((state) => state.authStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isAddingSearch, setIsAddingSearch] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [addingName, setAddingName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);
  const { filters } = useSearch();
  const defaultSavedSearchName = filters.searchText.value.trim();
  const isSignedIn = authStatus === 'authenticated';

  useEffect(() => {
    if (isAddingSearch && addInputRef.current) addInputRef.current.focus();
  }, [isAddingSearch]);

  const loadSearches = useCallback(async () => {
    if (!isSignedIn) {
      setSearches([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchSavedSearches();
      if (result) setSearches(result.data);
      else setSearches([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isSignedIn) {
      setSearches([]);
      setIsLoading(false);
      return;
    }
    void loadSearches();
  }, [isOpen, isSignedIn, refreshKey, loadSearches]);

  const handleApplySearch = (search: SavedSearch) => {
    const queryString = sanitizeCatalogSavedSearchQueryString(
      search.queryString,
    );
    void navigate(`/catalog${queryString}`);
    toast.success(`Filters from ${search.name} applied`);
    onSearchApplied?.();
  };

  const cancelAddingSearch = () => {
    if (saveInFlightRef.current) return;
    setAddingName('');
    setIsAddingSearch(false);
  };

  const finishSavingSearch = () => {
    saveInFlightRef.current = false;
    setIsSavingSearch(false);
  };

  const saveCurrentSearch = async (rawName: string) => {
    if (!isSignedIn) return;

    const name = rawName.trim();
    if (!name || saveInFlightRef.current) return;

    if (searches.some((search) => search.name === name)) {
      toast.error('A saved search with this name already exists');
      return;
    }

    saveInFlightRef.current = true;
    setIsSavingSearch(true);
    try {
      const filterValues = getFilterValues(filters);
      const queryString = sanitizeCatalogSavedSearchQueryString(
        buildSavedSearchQueryString(filterValues, defaultFilters),
      );
      const result = await createSavedSearch(name, queryString);
      if (result) {
        toast.success('Search saved');
        setAddingName('');
        setIsAddingSearch(false);
        await loadSearches();
      }
    } catch (err: unknown) {
      Sentry.captureException(err);
    } finally {
      finishSavingSearch();
    }
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    searchId: number,
    searchName: string,
  ) => {
    e.stopPropagation();
    setDeleteConfirm({ id: searchId, name: searchName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !isSignedIn) return;

    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    setDeletingId(id);
    try {
      const success = await deleteSavedSearch(id);
      if (success) {
        toast.success('Saved search deleted');
        setSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Popout
        ariaLabel="Saved Filters / Searches"
        Icon={<MdSavedSearch size={18} />}
        className={styles.savedSearchTrigger}
        tooltipText="Saved Filters / Searches"
        onOpenChange={setIsOpen}
      >
        <div className={styles.container}>
          <h3 className={styles.dropdownTitle}>Saved Filters / Searches</h3>
          <p className={styles.dropdownDescription}>
            Signed-in users can save current catalog search text and supported
            filters for later.
          </p>
          {!isSignedIn ? (
            <div className={styles.signInRequired}>
              <p>Sign in required.</p>
              <p className={styles.emptyHint}>
                Search and filtering still work without an account; saving a
                search is a signed-in feature.
              </p>
              {PUBLIC_LOGIN_ENABLED && (
                <a className={styles.signInButton} href="/login">
                  Sign in to save searches
                </a>
              )}
            </div>
          ) : (
            <>
              {isAddingSearch ? (
                <div className={styles.addInputContainer}>
                  <div className={styles.addInputRow}>
                    <Input
                      className={styles.addInput}
                      type="text"
                      value={addingName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAddingName(e.target.value)
                      }
                      placeholder="Name this search..."
                      maxLength={64}
                      ref={addInputRef}
                      disabled={isSavingSearch}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void saveCurrentSearch(addingName);
                        } else if (e.key === 'Escape') {
                          cancelAddingSearch();
                        }
                      }}
                      onMouseDown={(e: React.MouseEvent<HTMLInputElement>) =>
                        e.stopPropagation()
                      }
                      onBlur={cancelAddingSearch}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingSearch || !addingName.trim()}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        void saveCurrentSearch(addingName);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className={styles.saveButton}
                  onClick={() => {
                    setAddingName(defaultSavedSearchName);
                    setIsAddingSearch(true);
                  }}
                  title="Save current search"
                >
                  Save current filters / search
                </Button>
              )}
              {isLoading ? (
                <div className={styles.loading}>
                  <Spinner message="Loading saved searches..." />
                </div>
              ) : searches.length === 0 ? (
                <div className={styles.empty}>
                  <p>No saved filters or searches yet.</p>
                  <p className={styles.emptyHint}>
                    Save your current filters to quickly return to them later.
                  </p>
                </div>
              ) : (
                <div className={styles.searchList}>
                  {searches.map((search) => (
                    <div key={search.id} className={styles.searchItem}>
                      <button
                        type="button"
                        className={styles.applyButton}
                        onClick={() => handleApplySearch(search)}
                      >
                        <span className={styles.searchName}>{search.name}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={(e) =>
                          handleDeleteClick(e, search.id, search.name)
                        }
                        disabled={deletingId === search.id}
                        title="Delete saved search"
                        aria-label={`Delete ${search.name}`}
                      >
                        {deletingId === search.id ? (
                          <Spinner
                            className={styles.spinner}
                            message={undefined}
                          />
                        ) : (
                          <MdDelete size={18} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Popout>
      <Modal
        show={deleteConfirm !== null}
        onHide={() => setDeleteConfirm(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete saved search?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteConfirm && (
            <>
              Are you sure you want to delete &quot;{deleteConfirm.name}&quot;?
              This cannot be undone.
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void handleDeleteConfirm().catch((err: unknown) => {
                Sentry.captureException(err);
              });
            }}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
