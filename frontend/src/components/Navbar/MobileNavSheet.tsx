import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { FaCalendarCheck } from 'react-icons/fa6';
import { useShallow } from 'zustand/react/shallow';
import { logout } from '../../queries/api';
import { useStore } from '../../store';
import { scrollToTop } from '../../utilities/display';
import { createCatalogLink } from '../../utilities/navigation';
import {
  PUBLIC_LOGIN_ENABLED,
  shouldShowPublicLoginEntry,
} from '../../utilities/publicLogin';
import BottomSheet from '../BottomSheet';
import styles from './MobileNavSheet.module.css';

function CatalogIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function NavSheetLink({
  to,
  label,
  icon,
  onNavigate,
}: {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onNavigate: (e: React.MouseEvent) => void;
}) {
  return (
    <NavLink to={to} className={styles.item} onClick={onNavigate}>
      {({ isActive }) => (
        <>
          <span
            className={clsx(styles.itemIcon, isActive && styles.itemIconActive)}
          >
            {icon}
          </span>
          <span
            className={clsx(
              styles.itemLabel,
              isActive && styles.itemLabelActive,
            )}
          >
            {label}
          </span>
          {isActive && <span className={styles.activeDot} />}
        </>
      )}
    </NavLink>
  );
}

export default function MobileNavSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const { authStatus, refreshAuth, theme, setTheme } = useStore(
    useShallow((state) => ({
      authStatus: state.authStatus,
      refreshAuth: state.refreshAuth,
      theme: state.theme,
      setTheme: state.setTheme,
    })),
  );

  const handleNavigate = (e: React.MouseEvent) => {
    scrollToTop(e);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} className={styles.navSheet}>
      <nav aria-label="Site menu">
        <NavSheetLink
          to={createCatalogLink()}
          label="Catalog"
          icon={<CatalogIcon />}
          onNavigate={handleNavigate}
        />
        <NavSheetLink
          to="/worksheet"
          label="Worksheet"
          icon={<FaCalendarCheck size={17} aria-hidden="true" />}
          onNavigate={handleNavigate}
        />
        {shouldShowPublicLoginEntry(
          authStatus === 'authenticated',
          PUBLIC_LOGIN_ENABLED,
        ) && (
          <button
            type="button"
            className={styles.item}
            onClick={
              authStatus !== 'authenticated'
                ? () => {
                    window.location.href = '/login';
                  }
                : async () => {
                    await logout();
                    await refreshAuth();
                    window.location.href = '/';
                  }
            }
          >
            <span className={styles.itemIcon}>
              <UserIcon />
            </span>
            <span className={styles.itemLabel}>
              {authStatus !== 'authenticated' ? 'Sign in' : 'Sign out'}
            </span>
          </button>
        )}

        <div className={styles.divider} />

        <div className={styles.appearanceRow}>
          <span className={styles.appearanceLabel}>Appearance</span>
          <div className={styles.segment}>
            <button
              type="button"
              className={clsx(
                styles.segmentBtn,
                theme === 'light' && styles.segmentBtnActive,
              )}
              onClick={() => setTheme('light')}
            >
              <SunIcon />
              Light
            </button>
            <button
              type="button"
              className={clsx(
                styles.segmentBtn,
                theme === 'dark' && styles.segmentBtnActive,
              )}
              onClick={() => setTheme('dark')}
            >
              <MoonIcon />
              Dark
            </button>
          </div>
        </div>
      </nav>
    </BottomSheet>
  );
}
