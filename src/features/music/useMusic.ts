import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NowPlayingModule,
  nowPlayingAvailable,
  type NowPlayingAccess,
} from '../../../modules/spotme-now-playing';
import {
  isSpotifyConnected,
  spotifyConfigured,
  spotifyControls,
  spotifyNowPlaying,
  SpotifyError,
} from '@/features/music/spotify';
import type { MusicProblem, MusicSource, NowPlaying } from '@/features/music/types';

/** Which source the music bar uses: Spotify if connected, else the phone's own player. */
export const useMusicPrefs = create<{
  preferred: 'spotify' | 'phone';
  setPreferred: (p: 'spotify' | 'phone') => void;
}>()(
  persist((set) => ({ preferred: 'spotify', setPreferred: (preferred) => set({ preferred }) }), {
    name: 'music-prefs',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export const phoneSource: MusicSource | null = nowPlayingAvailable
  ? Platform.OS === 'ios'
    ? 'appleMusic'
    : 'android'
  : null;

const POLL_MS = 3000;

/**
 * The song playing now and play / pause / previous / next, from Spotify (Web API) or the phone
 * (Apple Music on iPhone, any player on Android). Polls every few seconds while shown.
 */
export function useMusic() {
  const preferred = useMusicPrefs((s) => s.preferred);
  const [spotify, setSpotify] = useState<boolean | null>(null);
  const [phoneAccess, setPhoneAccess] = useState<NowPlayingAccess | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [problem, setProblem] = useState<MusicProblem | null>(null);
  const busy = useRef(false);

  const source: MusicSource | null =
    spotify && (preferred === 'spotify' || !phoneSource)
      ? 'spotify'
      : phoneSource && phoneAccess === 'granted'
        ? phoneSource
        : spotify
          ? 'spotify'
          : null;

  const refreshAccess = useCallback(async () => {
    setSpotify(spotifyConfigured() ? await isSpotifyConnected() : false);
    if (NowPlayingModule) setPhoneAccess(await NowPlayingModule.getAccess().catch(() => 'denied' as const));
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (source === 'spotify') {
        const np = await spotifyNowPlaying();
        setNowPlaying(np);
        setProblem(np ? null : { kind: 'nothingPlaying' });
      } else if (source && NowPlayingModule) {
        const np = await NowPlayingModule.getNowPlaying();
        setNowPlaying(
          np
            ? {
                title: np.title,
                artist: np.artist,
                artwork: np.artworkBase64 ? `data:image/jpeg;base64,${np.artworkBase64}` : null,
                isPlaying: np.isPlaying,
                app: np.appName ?? undefined,
              }
            : null,
        );
        setProblem(np ? null : { kind: 'nothingPlaying' });
      } else {
        setNowPlaying(null);
        setProblem({ kind: 'notConnected' });
      }
    } catch (e) {
      setProblem({ kind: e instanceof SpotifyError ? e.kind : 'error' });
      if (e instanceof SpotifyError && e.kind === 'notConnected') void refreshAccess();
    } finally {
      busy.current = false;
    }
  }, [source, refreshAccess]);

  useEffect(() => {
    const first = setTimeout(() => void refreshAccess(), 0);
    return () => clearTimeout(first);
  }, [refreshAccess]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const run = useCallback(
    async (action: 'play' | 'pause' | 'next' | 'previous') => {
      try {
        if (source === 'spotify') await spotifyControls[action]();
        else if (source && NowPlayingModule) await NowPlayingModule[action]();
        // Show the change right away, then confirm.
        if (action === 'play' || action === 'pause')
          setNowPlaying((np) => (np ? { ...np, isPlaying: action === 'play' } : np));
        setTimeout(() => void refresh(), 500);
      } catch (e) {
        setProblem({ kind: e instanceof SpotifyError ? e.kind : 'error' });
      }
    },
    [source, refresh],
  );

  return { source, nowPlaying, problem, spotifyConnected: !!spotify, phoneAccess, refreshAccess, run };
}
