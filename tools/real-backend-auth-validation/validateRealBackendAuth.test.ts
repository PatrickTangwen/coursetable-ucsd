import { beforeAll, describe, expect, it } from 'vitest';

async function loadValidationModule() {
  return await import('./validateRealBackendAuth.mjs');
}

let validation = {} as Awaited<ReturnType<typeof loadValidationModule>>;

beforeAll(async () => {
  validation = await loadValidationModule();
});

describe('real backend auth validation CLI', () => {
  it('builds a host validation config with unique defaults and overrides', () => {
    const config = validation.createRunConfig(
      [
        '--api-origin',
        'https://localhost:3010',
        '--artifact-dir',
        'artifacts/real-backend-auth-validation/custom',
        '--email',
        'Student@UCSD.edu',
        '--keep-data',
      ],
      {},
      new Date('2026-06-21T04:05:06Z'),
    );

    expect(config.apiOrigin).toBe('https://localhost:3010');
    expect(config.artifactDir).toBe(
      'artifacts/real-backend-auth-validation/custom',
    );
    expect(config.email).toBe('student@ucsd.edu');
    expect(config.keepData).toBe(true);
  });

  it('uses the API_PORT env value for the host API origin by default', () => {
    const config = validation.createRunConfig(
      [],
      { API_PORT: '3010' },
      new Date('2026-06-21T04:05:06Z'),
    );

    expect(config.apiOrigin).toBe('http://localhost:3010');
    expect(config.email).toMatch(
      /^auth-validation\+20260621t040506z-[a-f\d]{8}@ucsd\.edu$/u,
    );
  });

  it('keeps docker compose evidence collection inside compose containers', () => {
    const config = validation.createRunConfig(
      ['--compose-project', 'coursetable-auth-validation-test'],
      {},
      new Date('2026-06-21T04:05:06Z'),
    );

    expect(
      validation.buildComposeArgs(config, ['exec', '-T', 'db', 'psql']),
    ).toEqual([
      'compose',
      '--env-file',
      'local-validation.env.example',
      '-f',
      'docker-compose.yml',
      '-f',
      'dev-compose.yml',
      '-f',
      'local-validation-compose.yml',
      '-f',
      'hosted-validation-compose.yml',
      '-p',
      'coursetable-auth-validation-test',
      'exec',
      '-T',
      'db',
      'psql',
    ]);
  });

  it('tracks cookies without leaking session ids into evidence', () => {
    const jar = new Map<string, string>();

    validation.parseSetCookieHeaders(
      [
        'connect.sid=s%3Asession123.signature; Path=/; HttpOnly; Secure; SameSite=None',
      ],
      jar,
    );

    expect(validation.formatCookieHeader(jar)).toBe(
      'connect.sid=s%3Asession123.signature',
    );
    expect(validation.decodeConnectSessionId(jar.get('connect.sid'))).toBe(
      'session123',
    );
  });

  it('only cleans mutable data after successful runs unless keep-data is set', () => {
    expect(
      validation.shouldCleanupMutableData({ succeeded: true, keepData: false }),
    ).toBe(true);
    expect(
      validation.shouldCleanupMutableData({ succeeded: true, keepData: true }),
    ).toBe(false);
    expect(
      validation.shouldCleanupMutableData({
        succeeded: false,
        keepData: false,
      }),
    ).toBe(false);
  });

  it('summarizes evidence without persisting dev codes or full session keys', () => {
    const summary = validation.buildEvidenceSummary({
      runId: '20260621T040506Z',
      apiOrigin: 'https://localhost:3010',
      email: 'auth-validation+20260621t040506z-12345678@ucsd.edu',
      savedSearchName: 'Auth Validation 20260621T040506Z',
      appUserIdFingerprint: '73475cb40a56',
      verificationCodeSource: 'explicit hosted-validation capture sender',
      http: {
        requestVerificationStatus: 200,
        verifyStatus: 200,
        currentUserStatus: 200,
        createSavedSearchStatus: 200,
        listSavedSearchesStatus: 200,
        deleteSavedSearchStatus: 200,
        logoutStatus: 200,
        anonymousCurrentUserStatus: 200,
      },
      postgres: {
        accountOwnedDataIsolated: true,
        expectedTablesPresent: true,
        expectedIndexesPresent: true,
        userRowFound: true,
        verificationRowConsumed: true,
        savedSearchOwnedByUserId: true,
        savedSearchDeleted: true,
        worksheetRowsBefore: 0,
        worksheetRowsAfter: 0,
        worksheetCourseRowsBefore: 0,
        worksheetCourseRowsAfter: 0,
      },
      redis: {
        sessionKeyFingerprint: 'abcdef123456',
        sessionExistedAfterVerify: true,
        sessionExistedAfterLogout: false,
      },
      nonDevelopmentSafety: {
        productionExposesDevCode: false,
      },
      cleanup: {
        attempted: true,
        verificationRowsDeleted: 1,
        savedSearchRowsDeleted: 0,
      },
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('123456.');
    expect(serialized).not.toContain('devCode":"123456');
    expect(summary.redis.sessionKeyFingerprint).toBe('abcdef123456');
  });
});
