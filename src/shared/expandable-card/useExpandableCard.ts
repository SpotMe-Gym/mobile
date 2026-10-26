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
}

type AnimatedStyle = ReturnType<typeof useAnimatedStyle>;

export interface ExpandableCardResult {
  /** 0 = card, 1 = expanded. */
  progress: SharedValue<number>;
  isClosing: boolean;
  /** True once the open animation has finished (immediately under Reduce Motion). */
  isExpanded: boolean;
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
  const [isExpanded, setIsExpanded] = useState(shouldReduceMotion);
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

  const cardDimensions = useMemo(
    () => ({ cardX, cardY, cardWidth, cardHeight }),
    [cardX, cardY, cardWidth, cardHeight],
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(withTiming(
      1,
      { duration: openDuration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(setIsExpanded, true);
      },
    ));
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

  /*
   * The card morphs its real frame (left/top/width/height) from the home card's rect to the
   * window, instead of scaling a window-sized view. Nothing inside is ever scaled, so text
   * can't stretch and the corner radius stays a true circle (16 -> 0) for the whole morph.
   * Only this one view re-lays out per frame; both children have fixed sizes.
   */
  const containerStyle = useAnimatedStyle(() => {
    const offsetY = containerOffsetY ? containerOffsetY.value : 0;
    const p = progress.value;
    return {
      left: interpolate(p, [0, 1], [cardX, 0]),
      top: interpolate(p, [0, 1], [cardY - offsetY, 0]),
      width: interpolate(p, [0, 1], [cardWidth, W]),
      height: interpolate(p, [0, 1], [cardHeight, H]),
      borderRadius: interpolate(p, [0, 1], [cardBorderRadius, 0]),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.2, 0.7]),
  }));

  /*
   * "Blank slate": the card content fades out first (0 -> 0.15), the empty card grows, and the
   * detail fades in last (0.6 -> 1), so the two layers are never visible together. The detail
   * is laid out at window size and pinned to the screen (offset by the card's own position),
   * so the growing card reveals it like a window instead of sliding it around.
   */
  const detailContentStyle = useAnimatedStyle(() => {
    const offsetY = containerOffsetY ? containerOffsetY.value : 0;
    const p = progress.value;
    return {
      opacity: interpolate(p, [0.6, 1], [0, 1], 'clamp'),
      transform: [
        { translateX: -interpolate(p, [0, 1], [cardX, 0]) },
        { translateY: -interpolate(p, [0, 1], [cardY - offsetY, 0]) },
      ],
      pointerEvents: p > 0.6 ? 'auto' : 'none',
    };
  });

  // Laid out at the closed-card size and centred in the morphing card: no counter-scaling.
  const previewContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15], [1, 0], 'clamp'),
    pointerEvents: 'none',
  }));

  return {
    progress,
    isClosing,
    isExpanded,
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
    cardDimensions,
    widgetSize,
    window: { width: W, height: H },
  };
}
