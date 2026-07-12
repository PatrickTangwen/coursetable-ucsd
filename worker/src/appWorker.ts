import {
  handleCatalogWorkerRequest,
  type CatalogWorkerEnv,
} from './catalogWorker.js';
import { createHyperdriveAppDatabase } from './hyperdriveAppDatabase.js';
import {
  createUpstashRedisCommands,
  createUpstashRedisEvalClient,
  type UpstashRedisCommands,
} from './upstashRedis.js';
import { createUpstashAppSession } from './upstashSession.js';
import {
  createRedisUsageSignals,
  type UsageDeploymentIdentity,
  type UsageSignals,
} from './usageSignals.js';
import {
  createWorkerAppBackendHandler,
  unavailableResponse,
} from './workerAppBackend.js';
import { createAuditedVerificationEmailSender } from '../../api/src/auth/emailDeliveryAudit.sender.js';
import type { EmailDeliveryAuditStore } from '../../api/src/auth/emailDeliveryAudit.store.js';
import type { UcsdAuthStore } from '../../api/src/auth/ucsdAuth.store.js';
import { createResendVerificationEmailSender } from '../../api/src/auth/verificationEmail.resend.js';
import type { VerificationEmailSender } from '../../api/src/auth/verificationEmail.sender.js';
import {
  createRedisVerificationAttemptLimiter,
  createRedisVerificationRequestLimiter,
} from '../../api/src/auth/verificationRequest.limiter.js';
import { createRedisApplicationSafetyBudget } from '../../api/src/core/applicationSafetyBudget.js';
import type { SavedSearchStore } from '../../api/src/savedSearches/savedSearches.store.js';
import type { SavedWorksheetStore } from '../../api/src/savedWorksheets/savedWorksheets.store.js';

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
  APPLICATION_SAFETY_SEND_LIMIT: string;
  APPLICATION_SAFETY_SEND_WINDOW_SECONDS: string;
  APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: string;
  APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS: string;
  USAGE_ALLOWANCE_WORKER_REQUESTS: string;
  USAGE_ALLOWANCE_R2_READS: string;
  USAGE_ALLOWANCE_NEON_ACCOUNT_REQUESTS: string;
  USAGE_ALLOWANCE_UPSTASH_COMMANDS: string;
  USAGE_ALLOWANCE_RESEND_SENDS: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
}

export interface HostedAppProviders {
  createAppDatabase: (hyperdrive: Hyperdrive) => {
    auth: UcsdAuthStore;
    emailDeliveryAudits: EmailDeliveryAuditStore;
    savedSearches: SavedSearchStore;
    savedWorksheets: SavedWorksheetStore;
    close: () => Promise<void>;
  };
  createEmailSender: (environment: AppWorkerEnv) => VerificationEmailSender;
  createRedis: (url: string, token: string) => UpstashRedisCommands;
  now: () => number;
}

const hostedAppProviders: HostedAppProviders = {
  createAppDatabase: createHyperdriveAppDatabase,
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
  providers: HostedAppProviders = hostedAppProviders,
) {
  return {
    fetch: (
      request: Request,
      environment: AppWorkerEnv,
      context: ExecutionContext,
    ) => handleAppWorkerRequest(request, environment, context, providers),
    scheduled(
      controller: ScheduledController,
      environment: AppWorkerEnv,
      context: ExecutionContext,
    ) {
      context.waitUntil(
        cleanupExpiredEmailDeliveryAudits(
          environment,
          controller.scheduledTime,
          providers,
        ),
      );
      context.waitUntil(reportUsageLevels(environment, providers));
    },
  };
}

export async function reportUsageLevels(
  environment: AppWorkerEnv,
  providers: HostedAppProviders = hostedAppProviders,
) {
  let upstashCommands = 0;
  const countingProviders: HostedAppProviders = {
    ...providers,
    createRedis(url, token) {
      const redis = providers.createRedis(url, token);
      return {
        get<T>(key: string) {
          upstashCommands += 1;
          return redis.get<T>(key);
        },
        setex: (key, seconds, value) => redis.setex(key, seconds, value),
        del: (key) => redis.del(key),
        eval(script, keys, args) {
          upstashCommands += 1;
          return redis.eval(script, keys, args);
        },
      };
    },
  };
  const usage = createEnvironmentUsageSignals(environment, countingProviders);
  if (!usage) {
    console.warn(JSON.stringify({ signal: 'usage-report-unavailable' }));
    return;
  }
  try {
    const reports = await usage.evaluate();
    const deployment = deploymentIdentity(environment);
    console.warn(
      JSON.stringify({
        signal: 'usage-report',
        reports,
        ...(deployment ? { deployment } : {}),
      }),
    );
  } catch {
    console.warn(JSON.stringify({ signal: 'usage-report-unavailable' }));
  }
  // Count the scheduled Worker event, its App DB cleanup, every report read,
  // and the batched usage-recording command itself.
  await usage.record({
    workers: 1,
    neon: 1,
    upstash: upstashCommands + 1,
  });
}

export async function cleanupExpiredEmailDeliveryAudits(
  environment: AppWorkerEnv,
  scheduledTime: number,
  providers: HostedAppProviders = hostedAppProviders,
) {
  const hyperdrive = (environment as Partial<AppWorkerEnv>)
    .APP_DB_HYPERDRIVE_NO_CACHE;
  if (!hyperdrive)
    throw new Error('No-cache App DB Hyperdrive binding is required');
  const database = providers.createAppDatabase(hyperdrive);
  try {
    return await database.emailDeliveryAudits.deleteExpired(scheduledTime);
  } finally {
    await database.close();
  }
}

export async function handleAppWorkerRequest(
  request: Request,
  environment: AppWorkerEnv,
  context: ExecutionContext,
  providers: HostedAppProviders = hostedAppProviders,
) {
  const { pathname } = new URL(request.url);
  const usage = createEnvironmentUsageSignals(environment, providers);
  const recordUsage = (counts: Parameters<UsageSignals['record']>[0]) => {
    if (usage) context.waitUntil(usage.record(counts));
  };

  if (!isAccountPath(pathname)) {
    let r2Reads = 0;
    const response = await handleCatalogWorkerRequest(request, environment, {
      onR2Read() {
        r2Reads += 1;
      },
    });
    // The single batched usage-recording command is itself the request's
    // only Upstash spend on this path, so it is counted as one command.
    recordUsage({ workers: 1, r2: r2Reads, upstash: 1 });
    return response;
  }

  let resendCalls = 0;
  let upstashCommands = 0;
  const countingProviders: HostedAppProviders = {
    ...providers,
    createEmailSender(senderEnvironment) {
      const sender = providers.createEmailSender(senderEnvironment);
      return {
        sendVerificationEmail(message) {
          resendCalls += 1;
          return sender.sendVerificationEmail(message);
        },
      };
    },
    createRedis(url, token) {
      const redis = providers.createRedis(url, token);
      return {
        get<T>(key: string) {
          upstashCommands += 1;
          return redis.get<T>(key);
        },
        setex(key: string, seconds: number, value: string) {
          upstashCommands += 1;
          return redis.setex(key, seconds, value);
        },
        del(key: string) {
          upstashCommands += 1;
          return redis.del(key);
        },
        eval(script, keys: string[], args: string[]) {
          upstashCommands += 1;
          return redis.eval(script, keys, args);
        },
      };
    },
  };
  try {
    const runtime = createHostedAppRuntime(environment, countingProviders);
    const response = await runtime.fetch(request);
    context.waitUntil(runtime.close());
    recordUsage({
      workers: 1,
      neon: 1,
      // Every store command issued during the request plus the one batched
      // usage-recording command below.
      upstash: upstashCommands + 1,
      resend: resendCalls,
    });
    return response;
  } catch {
    recordUsage({ workers: 1, upstash: upstashCommands + 1 });
    return unavailableResponse(pathname);
  }
}

export function createHostedAppRuntime(
  environment: AppWorkerEnv,
  providers: HostedAppProviders = hostedAppProviders,
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
  const deployment = deploymentIdentity(environment);
  const safetyBudget = createRedisApplicationSafetyBudget(
    redisEval,
    {
      sendLimit: integer('APPLICATION_SAFETY_SEND_LIMIT'),
      sendWindowMs: seconds('APPLICATION_SAFETY_SEND_WINDOW_SECONDS'),
      accountWriteLimit: integer('APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT'),
      accountWriteWindowMs: seconds(
        'APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS',
      ),
    },
    deployment ? { deployment } : {},
  );
  const session = createUpstashAppSession(redis, environment.SESSION_SECRET);
  const requestCooldownMs = seconds('VERIFICATION_REQUEST_COOLDOWN_SECONDS');
  const providerEmailSender = providers.createEmailSender(environment);
  const database = providers.createAppDatabase(
    environment.APP_DB_HYPERDRIVE_NO_CACHE,
  );
  const emailSender = createAuditedVerificationEmailSender(
    providerEmailSender,
    database.emailDeliveryAudits,
  );

  return {
    fetch: createWorkerAppBackendHandler({
      auth: {
        store: database.auth,
        emailSender,
        exposeVerificationCode: false,
        now: providers.now,
        requestCooldownMs,
        requestLimiter,
        verificationAttemptLimiter,
        safetyBudget,
        session,
      },
      planningData: {
        savedSearches: database.savedSearches,
        savedWorksheets: database.savedWorksheets,
        session,
        now: providers.now,
        safetyBudget,
      },
    }),
    close: database.close,
  };
}

function deploymentIdentity(
  environment: AppWorkerEnv,
): UsageDeploymentIdentity | null {
  const metadata = environment.CF_VERSION_METADATA;
  if (!metadata?.id) return null;
  return { versionId: metadata.id, versionTag: metadata.tag };
}

// Usage signals are advisory: when the signal store or its allowances are
// not configured, requests proceed without them and the daily report says so.
function createEnvironmentUsageSignals(
  environment: AppWorkerEnv,
  providers: HostedAppProviders,
): UsageSignals | null {
  const url = environment.UPSTASH_REDIS_REST_URL;
  const token = environment.UPSTASH_REDIS_REST_TOKEN;
  if (typeof url !== 'string' || !url.trim()) return null;
  if (typeof token !== 'string' || !token.trim()) return null;
  const allowances = {
    workers: Number(environment.USAGE_ALLOWANCE_WORKER_REQUESTS),
    r2: Number(environment.USAGE_ALLOWANCE_R2_READS),
    neon: Number(environment.USAGE_ALLOWANCE_NEON_ACCOUNT_REQUESTS),
    upstash: Number(environment.USAGE_ALLOWANCE_UPSTASH_COMMANDS),
    resend: Number(environment.USAGE_ALLOWANCE_RESEND_SENDS),
  };
  for (const allowance of Object.values(allowances))
    if (!Number.isSafeInteger(allowance) || allowance <= 0) return null;

  const deployment = deploymentIdentity(environment);
  try {
    return createRedisUsageSignals(providers.createRedis(url, token), {
      allowances,
      now: providers.now,
      ...(deployment ? { deployment } : {}),
    });
  } catch {
    return null;
  }
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

function isAccountPath(pathname: string) {
  return (
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/savedSearches' ||
    pathname.startsWith('/api/savedSearches/') ||
    pathname === '/api/savedWorksheets' ||
    pathname.startsWith('/api/savedWorksheets/')
  );
}

export default createAppWorker() satisfies ExportedHandler<AppWorkerEnv>;
