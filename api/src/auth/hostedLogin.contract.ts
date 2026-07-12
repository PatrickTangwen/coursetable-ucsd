import assert from 'node:assert/strict';

import { createMemoryUcsdAuthStore } from './ucsdAuth.memory.js';

export interface HostedLoginContractClient {
  fork: () => HostedLoginContractClient;
  getCookie: () => string;
  get: (pathname: string) => Promise<Response>;
  getWithCookie: (pathname: string, cookie: string) => Promise<Response>;
  post: (pathname: string, body?: unknown) => Promise<Response>;
  postWithCookie: (
    pathname: string,
    cookie: string,
    body?: unknown,
  ) => Promise<Response>;
}

export class HostedLoginCookieClient implements HostedLoginContractClient {
  #cookie = '';
  readonly fetch: (request: Request) => Promise<Response>;
  readonly origin: string;
  readonly forwardedHttps: boolean;

  constructor(
    fetch: (request: Request) => Promise<Response>,
    origin = 'https://staging.sungridplanner.com',
    forwardedHttps = false,
  ) {
    this.fetch = fetch;
    this.origin = origin;
    this.forwardedHttps = forwardedHttps;
  }

  getCookie() {
    return this.#cookie;
  }

  request(pathname: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.#cookie) headers.set('cookie', this.#cookie);
    if (init.body) headers.set('content-type', 'application/json');
    if (this.forwardedHttps) headers.set('x-forwarded-proto', 'https');
    return this.fetch(
      new Request(`${this.origin}${pathname}`, { ...init, headers }),
    ).then((response) => {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.#cookie = setCookie.split(';')[0]!;
      return response;
    });
  }

  get(pathname: string) {
    return this.request(pathname);
  }

  getWithCookie(pathname: string, cookie: string) {
    return this.requestWithCookie(pathname, cookie);
  }

  post(pathname: string, body?: unknown) {
    return this.request(pathname, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  postWithCookie(pathname: string, cookie: string, body?: unknown) {
    return this.requestWithCookie(pathname, cookie, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  fork() {
    return new HostedLoginCookieClient(
      this.fetch,
      this.origin,
      this.forwardedHttps,
    );
  }

  private requestWithCookie(
    pathname: string,
    cookie: string,
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    if (init.body) headers.set('content-type', 'application/json');
    if (this.forwardedHttps) headers.set('x-forwarded-proto', 'https');
    return this.fetch(
      new Request(`${this.origin}${pathname}`, { ...init, headers }),
    );
  }
}

export function createHostedContractAuthOptions() {
  let currentTime = 1_000_000;
  return {
    store: createMemoryUcsdAuthStore(),
    emailSender: { sendVerificationEmail: () => Promise.resolve() },
    codeGenerator: () => '123456',
    exposeVerificationCode: false,
    now: () => currentTime++,
    requestCooldownMs: 1,
  };
}

export async function exerciseHostedLoginContract(
  client: HostedLoginContractClient,
  verificationCode: () => Promise<string> = () => Promise.resolve('123456'),
) {
  const requested = await client.post('/api/auth/ucsd/request-verification', {
    email: 'student@ucsd.edu',
  });
  assert.equal(requested.status, 200);
  assert.deepEqual(await requested.json(), {
    status: 'verification_sent',
    email: 'student@ucsd.edu',
  });

  const verified = await client.post('/api/auth/ucsd/verify', {
    email: 'student@ucsd.edu',
    code: await verificationCode(),
  });
  assert.equal(verified.status, 200);
  const cookie = verified.headers.get('set-cookie');
  assert.ok(cookie);
  assert.ok(cookie.includes('sungrid_session='));
  expectFixedThirtyDayCookie(cookie);
  assert.ok(cookie.includes('Path=/'));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('Secure'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(!cookie.includes('Domain='));

  const restored = await client.get('/api/auth/current-user');
  assert.equal(restored.status, 200);
  assert.equal(restored.headers.get('set-cookie'), null);
  assert.deepEqual(await restored.json(), {
    authenticated: true,
    user: { user_id: 1, verified_email: 'student@ucsd.edu' },
  });

  const logout = await client.post('/api/auth/logout');
  assert.equal(logout.status, 200);
  expectClearedCookie(logout.headers.get('set-cookie'));
  const oldCookie = cookie.split(';')[0]!;
  const replayed = await client.getWithCookie(
    '/api/auth/current-user',
    oldCookie,
  );
  assert.deepEqual(await replayed.json(), {
    authenticated: false,
    user: null,
  });

  const requestedAgain = await client.post(
    '/api/auth/ucsd/request-verification',
    { email: 'student@ucsd.edu' },
  );
  assert.equal(requestedAgain.status, 200);
  const verifiedAgain = await client.post('/api/auth/ucsd/verify', {
    email: 'student@ucsd.edu',
    code: await verificationCode(),
  });
  assert.equal(verifiedAgain.status, 200);
  assert.deepEqual(await verifiedAgain.json(), {
    authenticated: true,
    user: { user_id: 1, verified_email: 'student@ucsd.edu' },
  });
  assert.equal((await client.post('/api/auth/logout')).status, 200);

  const anonymous = await client.get('/api/auth/current-user');
  assert.deepEqual(await anonymous.json(), {
    authenticated: false,
    user: null,
  });
}

function expectFixedThirtyDayCookie(cookie: string | null) {
  assert.ok(cookie);
  if (cookie.includes('Max-Age=2592000')) return;
  const expires = /Expires=(?<expires>[^;]+)/u.exec(cookie)?.groups?.expires;
  assert.ok(expires);
  const lifetime = new Date(expires).getTime() - Date.now();
  assert.ok(lifetime > 30 * 24 * 60 * 60 * 1000 - 5_000);
  assert.ok(lifetime <= 30 * 24 * 60 * 60 * 1000);
}

function expectClearedCookie(cookie: string | null) {
  assert.ok(cookie);
  if (cookie.includes('Max-Age=0')) return;
  const expires = /Expires=(?<expires>[^;]+)/u.exec(cookie)?.groups?.expires;
  assert.ok(expires);
  assert.ok(new Date(expires).getTime() <= 0);
}
