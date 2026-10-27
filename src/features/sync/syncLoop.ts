import { AppState } from 'react-native';
import { supabase } from '@/features/account/supabase';
import { useAccountStore } from '@/features/account/accountStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useBodyStore } from '@/features/body/bodyStore';
import { useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useWorkoutStore } from '@/features/workouts/workoutStore';
import { useUserStore } from '@/features/profile/userStore';
import { reportError } from '@/shared/lib/reporting';
import { syncOnce } from '@/features/sync/engine';
import { isApplyingRemote } from '@/features/sync/local';
import { useSyncStore } from '@/features/sync/syncStore';

const AFTER_EDIT_MS = 3000;
const PERIODIC_MS = 5 * 60 * 1000;
const FOREGROUND_MIN_GAP_MS = 30 * 1000;

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const persisted = [useWeightStore, useBodyStore, useNutritionStore, useWorkoutStore];

function hydrated(): Promise<void> {
  return Promise.all(
    persisted.map(
      (store) =>
        new Promise<void>((resolve) => {
          if (store.persist.hasHydrated()) resolve();
          else {
            const off = store.persist.onFinishHydration(() => {
              off();
              resolve();
            });
          }
        }),
    ),
  ).then(() => undefined);
}

function ready(): { userId: string } | null {
  const account = useAccountStore.getState();
  const sync = useSyncStore.getState();
  if (!supabase || account.status !== 'signedIn' || !account.user || !sync.enabled) return null;
  return { userId: account.user.id };
}

async function run(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  const target = ready();
  if (!target || !supabase) return;
  running = true;
  useSyncStore.setState({ status: 'syncing', errorKind: null });
  try {
    await hydrated();
    if (useSyncStore.getState().userId !== target.userId) useSyncStore.getState().resetFor(target.userId);
    await syncOnce(supabase, target.userId);
    useSyncStore.setState({ status: 'idle' });
  } catch (error) {
    const network =
      error instanceof TypeError || /network|fetch|timeout/i.test(String((error as Error)?.message));
    useSyncStore.setState({ status: 'error', errorKind: network ? 'network' : 'failed' });
    if (!network) reportError(error, { context: 'sync' });
  } finally {
    running = false;
    if (again) {
      again = false;
      requestSync(AFTER_EDIT_MS);
    }
  }
}

/** Sync soon (debounced). Does nothing unless signed in with sync on. */
export function requestSync(delayMs = 0): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, delayMs);
}

/** Starts the triggers: sign-in, turning sync on, edits, coming to the foreground, every 5 minutes. */
export function startSyncLoop(): () => void {
  const offs: (() => void)[] = [];

  offs.push(
    useAccountStore.subscribe((s, prev) => {
      if (s.status === 'signedOut' && prev.status === 'signedIn') {
        useSyncStore.getState().setEnabled(false); // signing out stops sync; the account keeps its data
        useSyncStore.getState().resetFor(null);
      }
      if (s.status === 'signedIn' && s.user?.id !== prev.user?.id) requestSync();
    }),
  );
  offs.push(
    useSyncStore.subscribe((s, prev) => {
      if (s.enabled && !prev.enabled) requestSync();
    }),
  );
  for (const store of [...persisted, useUserStore] as { subscribe: (fn: () => void) => () => void }[]) {
    offs.push(
      store.subscribe(() => {
        if (!isApplyingRemote() && useSyncStore.getState().enabled) requestSync(AFTER_EDIT_MS);
      }),
    );
  }
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    const last = useSyncStore.getState().lastSyncedAt;
    if (!last || Date.now() - Date.parse(last) > FOREGROUND_MIN_GAP_MS) requestSync();
  });
  offs.push(() => appState.remove());
  const interval = setInterval(() => {
    if (AppState.currentState === 'active') requestSync();
  }, PERIODIC_MS);
  offs.push(() => clearInterval(interval));

  requestSync(); // app start
  return () => {
    for (const off of offs) off();
    if (timer) clearTimeout(timer);
  };
}
