import assert from 'node:assert/strict';

import type { HostedLoginContractClient } from '../auth/hostedLogin.contract.js';

export async function exerciseHostedPlanningDataContract(
  owner: HostedLoginContractClient,
  verificationCode: (email: string) => Promise<string>,
) {
  await expectUnauthenticated(owner);
  await signIn(owner, 'owner@ucsd.edu', verificationCode);

  const establishedCookie = owner.getCookie();
  assert.ok(establishedCookie.includes('sungrid_session='));

  const createdSearch = await owner.post('/api/savedSearches/create', {
    name: 'CSE systems',
    queryString: '?subjects=CSE&query=systems',
  });
  assert.equal(createdSearch.status, 200);
  const search = (await createdSearch.json()) as { id: number };

  const listedSearches = await owner.get('/api/savedSearches');
  assert.equal(listedSearches.status, 200);
  assert.equal(listedSearches.headers.get('set-cookie'), null);
  const listedSearchBody = (await listedSearches.json()) as {
    data: {
      id: number;
      name: string;
      queryString: string;
      createdAt: number;
    }[];
  };
  assert.equal(listedSearchBody.data.length, 1);
  assert.deepEqual(
    {
      id: listedSearchBody.data[0]?.id,
      name: listedSearchBody.data[0]?.name,
      queryString: listedSearchBody.data[0]?.queryString,
    },
    {
      id: search.id,
      name: 'CSE systems',
      queryString: '?subjects=CSE&query=systems',
    },
  );
  assert.ok((listedSearchBody.data[0]?.createdAt ?? 0) > 0);

  const main = await owner.post('/api/savedWorksheets/ensure-main', {
    term: 'FA26',
  });
  assert.equal(main.status, 200);
  const mainWorksheet = (await main.json()) as { id: number };

  const savedAnonymous = await owner.post(
    '/api/savedWorksheets/from-anonymous',
    {
      name: 'Imported browser plan',
      term: 'FA26',
      courses: [{ sectionId: 'MATH-20C-A00', color: '#654321', hidden: true }],
    },
  );
  assert.equal(savedAnonymous.status, 200);
  const importedWorksheet = (await savedAnonymous.json()) as { id: number };

  const createdWorksheet = await owner.post(
    '/api/savedWorksheets/create-blank',
    { name: 'Systems plan', term: 'FA26' },
  );
  assert.equal(createdWorksheet.status, 200);
  const worksheet = (await createdWorksheet.json()) as { id: number };

  const listedWorksheets = await owner.get('/api/savedWorksheets?term=FA26');
  assert.equal(listedWorksheets.status, 200);
  assert.equal(listedWorksheets.headers.get('set-cookie'), null);
  const worksheetList = (await listedWorksheets.json()) as {
    data: { id: number }[];
  };
  const worksheetIds = worksheetList.data.map(({ id }) => id);
  assert.equal(worksheetIds.length, 3);
  assert.ok(worksheetIds.includes(mainWorksheet.id));
  assert.ok(worksheetIds.includes(importedWorksheet.id));
  assert.ok(worksheetIds.includes(worksheet.id));

  const updated = await owner.post(
    `/api/savedWorksheets/${worksheet.id}/sections`,
    {
      sections: [{ sectionId: 'CSE-100-A00', color: '#123456', hidden: false }],
    },
  );
  assert.equal(updated.status, 200);
  assert.deepEqual(
    ((await updated.json()) as { sections: unknown[] }).sections,
    [{ sectionId: 'CSE-100-A00', color: '#123456', hidden: false }],
  );

  const renamed = await owner.post(
    `/api/savedWorksheets/${worksheet.id}/rename`,
    { name: 'Renamed systems plan' },
  );
  assert.equal(renamed.status, 200);

  const restored = await owner.get(`/api/savedWorksheets/${worksheet.id}`);
  assert.equal(restored.status, 200);
  assert.equal(restored.headers.get('set-cookie'), null);
  const restoredBody = (await restored.json()) as {
    createdAt: number;
    updatedAt: number;
    [key: string]: unknown;
  };
  assert.ok(restoredBody.createdAt > 0);
  assert.ok(restoredBody.updatedAt >= restoredBody.createdAt);
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...restoredFields
  } = restoredBody;
  assert.deepEqual(restoredFields, {
    id: worksheet.id,
    name: 'Renamed systems plan',
    term: 'FA26',
    private: true,
    isMain: false,
    sourceSectionCount: 1,
    savedSectionCount: 1,
    sections: [{ sectionId: 'CSE-100-A00', color: '#123456', hidden: false }],
  });

  const other = owner.fork();
  await signIn(other, 'other@ucsd.edu', verificationCode);
  assert.deepEqual(await (await other.get('/api/savedSearches')).json(), {
    data: [],
  });
  assert.deepEqual(await (await other.get('/api/savedWorksheets')).json(), {
    data: [],
  });
  await expectNotFound(
    other.post('/api/savedSearches/delete', { id: search.id }),
    'SEARCH_NOT_FOUND',
  );
  await expectNotFound(
    other.get(`/api/savedWorksheets/${worksheet.id}`),
    'SAVED_WORKSHEET_NOT_FOUND',
  );
  await expectNotFound(
    other.post(`/api/savedWorksheets/${worksheet.id}/rename`, {
      name: 'Cross-user rename',
    }),
    'SAVED_WORKSHEET_NOT_FOUND',
  );
  await expectNotFound(
    other.post(`/api/savedWorksheets/${worksheet.id}/sections`, {
      sections: [],
    }),
    'SAVED_WORKSHEET_NOT_FOUND',
  );
  await expectNotFound(
    other.post(`/api/savedWorksheets/${worksheet.id}/delete`),
    'SAVED_WORKSHEET_NOT_FOUND',
  );

  const ownerStillHasWorksheet = await owner.get(
    `/api/savedWorksheets/${worksheet.id}`,
  );
  assert.equal(ownerStillHasWorksheet.status, 200);
  assert.equal(
    ((await ownerStillHasWorksheet.json()) as { name: string }).name,
    'Renamed systems plan',
  );

  assert.equal(
    (await owner.post('/api/savedSearches/delete', { id: search.id })).status,
    200,
  );
  assert.deepEqual(await (await owner.get('/api/savedSearches')).json(), {
    data: [],
  });
  assert.equal(
    (await owner.post(`/api/savedWorksheets/${worksheet.id}/delete`)).status,
    200,
  );
  assert.equal(
    (await owner.post(`/api/savedWorksheets/${importedWorksheet.id}/delete`))
      .status,
    200,
  );
  assert.equal(
    (await owner.get(`/api/savedWorksheets/${worksheet.id}`)).status,
    404,
  );

  const replayTarget = await owner.post('/api/savedSearches/create', {
    name: 'Replay target',
    queryString: '?subjects=MATH',
  });
  assert.equal(replayTarget.status, 200);
  const replaySearch = (await replayTarget.json()) as { id: number };
  const oldCookie = owner.getCookie();
  assert.equal((await owner.post('/api/auth/logout')).status, 200);

  await expectUnauthenticatedReplay(
    owner.getWithCookie('/api/savedSearches', oldCookie),
  );
  await expectUnauthenticatedReplay(
    owner.postWithCookie('/api/savedSearches/delete', oldCookie, {
      id: replaySearch.id,
    }),
  );
  await expectUnauthenticatedReplay(
    owner.postWithCookie(
      `/api/savedWorksheets/${worksheet.id}/sections`,
      oldCookie,
      { sections: [] },
    ),
  );
}

async function signIn(
  client: HostedLoginContractClient,
  email: string,
  verificationCode: (lookupEmail: string) => Promise<string>,
) {
  const requested = await client.post('/api/auth/ucsd/request-verification', {
    email,
  });
  assert.equal(requested.status, 200);
  const verified = await client.post('/api/auth/ucsd/verify', {
    email,
    code: await verificationCode(email),
  });
  assert.equal(verified.status, 200);
}

async function expectUnauthenticated(client: HostedLoginContractClient) {
  await expectUnauthenticatedReplay(client.get('/api/savedSearches'));
  await expectUnauthenticatedReplay(client.get('/api/savedWorksheets'));
}

async function expectUnauthenticatedReplay(response: Promise<Response>) {
  const resolved = await response;
  assert.equal(resolved.status, 401);
  assert.deepEqual(await resolved.json(), { error: 'USER_NOT_FOUND' });
}

async function expectNotFound(response: Promise<Response>, error: string) {
  const resolved = await response;
  assert.equal(resolved.status, 404);
  assert.deepEqual(await resolved.json(), { error });
}
