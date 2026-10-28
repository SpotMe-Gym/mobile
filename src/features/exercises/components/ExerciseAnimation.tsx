import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Dumbbell } from 'lucide-react-native';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';

const FADE_MS = 450;
const HOLD_MS = 700;

/**
 * Shows an exercise moving: the start and end position photos, cross-fading in a loop.
 * `still` shows only the start position (lists and thumbnails). No photos → a neutral icon.
 */
export function ExerciseAnimation({
  frames,
  still = false,
  style,
  accessibilityLabel,
}: {
  frames: string[];
  still?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const end = useSharedValue(0);
  const animate = !still && frames.length >= 2;

  useEffect(() => {
    if (!animate) return;
    end.value = withRepeat(
      withSequence(
        withDelay(HOLD_MS, withTiming(1, { duration: FADE_MS })),
        withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS })),
      ),
      -1,
    );
    return () => cancelAnimation(end);
  }, [animate, end]);

  const endStyle = useAnimatedStyle(() => ({ opacity: end.value }));

  if (frames.length === 0) {
    return (
      <View
        style={style}
        className="items-center justify-center bg-surface-elevated"
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
      >
        <Icon icon={Dumbbell} size={22} color={colors.subtle} />
      </View>
    );
  }

  return (
    <View
      style={style}
      className="overflow-hidden bg-white"
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri: frames[0] }}
        style={{ position: 'absolute', inset: 0 }}
        contentFit="cover"
        transition={150}
      />
      {animate && (
        <Animated.View style={[{ position: 'absolute', inset: 0 }, endStyle]}>
          <Image source={{ uri: frames[1] }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </Animated.View>
      )}
    </View>
  );
}
