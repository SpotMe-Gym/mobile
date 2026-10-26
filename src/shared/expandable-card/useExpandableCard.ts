import { useEffect, useCallback, useState, useMemo } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { CardSize } from '@/shared/expandable-card/types';

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
  /** Y offset correcting the measureInWindow mismatch on Android (applied on the UI thread). */
  containerOffsetY?: SharedValue<number>;
}

export interface CardDimensions {
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  scaleX: number;
  scaleY: number;
}

type AnimatedStyle = ReturnType<typeof useAnimatedStyle>;

export interface ExpandableCardResult {
  /** 0 = card, 1 = expanded. */
  progress: SharedValue<number>;
  isClosing: boolean;
  handleClose: () => void;
  containerStyle: AnimatedStyle;
  backdropStyle: AnimatedStyle;
  detailContentStyle: AnimatedStyle;
  previewContentStyle: AnimatedStyle;
  cardDimensions: CardDimensions;
  /** Closed-card size token from the home grid — the preview must use this, not infer. */
  widgetSize: CardSize;
  /** Window size the animation is computed against (matches measureInWindow). */
  window: { width: number; height: number };
}

const DEFAULT_CONFIG = { openDuration: 350, closeDuration: 250, cardBorderRadius: 16 } as const;

function parseWidgetSize(value: string | undefined): CardSize {
  return value === 'full' || value === 'half' || value === 'compact' ? value : 'half';
}

const parseParam = (v: string | undefined): number | null => {
  const n = v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function useExpandableCard(config: ExpandableCardConfig = {}): ExpandableCardResult {
  const router = useRouter();
  const params = useLocalSearchParams<CardParams & Record<string, string>>();
  const [isClosing, setIsClosing] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  // Reactive (iPad split view, foldables); 'window' matches measureInWindow coordinates.
  const { width: W, height: H } = useWindowDimensions();

  const { containerOffsetY, ...rest } = config;
  const { openDuration, closeDuration, cardBorderRadius } = { ...DEFAULT_CONFIG, ...rest };

  // Fallback rect (opened without card params, e.g. from a deep link): a centred card.
  const cardWidth = parseParam(params.cardWidth) ?? Math.round(W * 0.6);
  const cardHeight = parseParam(params.cardHeight) ?? Math.round(W * 0.6);
  const cardX = parseParam(params.cardX) ?? Math.round((W - cardWidth) / 2);
  const cardY = parseParam(params.cardY) ?? Math.round((H - cardHeight) / 2);
  const widgetSize = parseWidgetSize(params.widgetSize);

  const geometry = useMemo(() => {
    const scaleX = cardWidth / W;
    const scaleY = cardHeight / H;
    return {
      scaleX,
      scaleY,
      translateX: cardX + cardWidth / 2 - W / 2,
      translateY: cardY + cardHeight / 2 - H / 2,
    };
  }, [cardX, cardY, cardWidth, cardHeight, W, H]);
  const { scaleX, scaleY, translateX, translateY } = geometry;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(withTiming(1, { duration: openDuration, easing: Easing.out(Easing.cubic) }));
    // Runs once on mount: the open animation must not restart on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateBack = useCallback(() => router.back(), [router]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    if (shouldReduceMotion) {
      navigateBack();
      return;
    }
    progress.set(withTiming(
      0,
      { duration: closeDuration, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(navigateBack);
      },
    ));
  }, [isClosing, closeDuration, shouldReduceMotion, navigateBack, progress]);

  // Android hardware back: animate the card closed instead of popping the route abruptly.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const containerStyle = useAnimatedStyle(() => {
    const offsetY = containerOffsetY ? containerOffsetY.value : 0;
    const p = progress.value;
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [translateX, 0]) },
        { translateY: interpolate(p, [0, 1], [translateY - offsetY, 0]) },
        { scaleX: interpolate(p, [0, 1], [scaleX, 1]) },
        { scaleY: interpolate(p, [0, 1], [scaleY, 1]) },
      ],
      borderRadius: interpolate(p, [0, 1], [cardBorderRadius / scaleX, 0]),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.2, 0.7]),
  }));

  const detailContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 0.65], [0, 1]),
    pointerEvents: progress.value > 0.5 ? 'auto' : 'none',
  }));

  // Constant inverse scale: the preview is laid out at the closed-card size and always fills
  // the morphing rectangle. Interpolating it toward 1 made content shrink into the centre on
  // close, then pop back when the modal unmounted.
  const previewContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 0.7], [1, 1, 0]),
    transform: [{ scaleX: 1 / scaleX }, { scaleY: 1 / scaleY }],
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
    cardDimensions: { cardX, cardY, cardWidth, cardHeight, scaleX, scaleY },
    widgetSize,
    window: { width: W, height: H },
  };
}
