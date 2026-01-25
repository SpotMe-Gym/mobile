import React, { ReactNode } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SharedValue } from 'react-native-reanimated';
import { useExpandableCard, ExpandableCardConfig } from '../hooks/useExpandableCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const {
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
  } = useExpandableCard(config);

  return (
    <View style={styles.container}>
      {/* Backdrop that dismisses on tap */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Card container - transforms from card size to fullscreen */}
      <Animated.View style={[styles.cardContainer, { backgroundColor }, containerStyle]}>
        <View style={[styles.content, { backgroundColor }]}>

          {/* Preview content - shows when closing (home card appearance) */}
          <Animated.View style={[styles.previewWrapper, previewContentStyle]}>
            {previewContent}
          </Animated.View>

          {/* Detail content - shows when expanded */}
          <Animated.View style={[styles.detailWrapper, { paddingTop: insets.top }, detailContentStyle]}>
            {children}
          </Animated.View>
        </View>
      </Animated.View>
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
  const {
    handleClose,
    containerStyle,
    backdropStyle,
    detailContentStyle,
    previewContentStyle,
    cardDimensions,
    progress,
  } = useExpandableCard(config);

  return (
    <ExpandableCardContext.Provider value={{ handleClose, cardDimensions, progress }}>
      <View style={styles.container}>
        {/* Backdrop that dismisses on tap */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={handleClose} />
        </Animated.View>

        {/* Card container - transforms from card size to fullscreen */}
        <Animated.View style={[styles.cardContainer, { backgroundColor }, containerStyle]}>
          <View style={[styles.content, { backgroundColor, paddingTop: insets.top }]}>

            {/* Preview content - shows when closing (home card appearance) */}
            <Animated.View style={[styles.previewWrapper, previewContentStyle]}>
              {previewContent}
            </Animated.View>

            {/* Detail content - shows when expanded */}
            <Animated.View style={[styles.detailWrapper, detailContentStyle]}>
              {children}
            </Animated.View>
          </View>
        </Animated.View>
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
    ...StyleSheet.absoluteFillObject,
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
});
