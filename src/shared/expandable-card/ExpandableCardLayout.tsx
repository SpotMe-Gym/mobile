import { createContext, useCallback, useContext, useMemo, useRef, type ComponentRef, type ReactNode } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useExpandableCard, type CardDimensions, type ExpandableCardConfig } from '@/shared/expandable-card/useExpandableCard';
import { colors } from '@/theme/colors';
import type { CardSize } from '@/shared/expandable-card/types';

/**
 * On Android with the new architecture + edge-to-edge, measureInWindow (on the home screen)
 * and the modal container can live in different coordinate spaces. The modal container's
 * actual window-Y is measured into a SharedValue so the correction runs on the UI thread
 * without waiting for a React re-render.
 */
function useContainerOffset() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const offsetY = useSharedValue(0);
  const onContainerLayout = useCallback(() => {
    if (Platform.OS !== 'android') return;
    ref.current?.measureInWindow((_x, y) => {
      offsetY.set(y);
    });
  }, [offsetY]);
  return { ref, offsetY, onContainerLayout };
}

interface ExpandableCardContextValue {
  handleClose: () => void;
  cardDimensions: CardDimensions;
  progress: SharedValue<number>;
  widgetSize: CardSize;
  /** True once the open animation has finished — start follow-up UI (sheets) after this. */
  isExpanded: boolean;
}

const ExpandableCardContext = createContext<ExpandableCardContextValue | null>(null);

export function useExpandableCardContext(): ExpandableCardContextValue {
  const context = useContext(ExpandableCardContext);
  if (!context)
    throw new Error('useExpandableCardContext must be used within ExpandableCardLayoutWithContext');
  return context;
}

interface ExpandableCardLayoutProps {
  /** Shown while opening/closing — must render the same component as the home card. */
  previewContent: ReactNode;
  /** Full detail page content. */
  children: ReactNode;
  config?: ExpandableCardConfig;
  backgroundColor?: string;
}

export function ExpandableCardLayoutWithContext({
  previewContent,
  children,
  config,
  backgroundColor = colors.surface,
}: ExpandableCardLayoutProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
    isExpanded,
    window,
  } = useExpandableCard({ ...config, containerOffsetY: offsetY });

  // On Android edge-to-edge the backdrop extends below the window to cover the nav bar;
  // the card container itself must stay at window size (same space as measureInWindow).
  const backdropHeight =
    Platform.OS === 'android' ? Math.max(Dimensions.get('screen').height, window.height) : window.height;

  const contextValue = useMemo(
    () => ({ handleClose, cardDimensions, progress, widgetSize, isExpanded }),
    [handleClose, cardDimensions, progress, widgetSize, isExpanded],
  );

  return (
    <ExpandableCardContext.Provider value={contextValue}>
      <View ref={containerRef} onLayout={onContainerLayout} style={styles.container}>
        <Animated.View
          collapsable={false}
          style={[styles.backdrop, { height: backdropHeight }, backdropStyle]}
        >
          <Pressable
            style={styles.fill}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>

        <Animated.View
          collapsable={false}
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor }, containerStyle]}
        >
          {/* Inset lives on the detail wrapper only — padding here would shift the
              absolutely-positioned preview against the padding box. */}
          <View style={[styles.fill, { backgroundColor }]}>
            <Animated.View
              collapsable={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[styles.preview, previewContentStyle]}
            >
              {previewContent}
            </Animated.View>

            <Animated.View
              collapsable={false}
              style={[
                styles.detail,
                { width: window.width, height: window.height, paddingTop: insets.top },
                detailContentStyle,
              ]}
            >
              {children}
            </Animated.View>
          </View>
        </Animated.View>

        {backdropHeight > window.height && (
          <Animated.View
            collapsable={false}
            pointerEvents="none"
            style={[
              styles.bottomFill,
              { top: window.height, height: backdropHeight - window.height, backgroundColor },
              backdropStyle,
            ]}
          />
        )}
      </View>
    </ExpandableCardContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.overlay },
  fill: { flex: 1 },
  card: { position: 'absolute', overflow: 'hidden' },
  preview: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  detail: { position: 'absolute', top: 0, left: 0 },
  bottomFill: { position: 'absolute', left: 0, right: 0 },
});
