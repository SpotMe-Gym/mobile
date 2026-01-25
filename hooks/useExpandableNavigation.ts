import { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { useSharedValue, withSpring } from 'react-native-reanimated';

interface UseExpandableNavigationOptions {
  /** Spring config for press animation */
  pressScale?: number;
  springConfig?: {
    damping: number;
    stiffness: number;
  };
}

const DEFAULT_OPTIONS: Required<UseExpandableNavigationOptions> = {
  pressScale: 0.96,
  springConfig: {
    damping: 15,
    stiffness: 400,
  },
};

/**
 * Hook for creating expandable card navigation with press animations.
 * Use this on home screen cards that expand into detail pages.
 * 
 * @example
 * ```tsx
 * const { cardRef, cardScale, cardAnimatedStyle, navigateToDetail } = useExpandableNavigation();
 * 
 * <AnimatedPressable
 *   ref={cardRef}
 *   onPressIn={() => cardScale.value = withSpring(0.96)}
 *   onPressOut={() => cardScale.value = withSpring(1)}
 *   onPress={() => navigateToDetail('/nutrition-detail')}
 *   style={cardAnimatedStyle}
 * >
 *   ...
 * </AnimatedPressable>
 * ```
 */
export function useExpandableNavigation(options: UseExpandableNavigationOptions = {}) {
  const router = useRouter();
  const cardRef = useRef<View>(null);
  const cardScale = useSharedValue(1);

  const layoutRef = useRef({ width: 0, height: 0 });

  const { pressScale, springConfig } = { ...DEFAULT_OPTIONS, ...options };

  const handlePressIn = useCallback(() => {
    cardScale.value = withSpring(pressScale, springConfig);
  }, [pressScale, springConfig]);

  const handlePressOut = useCallback(() => {
    cardScale.value = withSpring(1, springConfig);
  }, [springConfig]);

  const onLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;
    layoutRef.current = { width, height };
  }, []);

  /**
   * Navigate to a detail page, passing the card's position and dimensions.
   * The detail page should use ExpandableCardLayout to animate from this position.
   */
  const navigateToDetail = useCallback((pathname: string, additionalParams?: Record<string, string | number>) => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      // If we have layout dims, use them to calculate the "Unscaled" position
      // This prevents the animation from jumping if the card is currently scaled down (pressed)
      let finalX = x;
      let finalY = y;
      let finalWidth = width;
      let finalHeight = height;

      if (layoutRef.current.width > 0 && layoutRef.current.height > 0) {
        // Calculate center based on measured (possibly scaled) frame
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Restore unscaled dimensions
        finalWidth = layoutRef.current.width;
        finalHeight = layoutRef.current.height;

        // Recalculate Top-Left based on Center and Unscaled Dimensions
        finalX = centerX - finalWidth / 2;
        finalY = centerY - finalHeight / 2;
      }

      router.push({
        pathname: pathname as Href<string>,
        params: {
          cardX: Math.round(finalX),
          cardY: Math.round(finalY),
          cardWidth: Math.round(finalWidth),
          cardHeight: Math.round(finalHeight),
          ...additionalParams,
        },
      } as any);
    });
  }, [router]);

  return {
    /** Ref to attach to the card component */
    cardRef,
    /** Shared value for scale animation */
    cardScale,
    /** Handler for press in (starts shrink animation) */
    handlePressIn,
    /** Handler for press out (returns to normal scale) */
    handlePressOut,
    /** Handler for layout to capture unscaled dimensions */
    onLayout,
    /** Navigate to detail page with card position params */
    navigateToDetail,
  };
}
