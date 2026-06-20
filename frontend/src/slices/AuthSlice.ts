import type { StateCreator } from 'zustand';
import { fetchCurrentUser } from '../queries/api';
import type { Store } from '../store';

type AuthStatus =
  | 'loading'
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated';

interface AuthSliceState {
  authStatus: AuthStatus;
}

interface AuthSliceActions {
  refreshAuth: () => Promise<void>;
}

export interface AuthSlice extends AuthSliceState, AuthSliceActions {}

export const createAuthSlice: StateCreator<Store, [], [], AuthSlice> = (
  set,
) => ({
  authStatus: 'loading',
  async refreshAuth() {
    set({ authStatus: 'loading' });
    const user = await fetchCurrentUser();
    if (user) {
      set({ user, authStatus: 'authenticated' });
      return;
    }
    set({
      user: undefined,
      authStatus: 'unauthenticated',
    });
  },
});
