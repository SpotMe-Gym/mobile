/** What's playing, whatever the source. */
export interface NowPlaying {
  title: string;
  artist: string;
  /** http(s) URL or data: URI. */
  artwork: string | null;
  isPlaying: boolean;
  /** App name for Android players ("Spotify", "YouTube Music"). */
  app?: string;
}

export type MusicSource = 'spotify' | 'appleMusic' | 'android';

export interface MusicProblem {
  kind: 'notConnected' | 'noAccess' | 'nothingPlaying' | 'premiumRequired' | 'noDevice' | 'error';
}
