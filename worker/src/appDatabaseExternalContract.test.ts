import postgres from 'postgres';
import { beforeEach, describe, it } from 'vitest';

import {
  createAppWorker,
  type AppWorkerEnv,
  type HostedAppProviders,
} from './appWorker.js';
import { createHyperdriveAppDatabase } from './hyperdriveAppDatabase.js';
import type { UpstashRedisCommands } from './upstashRedis.js';
import { HostedLoginCookieClient } from '../../api/src/auth/hostedLogin.contract.js';
import { exerciseHostedPlanningDataContract } from '../../api/src/planningData/hostedPlanningData.contract.js';

const databaseUrl = process.env.APP_DB_WORKER_COMPATIBILITY_TEST_URL;

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

describe.skipIf(!databaseUrl)(
  'Worker external contract on the expanded App DB schema',
  () => {
    beforeEach(async () => {
      const client = postgres(databaseUrl!, { max: 1 });
      try {
        await client.unsafe(`
          truncate table
            "savedWorksheetSections",
            "savedWorksheets",
            "savedSearches",
            "emailDeliveryAudits",
            "emailVerificationCodes",
            "appUsers"
          restart identity cascade
        `);
      } finally {
        await client.end();
      }
    });

    it('preserves login and account-owned planning behavior', async () => {
      const codes = new Map<string, string[]>();
      const redis = new MemoryRedis();
      let currentTime = 1_000_000;
      const providers: HostedAppProviders = {
        createAppDatabase: createHyperdriveAppDatabase,
        createEmailSender: () => ({
          sendVerificationEmail(message) {
            const code = /code is (?<code>\d{6})/u.exec(message.text)?.groups
              ?.code;
            if (!code)
              throw new Error('Verification code missing from message');
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
      const environment = createEnvironment(databaseUrl!);
      const context = {
        waitUntil(promise: Promise<unknown>) {
          void promise;
        },
      } as ExecutionContext;
      const client = new HostedLoginCookieClient((request) =>
        worker.fetch(request, environment, context),
      );

      await exerciseHostedPlanningDataContract(client, (email) => {
        const code = codes.get(email)?.shift();
        if (!code) throw new Error(`No captured code for ${email}`);
        return Promise.resolve(code);
      });
    });
  },
);

function createEnvironment(connectionString: string) {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response('SunGrid')) },
    CATALOG_BUCKET: {},
    APP_DB_HYPERDRIVE_NO_CACHE: { connectionString },
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
    APPLICATION_SAFETY_SEND_LIMIT: '1000',
    APPLICATION_SAFETY_SEND_WINDOW_SECONDS: '2592000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_LIMIT: '50000',
    APPLICATION_SAFETY_ACCOUNT_WRITE_WINDOW_SECONDS: '2592000',
  } as unknown as AppWorkerEnv;
}
