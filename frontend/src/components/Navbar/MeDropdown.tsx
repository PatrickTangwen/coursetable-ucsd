import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FcBusinessman } from 'react-icons/fc';

import { isLegacyUserInfo, logout } from '../../queries/api';
import { useStore } from '../../store';
import {
  PUBLIC_LOGIN_ENABLED,
  shouldShowPublicLoginEntry,
} from '../../utilities/publicLogin';
import styles from './MeDropdown.module.css';

function PersonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#a32d2d"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.itemIcon}
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#185fa5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.itemIcon}
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function MeDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const authStatus = useStore((state) => state.authStatus);
  const user = useStore((state) => state.user);
  const refreshAuth = useStore((state) => state.refreshAuth);
  const hasLegacyProfile = isLegacyUserInfo(user);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const title =
    user?.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : ((!isLegacyUserInfo(user) ? user?.verifiedEmail : undefined) ??
        'Your profile');

  if (
    !shouldShowPublicLoginEntry(
      authStatus === 'authenticated',
      PUBLIC_LOGIN_ENABLED,
    )
  )
    return null;

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => setOpen((x) => !x)}
        aria-label="Profile"
        aria-expanded={open}
        title={title}
      >
        <PersonIcon />
      </button>
      {open && (
        <div className={styles.menu}>
          {authStatus === 'authenticated' && hasLegacyProfile && (
            <NavLink
              to="/profile"
              className={styles.menuItem}
              onClick={() => setOpen(false)}
            >
              <FcBusinessman size={17} className={styles.itemIcon} />
              Profile (beta)
            </NavLink>
          )}
          {authStatus === 'authenticated' ? (
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={async () => {
                setOpen(false);
                await logout();
                await refreshAuth();
                window.location.href = '/';
              }}
            >
              <SignOutIcon />
              Sign out
            </button>
          ) : PUBLIC_LOGIN_ENABLED ? (
            <a
              href="/login"
              className={styles.menuItem}
              onClick={() => setOpen(false)}
            >
              <SignInIcon />
              Sign in
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default MeDropdown;
