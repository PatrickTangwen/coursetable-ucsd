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
      expect(resolvePublicLoginRoute('/catalog', false, enabled)).toEqual({
        type: 'allow',
      });
      expect(resolvePublicLoginRoute('/worksheet', false, enabled)).toEqual({
        type: 'allow',
      });
    }
  });

  it('gates the public login route and unauthenticated protected routes', () => {
    expect(resolvePublicLoginRoute('/login', false, true)).toEqual({
      type: 'allow',
    });
    expect(resolvePublicLoginRoute('/login', false, false)).toEqual({
      type: 'redirect',
      to: '/catalog',
    });
    expect(resolvePublicLoginRoute('/profile', false, true)).toEqual({
      type: 'redirect',
      to: '/login',
    });
    expect(resolvePublicLoginRoute('/profile', false, false)).toEqual({
      type: 'redirect',
      to: '/catalog',
    });
  });

  it('keeps authenticated protected routes available when public login is off', () => {
    expect(resolvePublicLoginRoute('/profile', true, false)).toEqual({
      type: 'allow',
    });
    expect(resolvePublicLoginRoute('/login', true, false)).toEqual({
      type: 'redirect',
      to: '/catalog',
    });
  });
});
