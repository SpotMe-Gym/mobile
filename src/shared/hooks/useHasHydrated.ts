import { useSyncExternalStore } from 'react';

interface HydratableStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: (state: unknown) => void) => () => void;
  };
}

/**
 * Subscribes to a persisted Zustand store's rehydration lifecycle.
 *
 * Until this returns true the store still holds the seed state declared in its creator,
 * not the user's data. Anything that renders persisted values — or draws a conclusion
 * from their absence, like an "empty" or "rest day" state — must wait for it.
 *
 * Correct for both storage engines: AsyncStorage-backed stores resolve a tick or more
 * after mount, while MMKV-backed stores hydrate synchronously during store creation and
 * so report true on the very first render.
 */
export function useHasHydrated(store: HydratableStore): boolean {
  // Zustand already tracks this; useSyncExternalStore avoids the extra render that a
  // useState + useEffect subscription would introduce.
  return useSyncExternalStore(store.persist.onFinishHydration, store.persist.hasHydrated);
}
