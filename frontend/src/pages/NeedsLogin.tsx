import { Link } from 'react-router-dom';
import Authentication from '../images/authentication.svg';
import { useStore } from '../store';
import { PUBLIC_LOGIN_ENABLED } from '../utilities/publicLogin';

function NeedsLogin({
  redirect,
  message,
}: {
  readonly redirect: string;
  readonly message: string;
}) {
  const authStatus = useStore((state) => state.authStatus);
  return (
    <div className="text-center py-5">
      <h3>No access</h3>
      <div>
        {authStatus !== 'unauthenticated' ? (
          <>
            To access {message}, you need a legacy evaluation-enabled account.
            This feature is not available for UCSD email sign-in.
          </>
        ) : (
          <>
            To access {message}, you need to be a fully verified user. Please{' '}
            {PUBLIC_LOGIN_ENABLED ? (
              <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                log in
              </Link>
            ) : (
              <>public sign-in is currently unavailable</>
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
