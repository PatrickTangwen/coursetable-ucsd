import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

import { LogoMark } from '../components/landing/icons';
import { requestUcsdVerification, verifyUcsdEmail } from '../queries/api';
import { useStore } from '../store';
import { createCatalogLink } from '../utilities/navigation';
import styles from './SignIn.module.css';

const CODE_LENGTH = 6;
const emptyCode = () => Array<string>(CODE_LENGTH).fill('');
const isValidEmail = (email: string) => {
  const at = email.indexOf('@');
  return at > 0 && at < email.length - 1 && !email.includes(' ');
};

// One-character-per-box code entry: typing advances, backspace on an empty
// box retreats. Desktop card and mobile hero each render their own instance
// over the same shared code state.
function CodeInputs({
  code,
  onCode,
  onComplete,
  className,
}: {
  readonly code: readonly string[];
  readonly onCode: (next: string[]) => void;
  readonly onComplete: () => void;
  readonly className: string | undefined;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className={styles.codeRow}>
      {code.map((digit, i) => (
        <input
          // The boxes are positional and never reorder

          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={className}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Code digit ${i + 1}`}
          value={digit}
          onChange={(event) => {
            const value = event.target.value.replaceAll(/\D/gu, '').slice(-1);
            const next = [...code];
            next[i] = value;
            onCode(next);
            if (value) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !code[i])
              refs.current[i - 1]?.focus();
            else if (event.key === 'Enter' && code.every(Boolean)) onComplete();
          }}
        />
      ))}
    </div>
  );
}

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const refreshAuth = useStore((state) => state.refreshAuth);

  // The landing page CTA can hand off an email typed there
  const [email, setEmail] = useState(
    (location.state as { email?: string } | null)?.email ?? '',
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sentEmail, setSentEmail] = useState('');
  const [code, setCode] = useState(emptyCode());
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const emailDesktopRef = useRef<HTMLInputElement>(null);
  const emailMobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const emailValid = isValidEmail(email);
  const codeFilled = code.every(Boolean);

  // The header/footer "Log in" links point at the form itself
  const focusEmail = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    closeMenu();
    const target = [emailDesktopRef.current, emailMobileRef.current].find(
      (el) => el && el.offsetParent !== null,
    );
    target?.focus();
  };

  const requestCode = async (targetEmail: string) => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await requestUcsdVerification(targetEmail);
      if (result.status === 'sent') {
        setSentEmail(result.email);
        setEmail(result.email);
        setDevCode(result.devCode);
        setCode(emptyCode());
        setStep(2);
      } else if (result.status === 'rejected') {
        setError(result.message);
      } else {
        setError('Could not request a verification code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEmail = () => {
    if (emailValid) void requestCode(email);
  };

  const verify = async () => {
    if (!codeFilled || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await verifyUcsdEmail(sentEmail, code.join(''));
      if (result.status === 'authenticated') setStep(3);
      else if (result.status === 'rejected') setError(result.message);
      else setError('Could not complete verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToCatalog = async () => {
    // Deferred to here so the done step isn't unmounted by the authenticated
    // redirect on /login the moment verification succeeds
    await refreshAuth();
    void navigate(createCatalogLink(), { replace: true });
  };

  const back = () => {
    setStep(1);
    setCode(emptyCode());
    setError('');
  };

  const emailDisplay = sentEmail || 'your UCSD email';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logoLink} title="SunGrid">
            <LogoMark className={styles.logoSvg} />
          </Link>
          <nav className={styles.nav}>
            <Link to={createCatalogLink()} className={styles.navLink}>
              Catalog
            </Link>
            <Link to="/worksheet" className={styles.navLink}>
              Worksheet
            </Link>
            <a href="/#how" className={styles.navLink}>
              How it works
            </a>
          </nav>
          <div className={styles.spacer} />
          <a
            href="#email"
            className={clsx(styles.navLink, styles.authBtn)}
            onClick={focusEmail}
          >
            Log in
          </a>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="signin-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuBars} />
          </button>
        </div>
        {menuOpen && (
          <>
            <button
              type="button"
              className={styles.menuBackdrop}
              aria-label="Close menu"
              tabIndex={-1}
              onClick={closeMenu}
            />
            <nav id="signin-mobile-menu" className={styles.mobileMenu}>
              <Link
                to={createCatalogLink()}
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                Catalog
              </Link>
              <Link
                to="/worksheet"
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                Worksheet
              </Link>
              <a
                href="/#how"
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                How it works
              </a>
            </nav>
          </>
        )}
      </header>

      {/* ═══ Split body (desktop / tablet) ═══ */}
      <div className={styles.splitBody}>
        <div className={styles.rail}>
          <div className={styles.railDots} />
          <div className={styles.railMark}>S</div>
          <div className={styles.railCopy}>
            <h1 className={styles.railH1}>
              Plan your quarter
              <br />
              in one place
            </h1>
            <p className={styles.railDesc}>
              Start searching in seconds — no account required. Sign in with a
              UCSD email whenever you want to save your work.
            </p>
          </div>
          <div className={styles.railStats}>
            <div>
              <div className={styles.railStatNum}>8,500+</div>
              <div className={styles.railStatLabel}>courses indexed</div>
            </div>
            <div>
              <div className={styles.railStatNum}>185</div>
              <div className={styles.railStatLabel}>departments live</div>
            </div>
          </div>
        </div>

        <div className={styles.formSide}>
          <div className={styles.card} key={step}>
            {step === 1 && (
              <div className={styles.cardStack}>
                <div className={styles.cardHeading}>
                  <h2 className={styles.cardH2}>
                    Sign in with your school&nbsp;email
                  </h2>
                  <p className={styles.cardDesc}>
                    Saved Worksheets use a verified email. Catalog and Worksheet
                    stay open without one.
                  </p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="signin-email">
                    UCSD email
                  </label>
                  <input
                    id="signin-email"
                    ref={emailDesktopRef}
                    className={styles.textInput}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitEmail();
                    }}
                    placeholder="student@ucsd.edu"
                    autoComplete="email"
                  />
                </div>
                <button
                  type="button"
                  className={clsx(
                    styles.primaryBtn,
                    (!emailValid || isSubmitting) && styles.primaryBtnDisabled,
                  )}
                  disabled={isSubmitting}
                  onClick={submitEmail}
                >
                  {isSubmitting ? 'Sending…' : 'Send verification code'}
                </button>
                {error && <p className={styles.formError}>{error}</p>}
                <div className={styles.orRow}>
                  <div className={styles.orLine} />
                  <span className={styles.orLabel}>OR</span>
                  <div className={styles.orLine} />
                </div>
                <Link to={createCatalogLink()} className={styles.ghostBtn}>
                  Continue without signing in →
                </Link>
              </div>
            )}

            {step === 2 && (
              <div className={styles.cardStack}>
                <button type="button" className={styles.backBtn} onClick={back}>
                  ← Use a different email
                </button>
                <div className={styles.cardHeading}>
                  <h2 className={styles.cardH2}>Enter your code</h2>
                  <p className={styles.cardDesc}>
                    We sent a 6-digit code to{' '}
                    <strong className={styles.cardDescStrong}>
                      {emailDisplay}
                    </strong>
                    .
                  </p>
                </div>
                <CodeInputs
                  code={code}
                  onCode={setCode}
                  onComplete={() => {
                    void verify();
                  }}
                  className={styles.codeInput}
                />
                <button
                  type="button"
                  className={clsx(
                    styles.primaryBtn,
                    (!codeFilled || isSubmitting) && styles.primaryBtnDisabled,
                  )}
                  disabled={isSubmitting}
                  onClick={() => {
                    void verify();
                  }}
                >
                  {isSubmitting ? 'Verifying…' : 'Verify & sign in'}
                </button>
                {error && <p className={styles.formError}>{error}</p>}
                <div className={styles.resendRow}>
                  Didn't receive it?{' '}
                  <button
                    type="button"
                    className={styles.resendBtn}
                    disabled={isSubmitting}
                    onClick={() => {
                      void requestCode(sentEmail);
                    }}
                  >
                    Resend code
                  </button>
                </div>
                {devCode && (
                  <p className={styles.devHint}>Development code: {devCode}</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className={styles.doneStack}>
                <div className={styles.doneBadge}>
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#185FA5"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className={styles.cardHeading}>
                  <h2 className={styles.doneH2}>You're signed in</h2>
                  <p className={styles.cardDesc}>
                    Signed in as{' '}
                    <strong className={styles.cardDescStrong}>
                      {emailDisplay}
                    </strong>
                    . Your searches will sync from here on.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    void goToCatalog();
                  }}
                >
                  Go to Catalog →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Mobile hero card (≤640px) ═══ */}
      <div className={styles.mobileHero}>
        <div className={styles.mobileHeroPad}>
          <div className={styles.mobileCard} key={step}>
            <div className={styles.mobileDots} />
            <div className={styles.mobileMark}>S</div>

            {step === 1 && (
              <>
                <div className={styles.mobileCopy}>
                  <h2 className={styles.mobileH2}>
                    Plan your quarter
                    <br />
                    in one place
                  </h2>
                  <p className={styles.mobileDesc}>
                    Start searching in seconds — no account required. Verify
                    your school email whenever you want to save your work.
                  </p>
                </div>
                <div className={styles.mobilePill}>
                  <input
                    ref={emailMobileRef}
                    className={styles.mobileEmailInput}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitEmail();
                    }}
                    placeholder="student@ucsd.edu"
                    autoComplete="email"
                    aria-label="UCSD email"
                  />
                  <button
                    type="button"
                    className={clsx(
                      styles.mobileSubmit,
                      (!emailValid || isSubmitting) && styles.mobileBtnDim,
                    )}
                    disabled={isSubmitting}
                    onClick={submitEmail}
                  >
                    {isSubmitting ? 'Sending…' : 'Get started'}
                  </button>
                </div>
                {error && <p className={styles.mobileError}>{error}</p>}
                <Link to={createCatalogLink()} className={styles.mobileBrowse}>
                  Browse without an account →
                </Link>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  className={styles.mobileBack}
                  onClick={back}
                >
                  ← Use a different email
                </button>
                <div className={styles.mobileCopy}>
                  <h2 className={styles.mobileCodeH2}>Enter your code</h2>
                  <p className={styles.mobileDesc}>
                    We sent a 6-digit code to{' '}
                    <strong className={styles.mobileDescStrong}>
                      {emailDisplay}
                    </strong>
                    .
                  </p>
                </div>
                <CodeInputs
                  code={code}
                  onCode={setCode}
                  onComplete={() => {
                    void verify();
                  }}
                  className={styles.mobileCodeInput}
                />
                <button
                  type="button"
                  className={clsx(
                    styles.mobileVerify,
                    (!codeFilled || isSubmitting) && styles.mobileBtnDim,
                  )}
                  disabled={isSubmitting}
                  onClick={() => {
                    void verify();
                  }}
                >
                  {isSubmitting ? 'Verifying…' : 'Verify & sign in'}
                </button>
                {error && <p className={styles.mobileError}>{error}</p>}
                <div className={styles.mobileResendRow}>
                  Didn't receive it?{' '}
                  <button
                    type="button"
                    className={styles.mobileResendBtn}
                    disabled={isSubmitting}
                    onClick={() => {
                      void requestCode(sentEmail);
                    }}
                  >
                    Resend code
                  </button>
                </div>
                {devCode && (
                  <p className={styles.mobileDevHint}>
                    Development code: {devCode}
                  </p>
                )}
              </>
            )}

            {step === 3 && (
              <div className={styles.mobileDoneStack}>
                <div className={styles.mobileDoneBadge}>
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className={styles.mobileCopy}>
                  <h2 className={styles.mobileDoneH2}>You're signed in</h2>
                  <p className={styles.mobileDesc}>
                    Signed in as{' '}
                    <strong className={styles.mobileDescStrong}>
                      {emailDisplay}
                    </strong>
                    . Your searches will sync from here on.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.mobileDoneBtn}
                  onClick={() => {
                    void goToCatalog();
                  }}
                >
                  Go to Catalog →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Footer (≤640px) ═══ */}
      <footer className={styles.mobileFooter}>
        <div className={styles.mobileFooterInner}>
          <Link to="/" className={styles.footerLogo}>
            SunGrid
          </Link>
          <nav className={styles.footerNav}>
            <Link to={createCatalogLink()} className={styles.footerLink}>
              Catalog
            </Link>
            <Link to="/worksheet" className={styles.footerLink}>
              Worksheet
            </Link>
            <a href="/#how" className={styles.footerLink}>
              How it works
            </a>
            <a href="#email" className={styles.footerLink} onClick={focusEmail}>
              Log in
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default SignIn;
