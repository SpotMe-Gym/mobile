import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: true, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// React Native has no window focus: refetch stale queries when the app returns to foreground.
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});
