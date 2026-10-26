import { useRef, useCallback, type ComponentRef } from 'react';
import type { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSharedValue, withSpring, type WithSpringConfig } from 'react-native-reanimated';

/** Routes registered with the expandable-card presentation in app/_layout.tsx. */
export type ExpandableRoute = '/nutrition/detail' | '/body-weight' | '/body' | '/workouts/today';

interface UseExpandableNavigationOptions {
  pressScale?: number;
  springConfig?: WithSpringConfig;
}

// Standard press spring (animations rule).
const DEFAULT_OPTIONS: Required<UseExpandableNavigationOptions> = {
  pressScale: 0.96,
  springConfig: { damping: 15, stiffness: 400 },
};

/* Module-level lock: two cards tapped in the same frame must not both open. */
let isGlobalNavigationLocked = false;

/**
 * Press animation + navigation for home cards that expand into a detail page. The card's
 * window rect is passed as route params; the detail screen animates from it
 * (ExpandableCardLayoutWithContext).
 */
export function useExpandableNavigation(options: UseExpandableNavigationOptions = {}) {
  const router = useRouter();
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const cardScale = useSharedValue(1);
  const layoutRef = useRef({ width: 0, height: 0 });
  const { pressScale, springConfig } = { ...DEFAULT_OPTIONS, ...options };

  const handlePressIn = useCallback(() => {
    cardScale.set(withSpring(pressScale, springConfig));
  }, [cardScale, pressScale, springConfig]);

  const handlePressOut = useCallback(() => {
    cardScale.set(withSpring(1, springConfig));
  }, [cardScale, springConfig]);

  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    layoutRef.current = { width, height };
  }, []);

  const navigateToDetail = useCallback(
    (pathname: ExpandableRoute, additionalParams?: Record<string, string>) => {
      if (isGlobalNavigationLocked) return;
      isGlobalNavigationLocked = true;
      setTimeout(() => {
        isGlobalNavigationLocked = false;
      }, 150);

      cardRef.current?.measureInWindow((x, y, width, height) => {
        // The card may be mid press-scale: rebuild the unscaled rect around the measured centre
        // so the animation doesn't start from the shrunken frame.
        let finalX = x;
        let finalY = y;
        let finalWidth = width;
        let finalHeight = height;
        if (layoutRef.current.width > 0 && layoutRef.current.height > 0) {
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          finalWidth = layoutRef.current.width;
          finalHeight = layoutRef.current.height;
          finalX = centerX - finalWidth / 2;
          finalY = centerY - finalHeight / 2;
        }

        // Whole pixels only: the detail screen lays its preview out at these exact
        // dimensions, and a fractional size makes Yoga round the preview's flex chain
        // differently than the grid card's, shifting inner content by up to a point.
        router.push({
          pathname,
          params: {
            cardX: String(Math.round(finalX)),
            cardY: String(Math.round(finalY)),
            cardWidth: String(Math.round(finalWidth)),
            cardHeight: String(Math.round(finalHeight)),
            ...additionalParams,
          },
        });
      });
    },
    [router],
  );

  return { cardRef, cardScale, handlePressIn, handlePressOut, onLayout, navigateToDetail };
}
