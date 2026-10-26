import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Zustand persist adapter over a synchronous MMKV instance (small key-value data only). */
export function mmkvStateStorage(instance: MMKV): StateStorage {
  return {
    setItem: (name, value) => instance.set(name, value),
    getItem: (name) => instance.getString(name) ?? null,
    removeItem: (name) => {
      instance.remove(name);
    },
  };
}

export const userMMKV = createMMKV({ id: 'user-storage' });

/** Hand-off key used to move weight history out of the user store (MMKV) into its own store. */
export const LEGACY_WEIGHT_KEY = 'legacy-weight-history';
