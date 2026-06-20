import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { requestUcsdVerification, verifyUcsdEmail } from '../queries/api';
import { useStore } from '../store';
import { createCatalogLink } from '../utilities/navigation';
import styles from './Landing.module.css';

function Landing() {
  const navigate = useNavigate();
  const refreshAuth = useStore((state) => state.refreshAuth);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCodeStep = Boolean(verifiedEmail);

  const requestCode = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setErrorText('');
    setStatusText('');
    setIsSubmitting(true);
    try {
      const result = await requestUcsdVerification(email);
      if (result.status === 'sent') {
        setVerifiedEmail(result.email);
        setEmail(result.email);
        setDevCode(result.devCode);
        setStatusText(`Verification code sent to ${result.email}.`);
      } else if (result.status === 'rejected') {
        setErrorText(result.message);
      } else {
        setErrorText('Could not request a verification code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setErrorText('');
    setIsSubmitting(true);
    try {
      const result = await verifyUcsdEmail(verifiedEmail, code);
      if (result.status === 'authenticated') {
        toast.success('Signed in with verified UCSD email');
        await refreshAuth();
        void navigate(createCatalogLink(), { replace: true });
      } else if (result.status === 'rejected') {
        setErrorText(result.message);
      } else {
        setErrorText('Could not complete verification.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel}>
        <div className={styles.loginHeader}>
          <p className={styles.eyebrow}>UCSD account beta</p>
          <h1>Sign in with UCSD email</h1>
          <p>
            Catalog search and Anonymous Worksheet still work without an
            account. Saved Searches use a verified UCSD email.
          </p>
        </div>

        <form
          className={styles.loginForm}
          onSubmit={isCodeStep ? verifyCode : requestCode}
        >
          <label>
            UCSD email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@ucsd.edu"
              disabled={isSubmitting || isCodeStep}
              autoComplete="email"
              required
            />
          </label>

          {isCodeStep && (
            <label>
              Verification code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                disabled={isSubmitting}
                autoComplete="one-time-code"
                required
              />
            </label>
          )}

          {statusText && <p className={styles.statusText}>{statusText}</p>}
          {devCode && (
            <p className={styles.devCode}>Development code: {devCode}</p>
          )}
          {errorText && <p className={styles.errorText}>{errorText}</p>}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Working...'
                : isCodeStep
                  ? 'Verify and sign in'
                  : 'Send verification code'}
            </button>
            {isCodeStep && (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isSubmitting}
                onClick={() => {
                  setVerifiedEmail('');
                  setCode('');
                  setDevCode(undefined);
                  setStatusText('');
                  setErrorText('');
                }}
              >
                Use another email
              </button>
            )}
          </div>
        </form>

        <Link className={styles.guestLink} to={createCatalogLink()}>
          Continue without signing in
        </Link>
      </section>
    </main>
  );
}

export default Landing;
