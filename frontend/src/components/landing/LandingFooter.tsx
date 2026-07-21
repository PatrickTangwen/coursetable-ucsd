import { Link, useLocation } from 'react-router-dom';
import { FAQ_URL } from './links';
import { createCatalogLink } from '../../utilities/navigation';
import { PUBLIC_LOGIN_ENABLED } from '../../utilities/publicLogin';
import styles from './LandingFooter.module.css';

export default function LandingFooter({
  publicLoginEnabled = PUBLIC_LOGIN_ENABLED,
}: {
  readonly publicLoginEnabled?: boolean;
}) {
  const location = useLocation();
  const onLandingPage = location.pathname === '/';

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <a href={onLandingPage ? '#top' : '/'} className={styles.footerLogo}>
          SunGrid
        </a>
        <nav className={styles.footerNav} aria-label="Footer">
          <Link to={createCatalogLink()} className={styles.footerLink}>
            Catalog
          </Link>
          <a
            href={onLandingPage ? '#worksheet' : '/#worksheet'}
            className={styles.footerLink}
          >
            Worksheet
          </a>
          <a
            href={onLandingPage ? '#how' : '/#how'}
            className={styles.footerLink}
          >
            How it works
          </a>
          <a
            href={FAQ_URL}
            className={styles.footerLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            FAQ
          </a>
          <Link to="/privacypolicy" className={styles.footerLink}>
            Privacy Policy
          </Link>
          {publicLoginEnabled && (
            <Link to="/login" className={styles.footerLink}>
              Sign in
            </Link>
          )}
        </nav>
        <div className={styles.spacer} />
      </div>
    </footer>
  );
}
