import { useEffect, useCallback } from 'react';
import { View, Pressable, StyleSheet, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  cancelAnimation,
  useReducedMotion,
  FadeIn,
  FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useExpandableNavigation } from '@/shared/expandable-card/useExpandableNavigation';
import { WIDGET_REGISTRY } from '@/features/dashboard/widgets/catalog';
import {
  snapSize,
  getWidgetDimensions,
  getColumnWidth,
  getFullWidth,
  nextSize,
  ACTION_HEIGHT,
  GRID_GAP,
} from '@/features/dashboard/layout/widgetSizes';
import { hoverTarget, type GridFrame } from '@/features/dashboard/layout/gridLayout';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';
import type { WidgetId } from '@/features/dashboard/dashboardStore';
import { Icon } from '@/shared/ui/Icon';
import { lightImpact } from '@/shared/lib/haptics';
import { colors } from '@/theme/colors';

const RESIZE_CORNER = 52;
const RESIZE_EDGE = 26;
const EDIT_BORDER = 3;
/** Press/lift spring (animations rule). */
const SPRING = { damping: 15, stiffness: 400 } as const;
/** Cards sliding to a new slot, and the dropped card landing: quick, no overshoot. */
export const LAYOUT_SPRING = { damping: 24, stiffness: 260, mass: 0.9 } as const;
/** Lift while dragging in edit mode. */
const DRAG_SCALE = 1.04;

/** Shared between the grid and its cells while a card is dragged. */
export interface DragContext {
  /** Every card's frame for the order on screen (UI thread copy). */
  frames: SharedValue<GridFrame[]>;
  /** Page scroll offset, so a card keeps up with auto-scroll. */
  scrollOffset: SharedValue<number>;
  /** Finger position in the window, for auto-scroll near the edges. */
  fingerY: SharedValue<number>;
  /** The card being dragged (null when none). */
  activeId: SharedValue<string | null>;
  onDragStart: (id: WidgetId) => void;
  /** The dragged card is over another card: make room by moving it there. */
  onHover: (id: WidgetId, targetId: WidgetId) => void;
  onDrop: (id: WidgetId) => void;
}

interface WidgetCellProps {
  id: WidgetId;
  size: WidgetSize;
  frame: GridFrame;
  containerWidth: number;
  index: number;
  isEditing: boolean;
  drag: DragContext;
  onEnterEdit: () => void;
  onRemove: (id: WidgetId) => void;
  onSetSize: (id: WidgetId, next: WidgetSize) => void;
  /** Non-gesture reorder for assistive tech (WCAG 2.5.7 dragging alternative). */
  onMove: (id: WidgetId, direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

export function WidgetCell({
  id,
  size,
  frame,
  containerWidth,
  index,
  isEditing,
  drag,
  onEnterEdit,
  onRemove,
  onSetSize,
  onMove,
  isFirst,
  isLast,
}: WidgetCellProps) {
  const { t } = useTranslation();
  const def = WIDGET_REGISTRY[id];
  // Destructured: the React Compiler treats an object holding a ref as a ref itself.
  const {
    cardRef,
    cardScale,
    handlePressIn,
    handlePressOut,
    onLayout: onNavLayout,
    navigateToDetail,
  } = useExpandableNavigation();
  const shouldReduceMotion = useReducedMotion();
  const kind = def?.kind ?? 'card';
  const isAction = kind === 'action';
  const { frames, scrollOffset, fingerY, activeId, onDragStart, onHover, onDrop } = drag;

  // Where the card sits (animated to its slot) and how far the finger has carried it.
  const posX = useSharedValue(frame.x);
  const posY = useSharedValue(frame.y);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const isDragging = useSharedValue(false);
  /** From pick-up until it has landed: drawn above the others and doesn't follow reflows. */
  const isRaised = useSharedValue(false);
  const lastTarget = useSharedValue<string | null>(null);
  const lift = useSharedValue(1);
  const rotate = useSharedValue(0);
  const isResizing = useSharedValue(false);
  const previewW = useSharedValue(frame.width);
  const previewH = useSharedValue(frame.height);
  const startW = useSharedValue(frame.width);
  const startH = useSharedValue(frame.height);
  /** The latest slot, also while the card is in the air (where it lands). */
  const slotX = useSharedValue(frame.x);
  const slotY = useSharedValue(frame.y);

  // Follow the slot: cards slide aside as the dragged one passes, and into place after
  // resizes, adds and removals. The card in the air lands by itself (see onFinalize).
  useEffect(() => {
    slotX.set(frame.x);
    slotY.set(frame.y);
    if (isRaised.get()) return;
    if (shouldReduceMotion) {
      posX.set(frame.x);
      posY.set(frame.y);
    } else {
      posX.set(withSpring(frame.x, LAYOUT_SPRING));
      posY.set(withSpring(frame.y, LAYOUT_SPRING));
    }
  }, [frame, posX, posY, slotX, slotY, isRaised, shouldReduceMotion]);

  useEffect(() => {
    previewW.set(withSpring(frame.width, LAYOUT_SPRING));
    previewH.set(withSpring(frame.height, LAYOUT_SPRING));
  }, [frame.width, frame.height, previewW, previewH]);

  // A long-press enters edit mode mid-press, so the press-out may never arrive: release it here.
  useEffect(() => {
    if (isEditing) cardScale.set(withSpring(1, SPRING));
  }, [isEditing, cardScale]);

  useEffect(() => {
    if (!isEditing || shouldReduceMotion) {
      cancelAnimation(rotate);
      rotate.set(0);
      return;
    }
    const delay = (index % 3) * 90;
    rotate.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(-1, { duration: 220 }), withTiming(1, { duration: 220 })),
          -1,
          true,
        ),
      ),
    );
    return () => {
      cancelAnimation(rotate);
    };
  }, [isEditing, shouldReduceMotion, index, rotate]);

  const slotStyle = useAnimatedStyle(() => {
    const following = isDragging.value ? scrollOffset.value - startScroll.value : 0;
    return {
      width: previewW.value,
      height: previewH.value,
      zIndex: isRaised.value || isResizing.value ? 30 : 0,
      elevation: isRaised.value || isResizing.value ? 24 : 0,
      transform: [
        { translateX: posX.value + dragX.value },
        { translateY: posY.value + dragY.value + following },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const pressScale = isEditing ? lift.value : cardScale.value;
    const jiggling = isEditing && !isRaised.value && !isResizing.value;
    return {
      transform: [{ rotate: `${jiggling ? rotate.value : 0}deg` }, { scale: pressScale }] as const,
    };
  });

  // JS side of the drag.
  const startJS = useCallback(() => onDragStart(id), [onDragStart, id]);
  const hoverJS = useCallback((target: string) => onHover(id, target), [onHover, id]);
  const dropJS = useCallback(() => onDrop(id), [onDrop, id]);

  const pan = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(2)
    .onStart(() => {
      // Pick it up exactly where it is, even if it was still sliding to a new slot.
      cancelAnimation(posX);
      cancelAnimation(posY);
      isDragging.set(true);
      isRaised.set(true);
      startScroll.set(scrollOffset.value);
      lastTarget.set(null);
      activeId.set(id);
      lift.set(withSpring(DRAG_SCALE, SPRING));
      scheduleOnRN(startJS);
    })
    .onUpdate((e) => {
      dragX.set(e.translationX);
      dragY.set(e.translationY);
      fingerY.set(e.absoluteY);
      const following = scrollOffset.value - startScroll.value;
      const cx = posX.value + e.translationX + previewW.value / 2;
      const cy = posY.value + e.translationY + following + previewH.value / 2;
      const target = hoverTarget(frames.value, id, cx, cy);
      if (target !== lastTarget.value) {
        lastTarget.set(target);
        if (target) scheduleOnRN(hoverJS, target);
      }
    })
    .onFinalize(() => {
      if (!isDragging.value) return;
      // Fold the finger offset into the position, then land in the slot it ended up in.
      const following = scrollOffset.value - startScroll.value;
      posX.set(posX.value + dragX.value);
      posY.set(posY.value + dragY.value + following);
      dragX.set(0);
      dragY.set(0);
      isDragging.set(false);
      activeId.set(null);
      // Land in the slot from the order on screen; if the order changes again while landing
      // (a last hover), the effect above has updated slotX / slotY: go there instead.
      for (const f of frames.value) {
        if (f.id === id) {
          slotX.set(f.x);
          slotY.set(f.y);
        }
      }
      lift.set(withSpring(1, LAYOUT_SPRING));
      posX.set(withSpring(slotX.value, LAYOUT_SPRING));
      posY.set(
        withSpring(slotY.value, LAYOUT_SPRING, (finished) => {
          if (!finished) return;
          isRaised.set(false);
          if (posX.value !== slotX.value || posY.value !== slotY.value) {
            posX.set(withSpring(slotX.value, LAYOUT_SPRING));
            posY.set(withSpring(slotY.value, LAYOUT_SPRING));
          }
        }),
      );
      scheduleOnRN(dropJS);
    });

  const commitResizeJS = useCallback(
    (liveW: number, liveH: number) => {
      if (!def) return;
      const next = snapSize(liveW, liveH, containerWidth, def.sizes, size, kind);
      const snapped = getWidgetDimensions(next, containerWidth, kind);
      previewW.set(withSpring(snapped.width, LAYOUT_SPRING));
      previewH.set(withSpring(snapped.height, LAYOUT_SPRING));
      if (next !== size) {
        onSetSize(id, next);
        lightImpact();
      }
    },
    [def, containerWidth, size, kind, id, onSetSize, previewW, previewH],
  );

  const unit = getColumnWidth(containerWidth);
  const fullWidth = getFullWidth(containerWidth);

  const beginResize = () => {
    'worklet';
    isResizing.set(true);
    startW.set(previewW.value);
    startH.set(previewH.value);
  };
  const applyResize = (tx: number, ty: number) => {
    'worklet';
    previewW.set(Math.max(unit, Math.min(fullWidth, startW.value + tx)));
    previewH.set(isAction ? ACTION_HEIGHT : Math.max(unit, Math.min(unit * 2 + GRID_GAP, startH.value + ty)));
  };
  const endResize = () => {
    'worklet';
    isResizing.set(false);
    scheduleOnRN(commitResizeJS, previewW.value, previewH.value);
  };
  const resize = (axis: 'both' | 'x' | 'y') =>
    Gesture.Pan()
      .enabled(isEditing)
      .minDistance(1)
      .onStart(beginResize)
      .onUpdate((e) => applyResize(axis === 'y' ? 0 : e.translationX, axis === 'x' ? 0 : e.translationY))
      .onEnd(endResize);

  const handleLayout = useCallback(() => {
    onNavLayout({ nativeEvent: { layout: { width: frame.width, height: frame.height } } });
  }, [onNavLayout, frame.width, frame.height]);

  const detailPath = def?.detailPath;
  const detailParams = def?.detailParams;
  const openDetail = useCallback(() => {
    if (isEditing || !detailPath) return;
    navigateToDetail(detailPath, { widgetSize: size, ...detailParams });
  }, [isEditing, detailPath, detailParams, navigateToDetail, size]);

  const canResize = def ? def.sizes.length > 1 : false;
  const editActions = [
    ...(!isFirst ? [{ name: 'moveUp', label: t('dashboard.a11yMoveEarlier') }] : []),
    ...(!isLast ? [{ name: 'moveDown', label: t('dashboard.a11yMoveLater') }] : []),
    ...(canResize ? [{ name: 'resize', label: t('dashboard.editResize') }] : []),
    { name: 'remove', label: t('dashboard.editRemove') },
  ];
  const handleEditAction = (e: AccessibilityActionEvent) => {
    if (!def) return;
    switch (e.nativeEvent.actionName) {
      case 'moveUp':
        onMove(id, -1);
        break;
      case 'moveDown':
        onMove(id, 1);
        break;
      case 'resize':
        onSetSize(id, nextSize(size, def.sizes));
        break;
      case 'remove':
        onRemove(id);
        break;
    }
  };

  if (!def) return null;

  const Render = def.Render;
  const content = (
    <Render
      size={size}
      width={frame.width}
      height={frame.height}
      isEditing={isEditing}
      onEnterEdit={onEnterEdit}
      onOpenDetail={openDetail}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    />
  );

  // Edit chrome: the whole card moves it; the corner (and the right / bottom edges) resize it.
  const chrome = isEditing ? (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} className="z-10">
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-2xl"
        style={{ borderWidth: EDIT_BORDER, borderColor: colors.muted }}
      />
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      {canResize && (
        <>
          <GestureDetector gesture={resize('x')}>
            <View
              className="absolute"
              style={
                isAction
                  ? { top: 0, bottom: 0, right: 0, width: RESIZE_CORNER }
                  : { top: RESIZE_CORNER, bottom: RESIZE_CORNER, right: 0, width: RESIZE_EDGE }
              }
            />
          </GestureDetector>
          {!isAction && (
            <GestureDetector gesture={resize('y')}>
              <View
                className="absolute"
                style={{ left: RESIZE_CORNER, right: RESIZE_CORNER, bottom: 0, height: RESIZE_EDGE }}
              />
            </GestureDetector>
          )}
          {!isAction && (
            <GestureDetector gesture={resize('both')}>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel={t('dashboard.editResize')}
                className="absolute items-center justify-center"
                style={{ right: 0, bottom: 0, width: RESIZE_CORNER, height: RESIZE_CORNER }}
              >
                <View className="absolute bottom-2 right-2 h-4 w-4 rounded-br-sm border-b-2 border-r-2 border-muted" />
              </View>
            </GestureDetector>
          )}
        </>
      )}

      <Pressable
        onPress={() => onRemove(id)}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.editRemove')}
        hitSlop={8}
        className="absolute -left-2 -top-2 z-20 h-12 w-12 items-center justify-center"
      >
        <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
          <Icon icon={Minus} size={16} color={colors.surface} strokeWidth={3} />
        </View>
      </Pressable>
    </View>
  ) : null;

  // One element tree for every mode: switching it between edit / wrapper / inner used to
  // remount the card's content on every edit toggle (flicker, lost state such as the
  // Today's Plan page). Only props change between modes now.
  const isWrapper = def.gestureMode === 'wrapper';
  const pressable = !isEditing && isWrapper;

  return (
    <Animated.View
      collapsable={false}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      onLayout={handleLayout}
      accessible={isEditing}
      accessibilityLabel={isEditing ? `${t(def.titleKey)}, ${t(`dashboard.size.${size}`)}` : undefined}
      accessibilityHint={isEditing ? t('dashboard.a11yEditHint') : undefined}
      accessibilityActions={isEditing ? editActions : undefined}
      onAccessibilityAction={isEditing ? handleEditAction : undefined}
      style={[styles.slot, slotStyle]}
    >
      <Animated.View
        ref={cardRef}
        collapsable={false}
        style={[StyleSheet.absoluteFill, styles.clip, contentStyle]}
      >
        <Pressable
          style={styles.fill}
          disabled={!pressable}
          accessible={pressable}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={openDetail}
          onLongPress={onEnterEdit}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={t(def.titleKey)}
          accessibilityActions={
            pressable ? [{ name: 'longpress', label: t('dashboard.editLayout') }] : undefined
          }
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'longpress') onEnterEdit();
          }}
        >
          <View style={styles.fill} pointerEvents={isEditing || isWrapper ? 'none' : 'auto'}>
            {content}
          </View>
        </Pressable>
        {chrome}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 0, top: 0, borderRadius: 16, overflow: 'visible' },
  clip: { borderRadius: 16, overflow: 'hidden' },
  fill: { flex: 1 },
});
