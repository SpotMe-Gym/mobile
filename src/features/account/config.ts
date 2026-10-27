/**
 * Account backend (the same Supabase project as the website). Set these in `.env.local`; with
 * them missing the app works exactly as before and the account screens explain that sign-in
 * isn't available in this build.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
/** The website, for email links, password reset and account deletion. No trailing slash. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/** False for builds without the Sign In with Apple capability (see app.config.ts): Apple then uses the browser flow. */
export const NATIVE_APPLE_SIGN_IN = process.env.EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN !== 'false';

export const isAccountConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== '';

/** Where Supabase sends the browser back after Google / Apple (web flow). Add it to Supabase's redirect URLs. */
export const AUTH_REDIRECT_URL = 'spotme://auth/callback';
