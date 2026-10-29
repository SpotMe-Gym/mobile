import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BleManager from 'react-native-ble-manager';
import '@/i18n';
import { HeartRateSheet } from '@/features/heartRate/components/HeartRateSheet';
import { useHeartRateStore } from '@/features/heartRate/heartRateStore';
import { onHeartRate } from '@/features/heartRate/bleHeartRate';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ble = BleManager as unknown as Record<string, jest.Mock>;
const handler = (name: string) => ble[name]!.mock.calls[0]![0] as (e: unknown) => void;

describe('heart rate monitor', () => {
  it('finds a monitor, connects to the Heart Rate service and reads bpm', async () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HeartRateSheet visible onClose={() => undefined} />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Search for monitors' }));
    await waitFor(() =>
      expect(ble.scan).toHaveBeenCalledWith(expect.objectContaining({ serviceUUIDs: ['180D'] })),
    );

    act(() =>
      handler('onDiscoverPeripheral')({ id: 'AA', name: 'Polar H10 1234', rssi: -50, advertising: {} }),
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Connect to Polar H10 1234' }));
    await waitFor(() => expect(ble.startNotification).toHaveBeenCalledWith('AA', '180D', '2A37'));
    expect(useHeartRateStore.getState().saved).toEqual({ id: 'AA', name: 'Polar H10 1234' });

    const readings: number[] = [];
    const off = onHeartRate((bpm) => readings.push(bpm));
    act(() =>
      handler('onDidUpdateValueForCharacteristic')({
        characteristic: '2a37',
        peripheral: 'AA',
        service: '180d',
        value: [0x06, 128],
      }),
    );
    off();
    expect(readings).toEqual([128]);
    expect(useHeartRateStore.getState()).toMatchObject({ bpm: 128, status: 'connected', contact: true });
    expect(await screen.findByText('128 bpm now')).toBeTruthy();
  });
});
