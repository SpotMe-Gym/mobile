import { useEffect, useCallback, useState, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useReducedMotion,
} from 'react-native-reanimated';

// Must use 'window' — measureInWindow returns window-relative coordinates
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import type { WidgetSize } from '../components/dashboard/widgetSizes';

export interface CardParams {
  cardX?: string;
  cardY?: string;
  cardWidth?: string;
  cardHeight?: string;
  widgetSize?: string;
}

export interface ExpandableCardConfig {
  openDuration?: number;
  closeDuration?: number;
  cardBorderRadius?: number;
  /** SharedValue Y offset to correct measureInWindow mismatch on Android (applied on UI thread) */
  containerOffsetY?: SharedValue<number>;
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
  /** Closed-card size token from the home grid — preview must use this, not infer. */
  widgetSize: WidgetSize;
}

const DEFAULT_CONFIG = {
  openDuration: 350,
  closeDuration: 250,
  cardBorderRadius: 16,
} as const;

function parseWidgetSize(value: string | undefined): WidgetSize {
  if (value === 'full' || value === 'half' || value === 'compact') return value;
  return 'half';
}

export function useExpandableCard(
  config: ExpandableCardConfig = {}
): ExpandableCardResult {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [isClosing, setIsClosing] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const { containerOffsetY, ...restConfig } = config;
  const { openDuration, closeDuration, cardBorderRadius } = {
    ...DEFAULT_CONFIG,
    ...restConfig,
  };

  const cardX = params.cardX ? parseFloat(params.cardX) : SCREEN_WIDTH * 0.52;
  const cardY = params.cardY ? parseFloat(params.cardY) : 280;
  const cardWidth = params.cardWidth ? parseFloat(params.cardWidth) : 170;
  const cardHeight = params.cardHeight ? parseFloat(params.cardHeight) : 176;
  const widgetSize = parseWidgetSize(params.widgetSize);

  const geometry = useMemo(() => {
    const scaleX = cardWidth / SCREEN_WIDTH;
    const scaleY = cardHeight / SCREEN_HEIGHT;
    const cardCenterX = cardX + cardWidth / 2;
    const cardCenterY = cardY + cardHeight / 2;
    const translateX = cardCenterX - SCREEN_WIDTH / 2;
    const translateY = cardCenterY - SCREEN_HEIGHT / 2;
    return { scaleX, scaleY, translateX, translateY };
  }, [cardX, cardY, cardWidth, cardHeight]);

  const { scaleX, scaleY, translateX, translateY } = geometry;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: openDuration,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const navigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    if (shouldReduceMotion) {
      navigateBack();
      return;
    }

    progress.value = withTiming(0, {
      duration: closeDuration,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(navigateBack)();
      }
    });
  }, [isClosing, closeDuration, shouldReduceMotion, navigateBack]);

  const containerStyle = useAnimatedStyle(() => {
    // Apply container offset on UI thread — corrects measureInWindow mismatch on Android
    const offsetY = containerOffsetY ? containerOffsetY.value : 0;
    
    const transX = interpolate(progress.value, [0, 1], [translateX, 0]);
    const transY = interpolate(progress.value, [0, 1], [translateY - offsetY, 0]);
    const sX = interpolate(progress.value, [0, 1], [scaleX, 1]);
    const sY = interpolate(progress.value, [0, 1], [scaleY, 1]);
    const radius = interpolate(progress.value, [0, 1], [cardBorderRadius / scaleX, 0]);

    return {
      transform: [
        { translateX: transX },
        { translateY: transY },
        { scaleX: sX },
        { scaleY: sY },
      ],
      borderRadius: radius,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.2, 0.7]),
  }));

  const detailContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 0.65], [0, 1]),
    pointerEvents: progress.value > 0.5 ? 'auto' : 'none',
  }));

  // Constant inverse scale: preview is laid out at the closed-card size and always
  // fills the morphing rectangle. Interpolating this toward 1 made content shrink
  // into the center on close, then pop back when the modal unmounted.
  const previewContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 0.7], [1, 1, 0]),
    transform: [
      { scaleX: 1 / scaleX },
      { scaleY: 1 / scaleY },
    ],
    pointerEvents: 'none',
  }));

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
    widgetSize,
  };
}

// Export screen dimensions for use in components
export { SCREEN_WIDTH, SCREEN_HEIGHT };
