import {
  handleCatalogWorkerRequest,
  type CatalogWorkerEnv,
} from './catalogWorker.js';
import { createHyperdriveAuthStore } from './hyperdriveAuthStore.js';
import {
  createUpstashRedisCommands,
  createUpstashRedisEvalClient,
  type UpstashRedisCommands,
} from './upstashRedis.js';
import { createUpstashAppSession } from './upstashSession.js';
import { createWorkerAuthHandler } from './workerAuth.js';
import type { UcsdAuthStore } from '../../api/src/auth/ucsdAuth.store.js';
import { createResendVerificationEmailSender } from '../../api/src/auth/verificationEmail.resend.js';
import type { VerificationEmailSender } from '../../api/src/auth/verificationEmail.sender.js';
import {
  createRedisVerificationAttemptLimiter,
  createRedisVerificationRequestLimiter,
} from '../../api/src/auth/verificationRequest.limiter.js';

export interface AppWorkerEnv extends CatalogWorkerEnv {
  APP_DB_HYPERDRIVE_NO_CACHE: Hyperdrive;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  VERIFICATION_EMAIL_SENDER_DOMAIN: string;
  VERIFICATION_EMAIL_FROM_ADDRESS: string;
  VERIFICATION_REQUEST_COOLDOWN_SECONDS: string;
  VERIFICATION_SOURCE_LIMIT: string;
  VERIFICATION_SOURCE_WINDOW_SECONDS: string;
  VERIFICATION_GLOBAL_LIMIT: string;
  VERIFICATION_GLOBAL_WINDOW_SECONDS: string;
  VERIFICATION_ATTEMPT_SOURCE_LIMIT: string;
  VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS: string;
  VERIFICATION_ATTEMPT_EMAIL_LIMIT: string;
  VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS: string;
}

export interface HostedAuthProviders {
  createAuthStore: (hyperdrive: Hyperdrive) => {
    store: UcsdAuthStore;
    close: () => Promise<void>;
  };
  createEmailSender: (environment: AppWorkerEnv) => VerificationEmailSender;
  createRedis: (url: string, token: string) => UpstashRedisCommands;
  now: () => number;
}

const hostedAuthProviders: HostedAuthProviders = {
  createAuthStore: createHyperdriveAuthStore,
  createEmailSender: (environment) =>
    createResendVerificationEmailSender({
      apiKey: environment.RESEND_API_KEY,
      senderDomain: environment.VERIFICATION_EMAIL_SENDER_DOMAIN,
      fromAddress: environment.VERIFICATION_EMAIL_FROM_ADDRESS,
    }),
  createRedis: createUpstashRedisCommands,
  now: Date.now,
};

export function createAppWorker(
  providers: HostedAuthProviders = hostedAuthProviders,
) {
  return {
    fetch: (
      request: Request,
      environment: AppWorkerEnv,
      context: ExecutionContext,
    ) => handleAppWorkerRequest(request, environment, context, providers),
  };
}

export async function handleAppWorkerRequest(
  request: Request,
  environment: AppWorkerEnv,
  context: ExecutionContext,
  providers: HostedAuthProviders = hostedAuthProviders,
) {
  const { pathname } = new URL(request.url);
  if (!isAuthPath(pathname))
    return handleCatalogWorkerRequest(request, environment);

  try {
    const runtime = createHostedAuthRuntime(environment, providers);
    const response = await runtime.fetch(request);
    context.waitUntil(runtime.close());
    return response;
  } catch {
    return Response.json(
      {
        error: 'AUTH_UNAVAILABLE',
        message: 'Authentication is temporarily unavailable.',
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export function createHostedAuthRuntime(
  environment: AppWorkerEnv,
  providers: HostedAuthProviders = hostedAuthProviders,
) {
  validateHostedAuthEnvironment(environment);
  const seconds = (name: keyof AppWorkerEnv) =>
    positiveInteger(environment[name], name) * 1000;
  const integer = (name: keyof AppWorkerEnv) =>
    positiveInteger(environment[name], name);
  const redis = providers.createRedis(
    environment.UPSTASH_REDIS_REST_URL,
    environment.UPSTASH_REDIS_REST_TOKEN,
  );
  const redisEval = createUpstashRedisEvalClient(redis);
  const emailSender = providers.createEmailSender(environment);
  const requestLimiter = createRedisVerificationRequestLimiter(
    redisEval,
    environment.SESSION_SECRET,
    {
      sourceLimit: integer('VERIFICATION_SOURCE_LIMIT'),
      sourceWindowMs: seconds('VERIFICATION_SOURCE_WINDOW_SECONDS'),
      globalLimit: integer('VERIFICATION_GLOBAL_LIMIT'),
      globalWindowMs: seconds('VERIFICATION_GLOBAL_WINDOW_SECONDS'),
    },
  );
  const verificationAttemptLimiter = createRedisVerificationAttemptLimiter(
    redisEval,
    environment.SESSION_SECRET,
    {
      sourceLimit: integer('VERIFICATION_ATTEMPT_SOURCE_LIMIT'),
      sourceWindowMs: seconds('VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS'),
      emailLimit: integer('VERIFICATION_ATTEMPT_EMAIL_LIMIT'),
      emailWindowMs: seconds('VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS'),
    },
  );
  const session = createUpstashAppSession(redis, environment.SESSION_SECRET);
  const requestCooldownMs = seconds('VERIFICATION_REQUEST_COOLDOWN_SECONDS');
  const database = providers.createAuthStore(
    environment.APP_DB_HYPERDRIVE_NO_CACHE,
  );

  return {
    fetch: createWorkerAuthHandler({
      store: database.store,
      emailSender,
      exposeVerificationCode: false,
      now: providers.now,
      requestCooldownMs,
      requestLimiter,
      verificationAttemptLimiter,
      session,
    }),
    close: database.close,
  };
}

function validateHostedAuthEnvironment(environment: AppWorkerEnv) {
  for (const name of [
    'APP_DB_HYPERDRIVE_NO_CACHE',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'SESSION_SECRET',
    'RESEND_API_KEY',
    'VERIFICATION_EMAIL_SENDER_DOMAIN',
    'VERIFICATION_EMAIL_FROM_ADDRESS',
  ] as const) {
    const value = environment[name];
    if (!value || (typeof value === 'string' && !value.trim()))
      throw new Error(`Worker auth environment missing: ${name}`);
  }
}

function positiveInteger(value: unknown, name: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`Worker auth environment is invalid: ${name}`);
  return parsed;
}

function isAuthPath(pathname: string) {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export default createAppWorker() satisfies ExportedHandler<AppWorkerEnv>;
