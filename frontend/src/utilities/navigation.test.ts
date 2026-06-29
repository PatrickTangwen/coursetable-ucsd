import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}

describe('createCatalogLink', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('sessionStorage', createStorage());
  });

  it('restores catalog filters without stale modal query params', async () => {
    const { createCatalogLink } = await import('./navigation');

    sessionStorage.setItem(
      'lastCatalogSearch',
      '?course-modal=S126-4076195160&selectSubjects=ECON',
    );

    expect(createCatalogLink()).toBe('/catalog?selectSubjects=ECON');
  });

  it('falls back to catalog when only stale modal params were stored', async () => {
    const { createCatalogLink } = await import('./navigation');

    sessionStorage.setItem(
      'lastCatalogSearch',
      '?course-modal=S126-4076195160&prof-modal=123',
    );

    expect(createCatalogLink()).toBe('/catalog');
  });
});
