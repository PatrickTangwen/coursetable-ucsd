import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

import DarkModeButton from './DarkModeButton';
import Logo from './Logo';
import MeDropdown from './MeDropdown';
import MobileNavSheet from './MobileNavSheet';
import { useStore } from '../../store';
import { scrollToTop } from '../../utilities/display';
import { createCatalogLink } from '../../utilities/navigation';
import CatalogNavSearch, {
  CatalogResultCount,
} from '../Catalog/CatalogNavSearch';
import { NavbarWorksheetSearch } from '../Worksheet/NavbarWorksheetSearch';
import WorksheetMobileMenu from '../Worksheet/WorksheetMobileMenu';
import styles from './TopNav.module.css';

export default function TopNav() {
  const isMobile = useStore((state) => state.isMobile);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showCatalogSearch = location.pathname === '/catalog';
  const isWorksheetPage = location.pathname === '/worksheet';
  const isWorksheetMobile = isWorksheetPage && isMobile;

  return (
    <header className={styles.container}>
      <nav
        className={clsx(
          styles.topRow,
          (showCatalogSearch || isWorksheetPage) && styles.topRowPrimary,
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
        {isWorksheetPage && !isMobile && (
          <div className={styles.searchArea}>
            <NavbarWorksheetSearch isMobile={false} />
          </div>
        )}

        {(!isWorksheetPage || isWorksheetMobile) && (
          <div className={styles.spacer} />
        )}

        {showCatalogSearch && <CatalogResultCount />}

        {isWorksheetMobile && (
          <NavLink
            to={createCatalogLink()}
            className={styles.mobileCatalogLink}
            onClick={scrollToTop}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Catalog
          </NavLink>
        )}

        <button
          type="button"
          className={clsx(
            styles.menuToggle,
            isWorksheetMobile && styles.menuToggleBoxed,
          )}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {isWorksheetMobile ? (
          menuOpen && (
            <>
              <button
                type="button"
                className={styles.mobileMenuBackdrop}
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className={styles.mobileMenuPanel}>
                <WorksheetMobileMenu onClose={() => setMenuOpen(false)} />
              </div>
            </>
          )
        ) : isMobile ? (
          <MobileNavSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
        ) : (
          <div className={styles.navActions}>
            <DarkModeButton className={styles.settingsBtn} />
            <NavLink
              to={createCatalogLink()}
              className={({ isActive }) =>
                clsx(styles.navTab, isActive && styles.navTabActive)
              }
              onClick={scrollToTop}
              data-label="Catalog"
            >
              Catalog
            </NavLink>
            <NavLink
              to="/worksheet"
              className={({ isActive }) =>
                clsx(styles.navTab, isActive && styles.navTabActive)
              }
              onClick={scrollToTop}
              data-tutorial="worksheet-1"
              data-label="Worksheet"
            >
              Worksheet
            </NavLink>
            <MeDropdown />
          </div>
        )}
      </nav>
    </header>
  );
}
