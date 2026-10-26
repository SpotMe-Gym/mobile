import '@/global.css';
import '@/i18n';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { cssInterop } from 'nativewind';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useUserStore } from '@/features/profile/userStore';
import { useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useWorkoutStore } from '@/features/workouts/workoutStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { queryClient } from '@/shared/lib/queryClient';
import { colors } from '@/theme/colors';
import { ErrorFallback } from '@/shared/components/ErrorFallback';

void SplashScreen.preventAutoHideAsync().catch(() => {});

// NativeWind's runtime (react-native-css-interop) touches React Native's deprecated
// ImageBackground export when it loads, which logs a deprecation warning we can't fix here.
// The app itself never uses ImageBackground. Remove once NativeWind stops referencing it.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

cssInterop(SafeAreaView, { className: 'style' });

export { ErrorFallback as ErrorBoundary };

// Expandable-card detail screens: the card itself animates, the navigator must not.
const EXPANDABLE = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function RootLayout() {
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const nutritionReady = useHasHydrated(useNutritionStore);
  const workoutsReady = useHasHydrated(useWorkoutStore);
  const weightReady = useHasHydrated(useWeightStore);
  const ready = nutritionReady && workoutsReady && weightReady;

  // Keep the native splash up until AsyncStorage stores are read, so no screen ever
  // renders seed/empty state first.
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Safety net: never keep the splash up forever if a storage read hangs or fails.
  useEffect(() => {
    const timer = setTimeout(() => void SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={!hasCompletedOnboarding}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>

            <Stack.Protected guard={hasCompletedOnboarding}>
              <Stack.Screen name="index" />
              <Stack.Screen name="profile/index" />
              <Stack.Screen name="settings/units" />
              <Stack.Screen name="settings/language" />
              <Stack.Screen name="workouts/index" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="workouts/create" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="nutrition/search" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="nutrition/product/[code]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="nutrition/quick-add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="nutrition/detail" options={EXPANDABLE} />
              <Stack.Screen name="body-weight/index" options={EXPANDABLE} />
              <Stack.Screen name="workouts/today" options={EXPANDABLE} />
              <Stack.Screen
                name="chat"
                options={{
                  presentation: 'modal',
                  contentStyle: { backgroundColor: colors['surface-sunken'] },
                }}
              />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
