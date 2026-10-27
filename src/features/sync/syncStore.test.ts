import { eraseAllData } from '@/features/profile/userData';
import { useSyncStore, turnSyncOff } from '@/features/sync/syncStore';

const synced = () =>
  useSyncStore.setState({
    enabled: true,
    userId: 'u1',
    cursor: '2026-10-28T09:00:00.000Z',
    shadow: { weight_entries: { w1: 'abc' } },
    profileHash: 'p',
    lastSyncedAt: '2026-10-28T09:00:00.000Z',
  });

describe('sync settings', () => {
  it('turning sync off forgets the bookkeeping but not the account', () => {
    synced();
    turnSyncOff();
    expect(useSyncStore.getState()).toMatchObject({
      enabled: false,
      userId: 'u1',
      cursor: null,
      shadow: {},
      profileHash: null,
    });
  });

  it('erasing the phone turns sync off first, so nothing is deleted online', () => {
    synced();
    eraseAllData();
    expect(useSyncStore.getState()).toMatchObject({ enabled: false, shadow: {} });
  });
});
