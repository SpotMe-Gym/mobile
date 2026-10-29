import { nowPlayingFrom, tokensFrom } from '@/features/music/spotify';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({}));

describe('spotify', () => {
  it('reads the currently playing track', () => {
    expect(
      nowPlayingFrom({
        is_playing: true,
        item: {
          name: 'Till I Collapse',
          artists: [{ name: 'Eminem' }, { name: 'Nate Dogg' }],
          album: {
            images: [
              { url: 'big', width: 640 },
              { url: 'mid', width: 300 },
              { url: 'small', width: 64 },
            ],
          },
        },
      }),
    ).toEqual({
      title: 'Till I Collapse',
      artist: 'Eminem, Nate Dogg',
      artwork: 'mid',
      isPlaying: true,
      app: 'Spotify',
    });
    expect(nowPlayingFrom(null)).toBeNull();
    expect(nowPlayingFrom({ is_playing: false })).toBeNull();
  });

  it('keeps the old refresh token when Spotify does not send a new one', () => {
    expect(tokensFrom({ access_token: 'a', expires_in: 3600 }, 'r0', 0)).toEqual({
      access: 'a',
      refresh: 'r0',
      expiresAt: 3_540_000,
    });
    expect(tokensFrom({ access_token: 'a', refresh_token: 'r1', expires_in: 3600 }, 'r0', 0).refresh).toBe(
      'r1',
    );
  });
});
