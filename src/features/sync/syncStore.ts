import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import { mmkvStateStorage } from '@/shared/lib/storage';
import type { SyncTable } from '@/features/sync/wire';

const syncMMKV = createMMKV({ id: 'sync-storage' });

export type SyncStatus = 'idle' | 'syncing' | 'error';
export type SyncErrorKind = 'network' | 'failed';

interface SyncPersisted {
  /** The person's choice. Off until they opt in (sign-in checkbox or the Account screen). */
  enabled: boolean;
  /** Account the shadow below belongs to. A different account starts over with a fresh merge. */
  userId: string | null;
  /** Server time of the newest change already pulled. */
  cursor: string | null;
  /** Per table: record id → fingerprint of the version both sides last agreed on. */
  shadow: Partial<Record<SyncTable, Record<string, string>>>;
  profileHash: string | null;
  lastSyncedAt: string | null;
}

interface SyncState extends SyncPersisted {
  status: SyncStatus;
  errorKind: SyncErrorKind | null;
  setEnabled: (enabled: boolean) => void;
  /** Forget what was synced (the account keeps its data). */
  resetFor: (userId: string | null) => void;
}

const fresh = {
  cursor: null,
  shadow: {},
  profileHash: null,
  lastSyncedAt: null,
} satisfies Partial<SyncPersisted>;

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      enabled: false,
      userId: null,
      ...fresh,
      status: 'idle',
      errorKind: null,
      setEnabled: (enabled) =>
        set((s) =>
          enabled ? { enabled } : { enabled, ...fresh, userId: s.userId, status: 'idle', errorKind: null },
        ),
      resetFor: (userId) => set({ userId, ...fresh, status: 'idle', errorKind: null }),
    }),
    {
      name: 'sync-state',
      storage: createJSONStorage(() => mmkvStateStorage(syncMMKV)),
      version: 1,
      partialize: ({ enabled, userId, cursor, shadow, profileHash, lastSyncedAt }) => ({
        enabled,
        userId,
        cursor,
        shadow,
        profileHash,
        lastSyncedAt,
      }),
    },
  ),
);

/** Stop syncing and forget the sync bookkeeping. Data stays on the phone and in the account. */
export function turnSyncOff(): void {
  useSyncStore.getState().setEnabled(false);
}
