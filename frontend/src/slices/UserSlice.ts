import type { StateCreator } from 'zustand';
import {
  fetchUserWorksheets,
  type AppUserInfo,
  type UserWorksheets,
  type FriendRecord,
} from '../queries/api';
import type { Store } from '../store';

interface UserState {
  user?: AppUserInfo;
  worksheets?: UserWorksheets;
  friends?: FriendRecord;
  sameCourseIdToCrns?: { [key: string]: number[] };
}

interface UserActions {
  worksheetsRefresh: () => Promise<void>;
}

export interface UserSlice extends UserState, UserActions {}

export const createUserSlice: StateCreator<Store, [], [], UserSlice> = (
  set,
) => ({
  user: undefined,
  worksheets: undefined,
  friends: undefined,
  sameCourseIdToCrns: undefined,
  async worksheetsRefresh() {
    const data = await fetchUserWorksheets();
    set({ worksheets: data?.data });
  },
});
