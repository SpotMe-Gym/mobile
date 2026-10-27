import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';
import { isAccountConfigured, SUPABASE_KEY, SUPABASE_URL } from '@/features/account/config';

// Session tokens live in their own MMKV file, so "erase all data" and the auth session are
// independent (signing out is explicit).
const authMMKV = createMMKV({ id: 'auth-storage' });

export const supabase: SupabaseClient | null = isAccountConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: {
          getItem: (key) => authMMKV.getString(key) ?? null,
          setItem: (key, value) => authMMKV.set(key, value),
          removeItem: (key) => {
            authMMKV.remove(key);
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

// Refresh tokens only while the app is in the foreground (Supabase's React Native guidance).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
