import { drizzle } from 'drizzle-orm/postgres-js';
import { GraphQLClient } from 'graphql-request';
import postgres from 'postgres';
import { createClient } from 'redis';
import { createResendVerificationEmailSender } from './auth/verificationEmail.resend.js';
import { createVerificationEmailDelivery } from './auth/verificationEmail.sender.js';
import { parseTrustedProxyCidrs } from './network/trustedProxy.js';
import * as schema from '../drizzle/schema.js';

function getEnv(name: string, type?: 'string'): string;
function getEnv<const K extends string[]>(name: string, type: K): K[number];
function getEnv(name: string, type: 'boolean'): boolean;
function getEnv(
  name: string,
  type: 'boolean' | 'string' | string[] = 'string',
): string | boolean {
  const val = process.env[name];
  if (val === undefined) throw new Error(`env config missing: ${name}`);
  if (type === 'boolean') {
    switch (val) {
      case 'true':
        return true;
      case 'false':
        return false;
      default:
        throw new Error(`env config ${name} must be a boolean, got '${val}'`);
    }
  }
  if (type === 'string') return val;
  if (Array.isArray(type)) {
    if (!type.includes(val)) {
      throw new Error(
        `env config ${name} must be one of: ${type.join(', ')}, got '${val}'`,
      );
    }
    return val;
  }
  return val;
}

function getNonEmptyEnv(name: string) {
  const value = getEnv(name).trim();
  if (!value) throw new Error(`env config missing: ${name}`);
  return value;
}

function getPositiveIntegerEnv(name: string) {
  const value = Number(getEnv(name));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`env config ${name} must be a positive integer`);
  return value;
}

export const OPTIONAL_API_MODULES = [
  'canny',
  'challenge',
  'course-data-platform',
  'demand',
  'friends',
  'legacy-auth',
  'legacy-catalog',
  'link-preview',
  'profile',
  'user',
] as const;

export type OptionalApiModule = (typeof OPTIONAL_API_MODULES)[number];

function parseEnabledApiModules(value = process.env.ENABLED_API_MODULES ?? '') {
  const modules = new Set(
    value
      .split(',')
      .map((module) => module.trim())
      .filter(Boolean),
  );
  const unknown = [...modules].filter(
    (module) => !OPTIONAL_API_MODULES.includes(module as OptionalApiModule),
  );
  if (unknown.length > 0)
    throw new Error(`unknown optional API module: ${unknown.join(', ')}`);
  return modules as Set<OptionalApiModule>;
}

export const enabledApiModules = parseEnabledApiModules();

const GRAPHQL_DEPENDENT_MODULES: OptionalApiModule[] = [
  'challenge',
  'demand',
  'friends',
  'legacy-catalog',
  'link-preview',
  'user',
];

const graphqlDependentsWithoutPlatform = GRAPHQL_DEPENDENT_MODULES.filter(
  (module) =>
    enabledApiModules.has(module) &&
    !enabledApiModules.has('course-data-platform'),
);
if (graphqlDependentsWithoutPlatform.length > 0) {
  throw new Error(
    `optional API module requires course-data-platform: ${graphqlDependentsWithoutPlatform.join(', ')}`,
  );
}

export function isApiModuleEnabled(module: OptionalApiModule) {
  return enabledApiModules.has(module);
}

function getModuleEnv(
  modules: OptionalApiModule | OptionalApiModule[],
  name: string,
) {
  const moduleList = Array.isArray(modules) ? modules : [modules];
  return moduleList.some(isApiModuleEnabled) ? getNonEmptyEnv(name) : undefined;
}

// Read all env vars and validate them. No other code should read process.env
// directly. You can make sure that this corresponds 1:1 with the env passed
// from the docker compose files.
export const API_PORT = getEnv('API_PORT');
export const CANNY_KEY = getModuleEnv('canny', 'CANNY_KEY')!;
export const CHALLENGE_PASSWORD = getModuleEnv(
  'challenge',
  'CHALLENGE_PASSWORD',
)!;

const pool = postgres(getEnv('DB_URL'));
export const db = drizzle(pool, { schema });

export const FERRY_RELOAD_SECRET = getModuleEnv(
  'legacy-catalog',
  'FERRY_RELOAD_SECRET',
)!;
// Frontend server endpoint (used for redirects)
export const FRONTEND_ENDPOINT = getEnv('FRONTEND_ENDPOINT');
const courseDataPlatformEnabled = isApiModuleEnabled('course-data-platform');
export const GRAPHQL_ENDPOINT = courseDataPlatformEnabled
  ? getNonEmptyEnv('GRAPHQL_ENDPOINT')
  : undefined;
export const HASURA_GRAPHQL_ADMIN_SECRET = courseDataPlatformEnabled
  ? getNonEmptyEnv('HASURA_GRAPHQL_ADMIN_SECRET')
  : undefined;

export const graphqlClient = courseDataPlatformEnabled
  ? new GraphQLClient(GRAPHQL_ENDPOINT!, {
      headers: {
        'x-hasura-admin-secret': HASURA_GRAPHQL_ADMIN_SECRET!,
      },
    })
  : (undefined as never);

const NODE_ENV = getEnv('NODE_ENV', ['development', 'production']);
export const isDev = NODE_ENV === 'development';
export const verificationEmailDelivery = createVerificationEmailDelivery({
  nodeEnv: NODE_ENV,
  hostedSender:
    NODE_ENV === 'production'
      ? createResendVerificationEmailSender({
          apiKey: getNonEmptyEnv('RESEND_API_KEY'),
          senderDomain: getNonEmptyEnv('VERIFICATION_EMAIL_SENDER_DOMAIN'),
          fromAddress: getNonEmptyEnv('VERIFICATION_EMAIL_FROM_ADDRESS'),
        })
      : undefined,
});
export const VERIFICATION_REQUEST_COOLDOWN_MS =
  getPositiveIntegerEnv('VERIFICATION_REQUEST_COOLDOWN_SECONDS') * 1000;
export const VERIFICATION_SOURCE_LIMIT = getPositiveIntegerEnv(
  'VERIFICATION_SOURCE_LIMIT',
);
export const VERIFICATION_SOURCE_WINDOW_MS =
  getPositiveIntegerEnv('VERIFICATION_SOURCE_WINDOW_SECONDS') * 1000;
export const VERIFICATION_GLOBAL_LIMIT = getPositiveIntegerEnv(
  'VERIFICATION_GLOBAL_LIMIT',
);
export const VERIFICATION_GLOBAL_WINDOW_MS =
  getPositiveIntegerEnv('VERIFICATION_GLOBAL_WINDOW_SECONDS') * 1000;
export const VERIFICATION_ATTEMPT_SOURCE_LIMIT = getPositiveIntegerEnv(
  'VERIFICATION_ATTEMPT_SOURCE_LIMIT',
);
export const VERIFICATION_ATTEMPT_SOURCE_WINDOW_MS =
  getPositiveIntegerEnv('VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS') * 1000;
export const VERIFICATION_ATTEMPT_EMAIL_LIMIT = getPositiveIntegerEnv(
  'VERIFICATION_ATTEMPT_EMAIL_LIMIT',
);
export const VERIFICATION_ATTEMPT_EMAIL_WINDOW_MS =
  getPositiveIntegerEnv('VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS') * 1000;
export const TRUSTED_PROXY_CIDRS = parseTrustedProxyCidrs(
  getEnv('TRUSTED_PROXY_CIDRS'),
);

export const OVERWRITE_CATALOG = getEnv('OVERWRITE_CATALOG', 'boolean');
export const redisClient = createClient({
  socket: {
    host: getEnv('REDIS_HOST'),
  },
});

export const SENTRY_DSN = getEnv('SENTRY_DSN');
export const SENTRY_ENVIRONMENT = getEnv('SENTRY_ENVIRONMENT');
// Secret for session cookie signing.
export const SESSION_SECRET = getEnv('SESSION_SECRET');
// API key for interfacing with the yalies.io API
export const YALIES_API_KEY = getModuleEnv(
  ['canny', 'legacy-auth'],
  'YALIES_API_KEY',
)!;

export const NUM_CHALLENGE_COURSES = 3; // Number of courses to select for the challenge
// Season to select the challenge from. Note that OCE removes old seasons so
// you need to keep this new.
export const CHALLENGE_SEASON = '202303';
export const MAX_CHALLENGE_REQUESTS = 100; // Maximum number of allowed challenge tries

// Location of statically generated files. This is relative
// to the working directory, which is api.
export const STATIC_FILE_DIR = './static';
export const SITEMAP_DIR = `${STATIC_FILE_DIR}/sitemaps`;
// Latest number of seasons to refresh the static files for
export const NUM_SEASONS = isDev ? 0 : 4;

export const COURSETABLE_ORIGINS = [
  FRONTEND_ENDPOINT,
  'https://coursetable.com',
  'https://www.coursetable.com',
  /^https:\/\/.+\.coursetable\.com$/u,
  /^https:\/\/.+\.coursetable\.pages\.dev$/u,
];
