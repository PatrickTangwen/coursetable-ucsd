import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadCatalogPastGrades,
  resetCatalogDetailsCache,
} from './ferryCatalogDetailsCache';
import { fetchCatalogDetails } from '../queries/api';
import type { Season } from '../queries/graphql-types';

vi.mock('../queries/api', () => ({
  fetchCatalogDetails: vi.fn(),
}));

const season = 'FA26' as Season;
const record = {
  subject: 'CSE',
  course: '1',
  year: '2025',
  quarter: 'FA',
  title: 'Tracer Course',
  instructor: 'Ada Lovelace',
  gpa: 3.8,
  a: 50,
  b: 30,
  c: 10,
  d: 2,
  f: 1,
  w: 2,
  p: 4,
  np: 1,
  raw: { source: 'fixture' },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise resolver is not initialized');
  };
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('Catalog details cache', () => {
  beforeEach(() => {
    resetCatalogDetailsCache();
    vi.mocked(fetchCatalogDetails).mockReset();
  });

  it('coalesces term detail requests and reuses the result across courses', async () => {
    vi.mocked(fetchCatalogDetails).mockResolvedValue(
      new Map([
        ['CSE:1', [record]],
        ['CSE:2', []],
      ]),
    );

    const [first, second] = await Promise.all([
      loadCatalogPastGrades(season, 'CSE:1'),
      loadCatalogPastGrades(season, 'CSE:2'),
    ]);
    const cached = await loadCatalogPastGrades(season, 'CSE:1');

    expect(first).toEqual([record]);
    expect(second).toEqual([]);
    expect(cached).toEqual([record]);
    expect(fetchCatalogDetails).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed request so the user can retry', async () => {
    vi.mocked(fetchCatalogDetails)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Map([['CSE:1', [record]]]));

    await expect(loadCatalogPastGrades(season, 'CSE:1')).rejects.toThrow(
      'Catalog details are unavailable',
    );
    await expect(loadCatalogPastGrades(season, 'CSE:1')).resolves.toEqual([
      record,
    ]);
    expect(fetchCatalogDetails).toHaveBeenCalledTimes(2);
  });

  it('rejects an inconsistent detail payload that omits the requested course', async () => {
    vi.mocked(fetchCatalogDetails).mockResolvedValue(new Map());

    await expect(loadCatalogPastGrades(season, 'CSE:1')).rejects.toThrow(
      'Catalog details do not include CSE:1',
    );
  });

  it('does not let an obsolete request repopulate or clear the cache after reset', async () => {
    const oldRequest = deferred<Map<string, (typeof record)[]>>();
    const newRequest = deferred<Map<string, (typeof record)[]>>();
    vi.mocked(fetchCatalogDetails)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = loadCatalogPastGrades(season, 'CSE:1');
    resetCatalogDetailsCache();
    const newLoad = loadCatalogPastGrades(season, 'CSE:1');
    oldRequest.resolve(new Map([['CSE:1', [{ ...record, year: '2024' }]]]));
    await expect(oldLoad).resolves.toEqual([{ ...record, year: '2024' }]);
    const loadWhileNewRequestIsPending = loadCatalogPastGrades(season, 'CSE:1');
    newRequest.resolve(new Map([['CSE:1', [record]]]));

    await expect(newLoad).resolves.toEqual([record]);
    await expect(loadWhileNewRequestIsPending).resolves.toEqual([record]);
    await expect(loadCatalogPastGrades(season, 'CSE:1')).resolves.toEqual([
      record,
    ]);
    expect(fetchCatalogDetails).toHaveBeenCalledTimes(2);
  });
});
