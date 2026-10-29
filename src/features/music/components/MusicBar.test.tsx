import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import { MusicBar } from '@/features/music/components/MusicBar';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('MusicBar', () => {
  it('without a source, offers to connect music and explains the options', async () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <MusicBar />
      </SafeAreaProvider>,
    );
    const connect = await screen.findByRole('button', { name: 'Connect your music' });
    fireEvent.press(connect);
    await waitFor(() => expect(screen.getByText('Spotify')).toBeTruthy());
    // No Client ID in tests, and no native module (as in Expo Go)
    expect(screen.getByText("Spotify isn't set up in this build yet.")).toBeTruthy();
    expect(screen.getByText(/need the SpotMe app build/)).toBeTruthy();
  });
});
