/* global jest */
require('react-native-get-random-values');

jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  return {
    createMMKV: ({ id } = { id: 'default' }) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const map = stores.get(id);
      return {
        set: (k, v) => map.set(k, v),
        getString: (k) => map.get(k),
        remove: (k) => map.delete(k),
        clearAll: () => map.clear(),
      };
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

// The exercise photo cross-fade runs on Reanimated, which has no native side under Jest.
// Widgets and screens that show it import it indirectly (e.g. through the widget catalog).
jest.mock('@/features/exercises/components/ExerciseAnimation', () => ({ ExerciseAnimation: () => null }));

// Native modules of the workout player: no hardware under Jest.
jest.mock('react-native-ble-manager', () => {
  const sub = () => ({ remove: jest.fn() });
  const manager = {
    start: jest.fn(() => Promise.resolve()),
    checkState: jest.fn(() => Promise.resolve('on')),
    scan: jest.fn(() => Promise.resolve()),
    stopScan: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    retrieveServices: jest.fn(() => Promise.resolve({})),
    startNotification: jest.fn(() => Promise.resolve()),
    stopNotification: jest.fn(() => Promise.resolve()),
    onDidUpdateValueForCharacteristic: jest.fn(sub),
    onDisconnectPeripheral: jest.fn(sub),
    onDidUpdateState: jest.fn(sub),
    onDiscoverPeripheral: jest.fn(sub),
    onStopScan: jest.fn(sub),
  };
  return {
    __esModule: true,
    default: manager,
    BleState: {
      Unknown: 'unknown',
      Resetting: 'resetting',
      Unsupported: 'unsupported',
      Unauthorized: 'unauthorized',
      On: 'on',
      Off: 'off',
    },
  };
});
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(), remove: jest.fn() })),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('n1')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
