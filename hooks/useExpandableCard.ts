import { useEffect, useCallback, useState } from 'react';
import { Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CardParams {
  cardX?: string;
  cardY?: string;
  cardWidth?: string;
  cardHeight?: string;
}

export interface ExpandableCardConfig {
  openDuration?: number;
  closeDuration?: number;
  cardBorderRadius?: number;
}

export interface ExpandableCardResult {
  // Animation progress (0 = card, 1 = expanded)
  progress: SharedValue<number>;
  // Whether the card is currently closing
  isClosing: boolean;
  // Call this to close the card with animation
  handleClose: () => void;
  // Animated styles
  containerStyle: ReturnType<typeof useAnimatedStyle>;
  backdropStyle: ReturnType<typeof useAnimatedStyle>;
  detailContentStyle: ReturnType<typeof useAnimatedStyle>;
  previewContentStyle: ReturnType<typeof useAnimatedStyle>;
  // Card dimensions for custom positioning
  cardDimensions: {
    cardX: number;
    cardY: number;
    cardWidth: number;
    cardHeight: number;
    scaleX: number;
    scaleY: number;
  };
}

const DEFAULT_CONFIG: Required<ExpandableCardConfig> = {
  openDuration: 350,
  closeDuration: 250,
  cardBorderRadius: 16,
};

export function useExpandableCard(
  config: ExpandableCardConfig = {}
): ExpandableCardResult {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [isClosing, setIsClosing] = useState(false);

  const { openDuration, closeDuration, cardBorderRadius } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Parse card position from params (with fallbacks)
  const cardX = params.cardX ? parseFloat(params.cardX) : SCREEN_WIDTH * 0.52;
  const cardY = params.cardY ? parseFloat(params.cardY) : 280;
  const cardWidth = params.cardWidth ? parseFloat(params.cardWidth) : 170;
  const cardHeight = params.cardHeight ? parseFloat(params.cardHeight) : 176;

  // Calculate transform values for card -> fullscreen
  const scaleX = cardWidth / SCREEN_WIDTH;
  const scaleY = cardHeight / SCREEN_HEIGHT;

  // Translation: move from card center to screen center
  const cardCenterX = cardX + cardWidth / 2;
  const cardCenterY = cardY + cardHeight / 2;
  const screenCenterX = SCREEN_WIDTH / 2;
  const screenCenterY = SCREEN_HEIGHT / 2;
  const translateX = cardCenterX - screenCenterX;
  const translateY = cardCenterY - screenCenterY;

  // Animation progress (0 = card position, 1 = fullscreen)
  const progress = useSharedValue(0);

  // Start opening animation on mount
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: openDuration,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    progress.value = withTiming(0, {
      duration: closeDuration,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(router.back)();
      }
    });
  }, [isClosing, router, closeDuration]);

  // Container style using transforms (GPU accelerated)
  const containerStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [scaleX, 1]);
    const transX = interpolate(progress.value, [0, 1], [translateX, 0]);
    const transY = interpolate(progress.value, [0, 1], [translateY, 0]);
    const radius = interpolate(progress.value, [0, 1], [cardBorderRadius / scaleX, 0]);

    return {
      transform: [
        { translateX: transX },
        { translateY: transY },
        { scaleX: scale },
        { scaleY: interpolate(progress.value, [0, 1], [scaleY, 1]) },
      ],
      borderRadius: radius,
    };
  });

  // Backdrop opacity
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.2, 0.7]),
    };
  });

  // Detail content - fades out when closing
  const detailContentStyle = useAnimatedStyle(() => {
    // Delay appearance of detail content until card is mostly open
    // This prevents overlap and creates a cleaner "fill" effect
    // Start appearing at 0.6, fully visible at 1.0
    const opacity = interpolate(progress.value, [0.6, 1], [0, 1]);
    return { opacity };
  });

  // Preview content - visible when closing (shows home card content)
  const previewContentStyle = useAnimatedStyle(() => {
    // Fade out preview VERY early (0 -> 0.2)
    // This allows the container to expand as a "blank slate" before detail appears
    const opacity = interpolate(progress.value, [0, 0.2], [1, 0]);

    // Counter-scale to keep preview content at native size/aspect ratio
    // This prevents the text/gauge from being squashed by the container's scale
    const invScaleX = interpolate(progress.value, [0, 1], [1 / scaleX, 1]);
    const invScaleY = interpolate(progress.value, [0, 1], [1 / scaleY, 1]);

    return {
      opacity,
      transform: [
        { scaleX: invScaleX },
        { scaleY: invScaleY },
      ]
    };
  });

  return {
    progress,
    isClosing,
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
    cardDimensions: {
      cardX,
      cardY,
      cardWidth,
      cardHeight,
      scaleX,
      scaleY,
    },
  };
}

// Export screen dimensions for use in components
export { SCREEN_WIDTH, SCREEN_HEIGHT };
