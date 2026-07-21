import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { FaBars, FaGear } from 'react-icons/fa6';

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
  const isPrivacyPage = location.pathname === '/privacypolicy';
  const isWorksheetMobile = isWorksheetPage && isMobile;

  return (
    <header className={styles.container}>
      <nav
        className={clsx(
          styles.topRow,
          (showCatalogSearch || isWorksheetPage) && styles.topRowPrimary,
          isPrivacyPage && styles.privacyTopRow,
        )}
      >
        <NavLink
          to="/"
          className={styles.logoLink}
          onClick={scrollToTop}
          aria-label="SunGrid home"
        >
          <Logo className={isPrivacyPage ? styles.privacyLogo : undefined} />
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
            <FaGear aria-hidden="true" />
            Options
          </button>
        )}

        <button
          type="button"
          className={styles.menuToggle}
          onClick={() =>
            setMobileSheet((current) =>
              current === 'navigation' ? null : 'navigation',
            )
          }
          aria-label="Toggle navigation"
          aria-expanded={mobileSheet === 'navigation'}
        >
          <FaBars size={18} aria-hidden="true" />
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
