import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import Authentication from '../images/authentication.svg';
import { isLegacyUserInfo } from '../queries/api';
import { useStore } from '../store';
import { PUBLIC_LOGIN_ENABLED } from '../utilities/publicLogin';

function NeedsLogin({
  redirect,
  message,
}: {
  readonly redirect: string;
  readonly message: string;
}) {
  const { authStatus, user } = useStore(
    useShallow((state) => ({ authStatus: state.authStatus, user: state.user })),
  );
  const hasLegacyEvaluationAccount = isLegacyUserInfo(user);
  const needsEvaluationChallenge = isLegacyUserInfo(user) && !user.hasEvals;
  return (
    <div className="text-center py-5">
      <h3>No access</h3>
      <div>
        {authStatus !== 'unauthenticated' && !hasLegacyEvaluationAccount ? (
          <>
            To access {message}, you need a legacy evaluation-enabled account.
            This feature is not available for UCSD email sign-in.
          </>
        ) : (
          <>
            To access {message}, you need to be a fully verified user. Please{' '}
            {authStatus === 'unauthenticated' && PUBLIC_LOGIN_ENABLED ? (
              <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                log in
              </Link>
            ) : authStatus === 'unauthenticated' ? (
              <>public sign-in is currently unavailable</>
            ) : needsEvaluationChallenge ? (
              <Link to="/challenge">complete the challenge</Link>
            ) : (
              <button type="button" onClick={() => window.location.reload()}>
                refresh the page
              </button>
            )}
            .
          </>
        )}
      </div>
      <img
        alt="Not logged in"
        className="py-5"
        src={Authentication}
        style={{ width: '25%' }}
      />
    </div>
  );
}

export default NeedsLogin;
