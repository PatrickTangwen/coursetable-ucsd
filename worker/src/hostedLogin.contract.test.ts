import { describe, it } from 'vitest';

import {
  createAppWorker,
  type AppWorkerEnv,
  type HostedAppProviders,
} from './appWorker.js';
import type { UpstashRedisCommands } from './upstashRedis.js';
import { createMemoryEmailDeliveryAuditStore } from '../../api/src/auth/emailDeliveryAudit.memory.js';
import {
  exerciseHostedLoginContract,
  HostedLoginCookieClient,
} from '../../api/src/auth/hostedLogin.contract.js';
import { createMemoryUcsdAuthStore } from '../../api/src/auth/ucsdAuth.memory.js';
import { exerciseHostedPlanningDataContract } from '../../api/src/planningData/hostedPlanningData.contract.js';
import { createMemorySavedSearchStore } from '../../api/src/savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../../api/src/savedWorksheets/savedWorksheets.memory.js';

class MemoryRedis implements UpstashRedisCommands {
  readonly values = new Map<string, string>();

  get<T>(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(value ? (JSON.parse(value) as T) : null);
  }

  setex(key: string, _seconds: number, value: string) {
    this.values.set(key, value);
    return Promise.resolve('OK' as const);
  }

  del(key: string) {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }

  eval() {
    return Promise.resolve([1, 0]);
  }
}

function createEnvironment() {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response('SunGrid')) },
    CATALOG_BUCKET: {},
    APP_DB_HYPERDRIVE_NO_CACHE: {
      connectionString: 'postgresql://local.invalid/app',
    },
    UPSTASH_REDIS_REST_URL: 'https://local-upstash.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'local-token',
    SESSION_SECRET: 'session-secret',
    RESEND_API_KEY: 'local-resend-key',
    VERIFICATION_EMAIL_SENDER_DOMAIN: 'validation.invalid',
    VERIFICATION_EMAIL_FROM_ADDRESS: 'login@validation.invalid',
    VERIFICATION_REQUEST_COOLDOWN_SECONDS: '1',
    VERIFICATION_SOURCE_LIMIT: '5',
    VERIFICATION_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_GLOBAL_LIMIT: '100',
    VERIFICATION_GLOBAL_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_SOURCE_LIMIT: '20',
    VERIFICATION_ATTEMPT_SOURCE_WINDOW_SECONDS: '900',
    VERIFICATION_ATTEMPT_EMAIL_LIMIT: '5',
    VERIFICATION_ATTEMPT_EMAIL_WINDOW_SECONDS: '900',
  } as unknown as AppWorkerEnv;
}

describe('hosted login external HTTP contract on Worker', () => {
  it('runs unchanged through the Worker composition root', async () => {
    const codes: string[] = [];
    const authStore = createMemoryUcsdAuthStore();
    const redis = new MemoryRedis();
    let currentTime = 1_000_000;
    const providers: HostedAppProviders = {
      createAppDatabase: () => ({
        auth: authStore,
        emailDeliveryAudits: createMemoryEmailDeliveryAuditStore(),
        savedSearches: createMemorySavedSearchStore(),
        savedWorksheets: createMemorySavedWorksheetStore(),
        close: () => Promise.resolve(),
      }),
      createEmailSender: () => ({
        sendVerificationEmail(message) {
          const code = /code is (?<code>\d{6})/u.exec(message.text)?.groups
            ?.code;
          if (!code) throw new Error('Verification code missing from message');
          codes.push(code);
          return Promise.resolve();
        },
      }),
      createRedis: () => redis,
      now() {
        currentTime += 2_000;
        return currentTime;
      },
    };
    const worker = createAppWorker(providers);
    const environment = createEnvironment();
    const context = { waitUntil() {} } as unknown as ExecutionContext;
    const client = new HostedLoginCookieClient((request) =>
      worker.fetch(request, environment, context),
    );

    await exerciseHostedLoginContract(client, () => {
      const code = codes.shift();
      if (!code) throw new Error('No captured verification code');
      return Promise.resolve(code);
    });
  });

  it('runs the account planning-data contract through the Worker composition root', async () => {
    const codes = new Map<string, string[]>();
    const authStore = createMemoryUcsdAuthStore();
    const redis = new MemoryRedis();
    let currentTime = 1_000_000;
    const savedSearches = createMemorySavedSearchStore();
    const savedWorksheets = createMemorySavedWorksheetStore();
    const providers: HostedAppProviders = {
      createAppDatabase: () => ({
        auth: authStore,
        emailDeliveryAudits: createMemoryEmailDeliveryAuditStore(),
        savedSearches,
        savedWorksheets,
        close: () => Promise.resolve(),
      }),
      createEmailSender: () => ({
        sendVerificationEmail(message) {
          const code = /code is (?<code>\d{6})/u.exec(message.text)?.groups
            ?.code;
          if (!code) throw new Error('Verification code missing from message');
          codes.set(message.recipient, [
            ...(codes.get(message.recipient) ?? []),
            code,
          ]);
          return Promise.resolve();
        },
      }),
      createRedis: () => redis,
      now() {
        currentTime += 1;
        return currentTime;
      },
    };
    const worker = createAppWorker(providers);
    const environment = createEnvironment();
    const context = { waitUntil() {} } as unknown as ExecutionContext;
    const client = new HostedLoginCookieClient((request) =>
      worker.fetch(request, environment, context),
    );

    await exerciseHostedPlanningDataContract(client, (email) => {
      const code = codes.get(email)?.shift();
      if (!code) throw new Error(`No captured verification code for ${email}`);
      return Promise.resolve(code);
    });
  });
});
