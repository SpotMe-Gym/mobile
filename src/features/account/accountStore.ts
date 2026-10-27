import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/features/account/supabase';

export type AccountStatus = 'unavailable' | 'loading' | 'signedOut' | 'signedIn';

interface AccountState {
  status: AccountStatus;
  user: User | null;
}

/** Mirrors the Supabase session. Not persisted: Supabase keeps the session itself. */
export const useAccountStore = create<AccountState>(() => ({
  status: supabase ? 'loading' : 'unavailable',
  user: null,
}));

/** Call once at startup. Returns the unsubscribe function. */
export function watchAccount(): () => void {
  if (!supabase) return () => {};
  const apply = (user: User | null) =>
    useAccountStore.setState({ status: user ? 'signedIn' : 'signedOut', user });

  void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

/** Providers the signed-in account can use: 'email', 'apple', 'google'. */
export function accountProviders(user: User | null): string[] {
  const fromIdentities = user?.identities?.map((i) => i.provider) ?? [];
  const fromMeta = (user?.app_metadata?.providers as string[] | undefined) ?? [];
  return [...new Set([...fromIdentities, ...fromMeta])];
}
