import "../global.css";
import { Stack, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';

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
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="nutrition-modal" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </View>
  );
}
