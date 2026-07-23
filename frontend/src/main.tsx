import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { enableMapSet, setAutoFreeze } from 'immer';

// Globals has to be imported first, because it contains all the base CSS!
// eslint-disable-next-line import-x/order
import Globals from './Globals';
import App from './App';
import { isDev } from './config';
import { scrubBrowserTelemetry } from './telemetry/sentryPrivacy';

enableMapSet();
setAutoFreeze(false);

// Error reporting is opt-in per deployment: without VITE_SENTRY_DSN no
// telemetry leaves the browser. (The inherited hardcoded DSN pointed at
// upstream CourseTable's Sentry project.)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

Sentry.init({
  enabled: !isDev && Boolean(sentryDsn),
  dsn: sentryDsn,
  sendDefaultPii: false,
  beforeSend: scrubBrowserTelemetry,
  beforeSendTransaction: scrubBrowserTelemetry,
  beforeBreadcrumb: scrubBrowserTelemetry,
  integrations: [
    // See https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/v7/
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  // Unfortunately this is also going to mask some legit errors like CORS, but
  // the vast majority are network problems
  ignoreErrors: [
    'TypeError: Failed to fetch',
    'TypeError: Load failed',
    'TypeError: Importing a module script failed.',
    'TypeError: cancelled',
    'TypeError: NetworkError when attempting to fetch resource.',
    'TypeError: The network connection was lost.',
    /Failed to register a ServiceWorker.*(?:aborted|abort)/u,

    // These occur with incomplete data
    'SyntaxError: The string did not match the expected pattern.',
    /SyntaxError: .*JSON.*/u,
    'Syntax Error: Unexpected <EOF>.',
  ],
  environment: import.meta.env.MODE,

  autoSessionTracking: true,

  tracesSampleRate: 0.08,
});

const domNode = document.getElementById('root')!;
const root = createRoot(domNode);

root.render(
  <Globals>
    <App />
  </Globals>,
);
