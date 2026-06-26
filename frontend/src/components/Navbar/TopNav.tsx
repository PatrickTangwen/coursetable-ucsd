import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

import DarkModeButton from './DarkModeButton';
import Logo from './Logo';
import MeDropdown from './MeDropdown';
import { logout } from '../../queries/api';
import { useStore } from '../../store';
import { scrollToTop } from '../../utilities/display';
import { createCatalogLink } from '../../utilities/navigation';
import CatalogNavSearch from '../Catalog/CatalogNavSearch';
import { NavbarWorksheetSearch } from '../Worksheet/NavbarWorksheetSearch';
import styles from './TopNav.module.css';

export default function TopNav() {
  const authStatus = useStore((state) => state.authStatus);
  const refreshAuth = useStore((state) => state.refreshAuth);
  const isMobile = useStore((state) => state.isMobile);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showCatalogSearch = !isMobile && location.pathname === '/catalog';
  const isWorksheetPage = location.pathname === '/worksheet';

  return (
    <header className={styles.container}>
      <nav
        className={clsx(
          styles.topRow,
          showCatalogSearch && styles.topRowCatalog,
        )}
      >
        <NavLink
          to="/"
          className={styles.logoLink}
          onClick={scrollToTop}
          aria-label="SunGrid home"
        >
          <Logo />
        </NavLink>

        {showCatalogSearch && <CatalogNavSearch />}
        {isWorksheetPage && (
          <div className={styles.searchArea}>
            <NavbarWorksheetSearch isMobile={isMobile} />
          </div>
        )}

        {!showCatalogSearch && !isWorksheetPage && (
          <div className={styles.spacer} />
        )}

        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div
          className={clsx(styles.navActions, menuOpen && styles.navActionsOpen)}
        >
          <DarkModeButton className={styles.settingsBtn} />
          <NavLink
            to={createCatalogLink()}
            className={({ isActive }) =>
              clsx(styles.navTab, isActive && styles.navTabActive)
            }
            onClick={(e) => {
              scrollToTop(e);
              setMenuOpen(false);
            }}
          >
            Catalog
          </NavLink>
          <NavLink
            to="/worksheet"
            className={({ isActive }) =>
              clsx(styles.navTab, isActive && styles.navTabActive)
            }
            onClick={(e) => {
              scrollToTop(e);
              setMenuOpen(false);
            }}
            data-tutorial="worksheet-1"
          >
            Worksheet
          </NavLink>
          {isMobile ? (
            <button
              type="button"
              className={styles.navTab}
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
              {authStatus !== 'authenticated' ? 'Sign in (beta)' : 'Sign out'}
            </button>
          ) : (
            <MeDropdown />
          )}
        </div>
      </nav>
    </header>
  );
}
