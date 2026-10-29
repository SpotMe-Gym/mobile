import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * What's playing on the phone, and the basic controls.
 *
 *   iOS:     Apple Music (the system music player). Other apps can't be read on iOS.
 *   Android: any app with a media session (Spotify, YouTube Music, …), once the user turns on
 *            notification access for SpotMe (that's how Android lets an app see media sessions).
 *
 * null in Expo Go and tests (the native module isn't there): the music bar falls back.
 */
export interface NativeNowPlaying {
  title: string;
  artist: string;
  /** base64 JPEG, small. */
  artworkBase64: string | null;
  isPlaying: boolean;
  /** Android: the app playing it. */
  appName?: string | null;
}

type Access = 'granted' | 'denied' | 'notDetermined' | 'restricted';

interface NativeModule {
  getAccess(): Promise<Access>;
  requestAccess(): Promise<Access>;
  /** Android: opens the notification access settings. */
  openAccessSettings(): Promise<void>;
  getNowPlaying(): Promise<NativeNowPlaying | null>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}

const native = requireOptionalNativeModule<NativeModule>('SpotmeNowPlaying');

export const nowPlayingAvailable = native !== null && (Platform.OS === 'ios' || Platform.OS === 'android');
export const NowPlayingModule = native;
export type { Access as NowPlayingAccess };
