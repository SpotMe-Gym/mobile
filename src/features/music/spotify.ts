/**
 * Spotify through its Web API: what's playing, play / pause, previous / next. Works the same
 * on iPhone and Android, with no Spotify SDK in the app: sign-in uses PKCE (no client secret),
 * tokens live in the secure keychain / keystore.
 *
 * Setup (once): a Spotify developer app with the redirect URI below, its Client ID in
 * EXPO_PUBLIC_SPOTIFY_CLIENT_ID. Spotify's rules: the app owner needs Premium; a new app is
 * limited to 5 users until Spotify approves it; play / pause / skip need Premium too.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { NowPlaying } from '@/features/music/types';

export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
export const SPOTIFY_REDIRECT = 'spotme://spotify-auth';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'];
const TOKEN_KEY = 'spotify-tokens';
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

interface Tokens {
  access: string;
  refresh: string;
  /** ms */
  expiresAt: number;
}

export const spotifyConfigured = () => SPOTIFY_CLIENT_ID.length > 0;

const base64url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (bytes: number) =>
  Array.from(
    Crypto.getRandomBytes(bytes),
    (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[b % 66],
  ).join('');

let cached: Tokens | null | undefined;

async function readTokens(): Promise<Tokens | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    cached = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function writeTokens(tokens: Tokens | null) {
  cached = tokens;
  if (tokens) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function isSpotifyConnected() {
  return (await readTokens()) !== null;
}

/** Turns a token response into stored tokens (Spotify may or may not send a new refresh token). */
export function tokensFrom(
  json: { access_token: string; refresh_token?: string; expires_in: number },
  previousRefresh = '',
  now = Date.now(),
): Tokens {
  return {
    access: json.access_token,
    refresh: json.refresh_token ?? previousRefresh,
    // Refresh a minute early.
    expiresAt: now + (json.expires_in - 60) * 1000,
  };
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`spotify token ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Opens Spotify's sign-in; true once connected. */
export async function connectSpotify(): Promise<boolean> {
  if (!spotifyConfigured()) return false;
  const verifier = randomString(64);
  const challenge = base64url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );
  const state = randomString(16);
  const url =
    `${ACCOUNTS}/authorize?` +
    new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SCOPES.join(' '),
      state,
    }).toString();
  const result = await WebBrowser.openAuthSessionAsync(url, SPOTIFY_REDIRECT);
  if (result.type !== 'success') return false;
  const params = new URL(result.url).searchParams;
  const code = params.get('code');
  if (!code || params.get('state') !== state) return false;
  const json = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  await writeTokens(tokensFrom(json));
  return true;
}

export async function disconnectSpotify() {
  await writeTokens(null);
}

async function accessToken(): Promise<string | null> {
  const tokens = await readTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt) return tokens.access;
  try {
    const json = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh,
      client_id: SPOTIFY_CLIENT_ID,
    });
    const next = tokensFrom(json, tokens.refresh);
    await writeTokens(next);
    return next.access;
  } catch {
    await writeTokens(null); // revoked: sign in again
    return null;
  }
}

export class SpotifyError extends Error {
  constructor(public kind: 'notConnected' | 'premiumRequired' | 'noDevice' | 'error') {
    super(kind);
  }
}

async function call(path: string, method: 'GET' | 'PUT' | 'POST' = 'GET') {
  const token = await accessToken();
  if (!token) throw new SpotifyError('notConnected');
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    cached = cached ? { ...cached, expiresAt: 0 } : cached; // force a refresh next time
    throw new SpotifyError('notConnected');
  }
  if (res.status === 403) throw new SpotifyError('premiumRequired');
  if (res.status === 404) throw new SpotifyError('noDevice');
  if (!res.ok && res.status !== 204) throw new SpotifyError('error');
  return res;
}

/** Maps Spotify's currently-playing response (null when nothing plays). */
export function nowPlayingFrom(json: unknown): NowPlaying | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as {
    is_playing?: boolean;
    item?: {
      name?: string;
      artists?: { name?: string }[];
      album?: { images?: { url: string; width?: number }[] };
      show?: { name?: string; images?: { url: string }[] };
    };
  };
  if (!j.item?.name) return null;
  const images = j.item.album?.images ?? j.item.show?.images ?? [];
  // Smallest image that's still sharp at 48 pt (Spotify sorts largest first).
  const art =
    [...images].reverse().find((i) => !('width' in i) || ((i as { width?: number }).width ?? 0) >= 120) ??
    images[0];
  return {
    title: j.item.name,
    artist:
      j.item.artists
        ?.map((a) => a.name)
        .filter(Boolean)
        .join(', ') ||
      j.item.show?.name ||
      '',
    artwork: art?.url ?? null,
    isPlaying: !!j.is_playing,
    app: 'Spotify',
  };
}

export async function spotifyNowPlaying(): Promise<NowPlaying | null> {
  const res = await call('/me/player/currently-playing?additional_types=episode');
  if (res.status === 204) return null;
  return nowPlayingFrom(await res.json());
}

export const spotifyControls = {
  play: () => call('/me/player/play', 'PUT').then(() => undefined),
  pause: () => call('/me/player/pause', 'PUT').then(() => undefined),
  next: () => call('/me/player/next', 'POST').then(() => undefined),
  previous: () => call('/me/player/previous', 'POST').then(() => undefined),
};
