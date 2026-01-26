import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#09090b', // zinc-950
          borderTopColor: '#27272a', // zinc-800
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#3b82f6', // blue-500
        tabBarInactiveTintColor: '#71717a', // zinc-500
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          // hidden from tab bar but kept in structure if needed, or just rely on index
          // Actually profile is usually accessed via header, but if we want it in tabs we can keep it.
          // User said "have the profile on the left [of header]" so likely NOT in tabs or hidden.
          // Existing code had profile in `app/(tabs)/profile.tsx`?
          // Let's check if profile.tsx is in (tabs). Yes it is. 
          // But user wants "profile on the left" of header. 
          // Usually profile is NOT a tab if it's in the header.
          // Wait, `app/(tabs)/profile.tsx` exists. 
          // If I remove it from tabs config it might still be reachable if file exists in (tabs) folder but not explicitly defined as a Tab.Screen? 
          // No, expo-router (tabs) layout usually requires Tabs.Screen for each child.
          // User said "remove chat button from below". Didn't explicitly say remove Profile tab (if it exists).
          // Checking `app/(tabs)/_layout.tsx` original content... 
          // It only had `index` and `chat`. Profile was accessed via header button pushing to `/profile`.
          // Wait, `profile.tsx` IS in `app/(tabs)/` but was NOT in the `_layout.tsx` tabs list?
          // Let's check file list again.
          // `app/(tabs)/profile.tsx` exists.
          // If it's in `(tabs)` but not in `_layout.tsx`, it might not be rendered as a tab.
          // Actually, `app/profile.tsx` (moved out?) or `app/(tabs)/profile.tsx`?
          // User previously edited `app/(tabs)/profile.tsx`.
          // Previous `_layout.tsx` for tabs only showed `index` and `chat`.
          // So `profile` must be `app/profile.tsx` (not in tabs) OR `app/(tabs)/profile.tsx` treated as a stack?
          // Let's assume standard behavior: `profile` is not a tab.
          href: null,
        }}
      />
    </Tabs>
  );
}
