import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/features/account/supabase';
import { AUTH_REDIRECT_URL, SITE_URL } from '@/features/account/config';
import { formatAppleName, parseAuthRedirect } from '@/features/account/authRedirect';

export type AccountErrorKind =
  | 'notConfigured'
  | 'cancelled'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'emailTaken'
  | 'weakPassword'
  | 'network'
  | 'failed';

export class AccountError extends Error {
  constructor(
    public readonly kind: AccountErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'AccountError';
  }
}

function client(): SupabaseClient {
  if (!supabase) throw new AccountError('notConfigured');
  return supabase;
}

function fromAuthError(error: AuthError): AccountError {
  if (error.name === 'AuthRetryableFetchError' || error.status === 0)
    return new AccountError('network', error.message);
  switch (error.code) {
    case 'invalid_credentials':
      return new AccountError('invalidCredentials', error.message);
    case 'email_not_confirmed':
      return new AccountError('emailNotConfirmed', error.message);
    case 'user_already_exists':
    case 'email_exists':
      return new AccountError('emailTaken', error.message);
    case 'weak_password':
      return new AccountError('weakPassword', error.message);
    default:
      return new AccountError('failed', error.message);
  }
}

/** Google everywhere, and Apple on Android: Supabase's hosted flow in the system browser sheet (PKCE). */
async function signInWithBrowser(provider: 'google' | 'apple'): Promise<void> {
  const sb = client();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw fromAuthError(error);
  if (!data.url) throw new AccountError('failed');

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
  if (result.type !== 'success') throw new AccountError('cancelled');

  const redirect = parseAuthRedirect(result.url);
  if ('error' in redirect) {
    throw new AccountError(redirect.error === 'access_denied' ? 'cancelled' : 'failed', redirect.description);
  }
  const { error: exchangeError } = await sb.auth.exchangeCodeForSession(redirect.code);
  if (exchangeError) throw fromAuthError(exchangeError);
}

export function signInWithGoogle(): Promise<void> {
  return signInWithBrowser('google');
}

export async function isNativeAppleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
}

/** Native Sign in with Apple on iOS (ID token + nonce); the browser flow elsewhere. */
export async function signInWithApple(): Promise<void> {
  if (!(await isNativeAppleAvailable())) return signInWithBrowser('apple');
  const sb = client();

  // Apple gets the SHA-256 of the nonce, Supabase the raw value, so the token can't be replayed.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AccountError('cancelled');
    throw new AccountError('failed', e instanceof Error ? e.message : String(e));
  }
  if (!credential.identityToken) throw new AccountError('failed', 'No identity token from Apple');

  const { error } = await sb.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw fromAuthError(error);

  // Apple only shares the name on the very first sign-in: keep it.
  const fullName = formatAppleName(credential.fullName);
  if (fullName) await saveName(fullName);
}

/** Stores the name on the account and, if the profile has none yet, on the profile too. */
async function saveName(fullName: string): Promise<void> {
  const sb = client();
  const { data } = await sb.auth.updateUser({ data: { full_name: fullName } });
  const id = data.user?.id;
  if (id) await sb.from('profiles').update({ full_name: fullName }).eq('id', id).eq('full_name', '');
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw fromAuthError(error);
}

/** Returns whether the person must confirm their email before signing in. */
export async function signUpWithEmail(params: {
  email: string;
  password: string;
  name: string;
  language: string;
}): Promise<{ needsConfirmation: boolean }> {
  const language = params.language === 'it' ? 'it' : 'en';
  const { data, error } = await client().auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: { full_name: params.name.trim(), account_type: 'member', language },
      // The confirmation link opens the website; afterwards the person signs in here.
      emailRedirectTo: SITE_URL ? `${SITE_URL}/auth/confirm?next=/${language}/app` : undefined,
    },
  });
  if (error) throw fromAuthError(error);
  // With email confirmation on, an already-registered address comes back as a user without identities.
  if (data.user && data.user.identities?.length === 0) throw new AccountError('emailTaken');
  return { needsConfirmation: !data.session };
}

/** Sends the reset email; the new password is set on the website. */
export async function sendPasswordReset(email: string, language: string): Promise<void> {
  const lang = language === 'it' ? 'it' : 'en';
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: SITE_URL ? `${SITE_URL}/auth/confirm?next=/${lang}/reset-password` : undefined,
  });
  if (error) throw fromAuthError(error);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Account pages on the website (settings, deletion). Null when the site URL isn't set. */
export function websiteUrl(path: string, language: string): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL}/${language === 'it' ? 'it' : 'en'}${path}`;
}
