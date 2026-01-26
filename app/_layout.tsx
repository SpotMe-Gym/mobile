import "../global.css";
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n'; // Import the instance
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { cssInterop } from 'nativewind';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

cssInterop(SafeAreaView, { className: 'style' });

export default function RootLayout() {
  const { hasCompletedOnboarding } = useUserStore();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [hasCompletedOnboarding, segments, isMounted]);

  if (!isMounted) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="workouts" options={{ headerShown: false }} />
              <Stack.Screen name="nutrition/search" options={{ headerShown: false }} />
              <Stack.Screen
                name="nutrition-detail"
                options={{
                  headerShown: false,
                  presentation: 'transparentModal',
                  animation: 'none',
                  animationDuration: 250,
                  gestureEnabled: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="body-weight-detail"
                options={{
                  presentation: 'transparentModal',
                  animation: 'none',
                  animationDuration: 250,
                  gestureEnabled: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen
                name="chat"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  contentStyle: { backgroundColor: '#09090b' },
                }}
              />
            </Stack>
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Force route refresh
