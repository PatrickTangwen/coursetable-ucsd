import { describe, expect, it } from 'vitest';

import { createPlanningDataResponse } from './planningData.response.js';
import type { AppUserIdentity } from '../auth/ucsdIdentity.js';
import { createMemorySavedSearchStore } from '../savedSearches/savedSearches.memory.js';
import { createMemorySavedWorksheetStore } from '../savedWorksheets/savedWorksheets.memory.js';

const user: AppUserIdentity = {
  user_id: 7,
  verified_email: 'student@ucsd.edu',
};

function createOptions(authenticated = true) {
  const consumed: string[] = [];
  return {
    consumed,
    options: {
      savedSearches: createMemorySavedSearchStore(),
      savedWorksheets: createMemorySavedWorksheetStore(),
      session: {
        getUser: () => Promise.resolve(authenticated ? user : null),
      },
      safetyBudget: {
        consumeVerificationSend() {
          consumed.push('send');
          return Promise.resolve({ allowed: true as const });
        },
        consumeAccountWrite() {
          consumed.push('account-write');
          return Promise.resolve({
            allowed: false as const,
            retryAfterMs: 60_000,
          });
        },
      },
    },
  };
}

describe('planning data application safety budget', () => {
  it('pauses account writes at the application safety budget', async () => {
    const { options } = createOptions();
    const response = await createPlanningDataResponse(
      {
        body: { name: 'CSE search', queryString: 'course=CSE100' },
        context: {},
        method: 'POST',
        pathname: '/api/savedSearches/create',
      },
      options,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(await response?.json()).toEqual({
      error: 'ACCOUNT_WRITES_PAUSED',
      message: 'Account changes are temporarily paused.',
    });
    expect(await options.savedSearches.listByUserId(user.user_id)).toEqual([]);
  });

  it('keeps safe account reads outside the safety budget', async () => {
    const { options, consumed } = createOptions();
    const response = await createPlanningDataResponse(
      {
        context: {},
        method: 'GET',
        pathname: '/api/savedSearches',
      },
      options,
    );

    expect(response?.status).toBe(200);
    expect(consumed).toEqual([]);
  });

  it('rejects anonymous writes before consuming the safety budget', async () => {
    const { options, consumed } = createOptions(false);
    const response = await createPlanningDataResponse(
      {
        body: { name: 'CSE search', queryString: 'course=CSE100' },
        context: {},
        method: 'POST',
        pathname: '/api/savedSearches/create',
      },
      options,
    );

    expect(response?.status).toBe(401);
    expect(consumed).toEqual([]);
  });
});
