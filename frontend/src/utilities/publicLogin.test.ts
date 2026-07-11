import { describe, expect, it } from 'vitest';

import {
  parsePublicLoginEnabled,
  resolvePublicLoginRoute,
  shouldShowPublicLoginEntry,
} from './publicLogin';

describe('public login availability', () => {
  it('is fail-closed unless the environment value is exactly true', () => {
    expect(parsePublicLoginEnabled(undefined)).toBe(false);
    expect(parsePublicLoginEnabled('false')).toBe(false);
    expect(parsePublicLoginEnabled('TRUE')).toBe(false);
    expect(parsePublicLoginEnabled('true')).toBe(true);
  });

  it('shows public login entries only when enabled, while preserving sign-out', () => {
    expect(shouldShowPublicLoginEntry(false, false)).toBe(false);
    expect(shouldShowPublicLoginEntry(false, true)).toBe(true);
    expect(shouldShowPublicLoginEntry(true, false)).toBe(true);
  });

  it('allows anonymous catalog and worksheet routes in both states', () => {
    for (const enabled of [false, true]) {
      expect(resolvePublicLoginRoute('/catalog', false, enabled)).toBe('allow');
      expect(resolvePublicLoginRoute('/worksheet', false, enabled)).toBe(
        'allow',
      );
    }
  });

  it('gates the public login route and unauthenticated protected routes', () => {
    expect(resolvePublicLoginRoute('/login', false, true)).toBe('allow');
    expect(resolvePublicLoginRoute('/login', false, false)).toBe('catalog');
    expect(resolvePublicLoginRoute('/profile', false, true)).toBe('login');
    expect(resolvePublicLoginRoute('/profile', false, false)).toBe('catalog');
  });

  it('keeps authenticated protected routes available when public login is off', () => {
    expect(resolvePublicLoginRoute('/profile', true, false)).toBe('allow');
    expect(resolvePublicLoginRoute('/login', true, false)).toBe('catalog');
  });
});
