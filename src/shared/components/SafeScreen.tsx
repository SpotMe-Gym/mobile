import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/shared/lib/cn';

type Edge = 'top' | 'bottom';

/**
 * Screen root that keeps the content clear of the status bar / Dynamic Island.
 *
 * Uses the app root's insets rather than the native SafeAreaView: inside native-stack modals
 * (full-screen and transparent ones) SafeAreaView can measure a top inset of 0, which put the
 * header and its back button underneath the status bar where it can't be tapped.
 *
 * `sheet`: an iOS page sheet already starts below the status bar, so it gets no top inset
 * there; on Android a "sheet" is full screen and gets the inset like any other screen.
 */
export function SafeScreen({
  children,
  className,
  style,
  edges = ['top'],
  sheet = false,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  sheet?: boolean;
}) {
  const top = useTopInset(sheet);
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn('flex-1', className)}
      style={[
        {
          paddingTop: edges.includes('top') ? top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Top inset for a screen or a page sheet (see SafeScreen). */
export function useTopInset(sheet = false): number {
  const insets = useSafeAreaInsets();
  return sheet && Platform.OS === 'ios' ? 0 : insets.top;
}
