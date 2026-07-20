import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { FaSliders } from 'react-icons/fa6';

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
import WorksheetOptionsSheet from '../Worksheet/WorksheetOptionsSheet';
import styles from './TopNav.module.css';

type MobileSheet = 'navigation' | 'worksheet-options' | null;

export default function TopNav() {
  const isMobile = useStore((state) => state.isMobile);
  const location = useLocation();
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);

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
          <button
            type="button"
            className={styles.mobileWorksheetOptionsButton}
            onClick={() => setMobileSheet('worksheet-options')}
            aria-haspopup="dialog"
            aria-expanded={mobileSheet === 'worksheet-options'}
          >
            <FaSliders aria-hidden="true" />
            Options
          </button>
        )}

        <button
          type="button"
          className={clsx(
            styles.menuToggle,
            isWorksheetMobile && styles.menuToggleBoxed,
          )}
          onClick={() =>
            setMobileSheet((current) =>
              current === 'navigation' ? null : 'navigation',
            )
          }
          aria-label="Toggle navigation"
          aria-expanded={mobileSheet === 'navigation'}
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

        {isMobile ? (
          <MobileNavSheet
            open={mobileSheet === 'navigation'}
            onClose={() => setMobileSheet(null)}
          />
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

        {isWorksheetMobile && (
          <WorksheetOptionsSheet
            open={mobileSheet === 'worksheet-options'}
            onClose={() => setMobileSheet(null)}
          />
        )}
      </nav>
    </header>
  );
}
