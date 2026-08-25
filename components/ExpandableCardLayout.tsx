import React, { ReactNode, useRef, useCallback } from 'react';
import { View, Pressable, Dimensions, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SharedValue, useSharedValue } from 'react-native-reanimated';
import { useExpandableCard, ExpandableCardConfig } from '../hooks/useExpandableCard';
import type { WidgetSize } from './dashboard/widgetSizes';

// Card container + animation math uses window dims (matches measureInWindow)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// On Android edge-to-edge, extend backdrop below window to cover nav bar
const BACKDROP_HEIGHT = Platform.OS === 'android'
  ? Math.max(Dimensions.get('screen').height, SCREEN_HEIGHT)
  : SCREEN_HEIGHT;

/**
 * On Android with new arch + edge-to-edge, measureInWindow (on the home screen)
 * and the modal container can live in different coordinate spaces. This hook
 * measures the modal container's actual window-Y via a SharedValue so the
 * correction is applied on the UI thread without waiting for a React re-render.
 */
function useContainerOffset() {
  const ref = useRef<View>(null);
  const offsetY = useSharedValue(0);

  const onContainerLayout = useCallback(() => {
    if (Platform.OS !== 'android') return;
    ref.current?.measureInWindow((_x, y) => {
      offsetY.value = y;
    });
  }, []);

  return { ref, offsetY, onContainerLayout };
}

interface ExpandableCardLayoutProps {
  /** Content shown when closing (should match home card appearance) */
  previewContent: ReactNode;
  /** Full detail page content */
  children: ReactNode;
  /** Optional animation configuration */
  config?: ExpandableCardConfig;
  /** Background color of the card */
  backgroundColor?: string;
}

export function ExpandableCardLayout({
  previewContent,
  children,
  config,
  backgroundColor = '#18181b',
}: ExpandableCardLayoutProps) {
  const insets = useSafeAreaInsets();
  const { ref: containerRef, offsetY, onContainerLayout } = useContainerOffset();
  const {
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
  } = useExpandableCard({ ...config, containerOffsetY: offsetY });

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={styles.container}>
      <Animated.View collapsable={false} style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      <Animated.View collapsable={false} style={[styles.cardContainer, { backgroundColor }, containerStyle]}>
        <View style={[styles.content, { backgroundColor }]}>
          <Animated.View collapsable={false} style={[styles.previewWrapper, previewContentStyle]}>
            {previewContent}
          </Animated.View>

          <Animated.View collapsable={false} style={[styles.detailWrapper, { paddingTop: insets.top }, detailContentStyle]}>
            {children}
          </Animated.View>
        </View>
      </Animated.View>

      {BACKDROP_HEIGHT > SCREEN_HEIGHT && (
        <Animated.View
          collapsable={false}
          style={[styles.bottomFill, { backgroundColor }, backdropStyle]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

// Export a context to allow children to access handleClose
import { createContext, useContext } from 'react';

interface ExpandableCardContextValue {
  handleClose: () => void;
  cardDimensions: {
    cardX: number;
    cardY: number;
    cardWidth: number;
    cardHeight: number;
    scaleX: number;
    scaleY: number;
  };
  progress: SharedValue<number>;
  widgetSize: WidgetSize;
}

const ExpandableCardContext = createContext<ExpandableCardContextValue | null>(null);

export function useExpandableCardContext() {
  const context = useContext(ExpandableCardContext);
  if (!context) {
    throw new Error('useExpandableCardContext must be used within ExpandableCardLayout');
  }
  return context;
}

// Enhanced version with context provider
export function ExpandableCardLayoutWithContext({
  previewContent,
  children,
  config,
  backgroundColor = '#18181b',
}: ExpandableCardLayoutProps) {
  const insets = useSafeAreaInsets();
  const { ref: containerRef, offsetY, onContainerLayout } = useContainerOffset();
  const {
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
    cardDimensions,
    progress,
    widgetSize,
  } = useExpandableCard({ ...config, containerOffsetY: offsetY });

  return (
    <ExpandableCardContext.Provider value={{ handleClose, cardDimensions, progress, widgetSize }}>
      <View ref={containerRef} onLayout={onContainerLayout} style={styles.container}>
        <Animated.View collapsable={false} style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={handleClose} />
        </Animated.View>

        <Animated.View collapsable={false} style={[styles.cardContainer, { backgroundColor }, containerStyle]}>
          {/* Inset must live on the detail wrapper only — padding on this view would
              shift the absolutely-positioned preview against the padding box. */}
          <View style={[styles.content, { backgroundColor }]}>
            <Animated.View collapsable={false} style={[styles.previewWrapper, previewContentStyle]}>
              {previewContent}
            </Animated.View>

            <Animated.View collapsable={false} style={[styles.detailWrapper, { paddingTop: insets.top }, detailContentStyle]}>
              {children}
            </Animated.View>
          </View>
        </Animated.View>

        {BACKDROP_HEIGHT > SCREEN_HEIGHT && (
          <Animated.View
            collapsable={false}
            style={[styles.bottomFill, { backgroundColor }, backdropStyle]}
            pointerEvents="none"
          />
        )}
      </View>
    </ExpandableCardContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
    backgroundColor: '#000',
  },
  backdropPressable: {
    flex: 1,
  },
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  previewWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailWrapper: {
    flex: 1,
  },
  bottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SCREEN_HEIGHT,
    height: BACKDROP_HEIGHT - SCREEN_HEIGHT,
  },
});
