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
