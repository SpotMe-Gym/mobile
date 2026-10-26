import { useEffect, useCallback } from 'react';
import { View, Pressable, StyleSheet, type LayoutChangeEvent, type AccessibilityActionEvent } from 'react-native';
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
  LinearTransition,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useExpandableNavigation } from '@/shared/expandable-card/useExpandableNavigation';
import { WIDGET_REGISTRY } from '@/features/dashboard/widgets/catalog';
import { snapSize, getWidgetDimensions, getColumnWidth, getFullWidth, nextSize, ACTION_HEIGHT, GRID_GAP } from '@/features/dashboard/layout/widgetSizes';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';
import type { WidgetId } from '@/features/dashboard/dashboardStore';
import { Icon } from '@/shared/ui/Icon';
import { lightImpact } from '@/shared/lib/haptics';
import { colors } from '@/theme/colors';

/** 48pt edges — smaller strips were untappable, especially on action bars. */
const RESIZE_EDGE = 48;
const RESIZE_CORNER = 56;
const EDIT_BORDER = 3;
/** Standard press/drag spring (animations rule). */
const SPRING = { damping: 15, stiffness: 400 } as const;
/** Settling after a drop: near-critically damped so a long flight doesn't overshoot its slot. */
const SETTLE = { damping: 26, stiffness: 260 } as const;
/** Lift while dragging in edit mode. */
const DRAG_SCALE = 1.04;
/** If a committed drop didn't move the card's frame, no layout transition runs — settle anyway. */
const SETTLE_FALLBACK_MS = 120;

interface WidgetCellProps {
  id: WidgetId;
  size: WidgetSize;
  width: number;
  height: number;
  containerWidth: number;
  index: number;
  isEditing: boolean;
  /** This cell is being dragged, or is flying into its slot after a drop. */
  isDragSource?: boolean;
  onEnterEdit: () => void;
  onRemove: (id: WidgetId) => void;
  onSetSize: (id: WidgetId, next: WidgetSize) => void;
  onDragStart: (id: WidgetId) => void;
  onDragCancel: () => void;
  /** The dragged cell has landed in its new slot (or sprung back). */
  onDragSettled: (id: WidgetId) => void;
  onDrop: (fromId: WidgetId, translationX: number, translationY: number) => boolean;
  onRegisterFrame: (id: WidgetId, frame: { x: number; y: number; width: number; height: number }) => void;
  /** Non-gesture reorder for assistive tech (WCAG 2.5.7 dragging alternative). */
  onMove: (id: WidgetId, direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

export function WidgetCell({
  id,
  size,
  width,
  height,
  containerWidth,
  index,
  isEditing,
  isDragSource = false,
  onEnterEdit,
  onRemove,
  onSetSize,
  onDragStart,
  onDragCancel,
  onDragSettled,
  onDrop,
  onRegisterFrame,
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

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  /** Stays true from pick-up until the card has settled, so it flies above its neighbours. */
  const isRaised = useSharedValue(false);
  const dropPending = useSharedValue(false);
  const lift = useSharedValue(1);
  const isResizing = useSharedValue(false);
  const previewW = useSharedValue(width);
  const previewH = useSharedValue(height);
  const startW = useSharedValue(width);
  const startH = useSharedValue(height);

  useEffect(() => {
    previewW.set(width);
    previewH.set(height);
  }, [width, height, previewW, previewH]);

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
    rotate.set(withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-1, { duration: 220 }),
          withTiming(1, { duration: 220 }),
        ),
        -1,
        true,
      ),
    ));
    return () => {
      cancelAnimation(rotate);
    };
  }, [isEditing, shouldReduceMotion, index, rotate]);

  const animatedStyle = useAnimatedStyle(() => {
    const pressScale = isEditing ? lift.value : cardScale.value;
    const jiggling = isEditing && !isRaised.value && !isResizing.value;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${jiggling ? rotate.value : 0}deg` },
        { scale: pressScale },
      ] as const,
    };
  });

  const slotStyle = useAnimatedStyle(() => ({
    width: previewW.value,
    height: previewH.value,
    zIndex: isRaised.value || isResizing.value ? 30 : 0,
    elevation: isRaised.value || isResizing.value ? 24 : 0,
  }));

  const handleDragStartJS = useCallback(() => {
    onDragStart(id);
  }, [onDragStart, id]);

  const settledJS = useCallback(() => onDragSettled(id), [onDragSettled, id]);

  /** Spring the drag offset home; the card lands, drops its lift and leaves the top layer. */
  const settle = useCallback(() => {
    'worklet';
    lift.set(withSpring(1, SETTLE));
    translateX.set(withSpring(0, SETTLE));
    translateY.set(withSpring(0, SETTLE, (finished) => {
      if (!finished) return;
      isRaised.set(false);
      scheduleOnRN(settledJS);
    }));
  }, [lift, translateX, translateY, isRaised, settledJS]);

  /*
   * Layout transition for the dragged card only. When the reorder commits, the card's frame
   * jumps to its new slot while the drag offset is still applied. Starting the frame from its
   * old origin and springing both the frame (old -> new slot) and the offset (drop point -> 0)
   * together keeps "frame + offset" continuous: the card flies from where the finger let go
   * straight into its new slot, with no snap back to the old one.
   */
  const dropTransition = useCallback<LayoutAnimationFunction>(
    (values) => {
      'worklet';
      dropPending.set(false);
      settle();
      return {
        initialValues: { originX: values.currentOriginX, originY: values.currentOriginY },
        animations: {
          originX: withSpring(values.targetOriginX, SETTLE),
          originY: withSpring(values.targetOriginY, SETTLE),
        },
      };
    },
    [dropPending, settle],
  );

  const handleDropJS = useCallback(
    (translationX: number, translationY: number) => {
      const committed = onDrop(id, translationX, translationY);
      if (!committed) {
        settle();
        onDragCancel();
        return;
      }
      // Keep the offset: dropTransition picks it up when the reordered layout commits.
      dropPending.set(true);
      setTimeout(() => {
        if (!dropPending.get()) return;
        dropPending.set(false);
        settle();
      }, SETTLE_FALLBACK_MS);
    },
    [id, onDrop, onDragCancel, dropPending, settle],
  );

  const handleCancelJS = useCallback(() => {
    settle();
    onDragCancel();
  }, [onDragCancel, settle]);

  const commitResizeJS = useCallback(
    (liveW: number, liveH: number) => {
      if (!def) return;
      const next = snapSize(liveW, liveH, containerWidth, def.sizes, size, kind);
      const snapped = getWidgetDimensions(next, containerWidth, kind);
      previewW.set(snapped.width);
      previewH.set(snapped.height);
      if (next !== size) {
        onSetSize(id, next);
        lightImpact();
      }
    },
    [def, containerWidth, size, kind, id, onSetSize, previewW, previewH],
  );

  const unit = getColumnWidth(containerWidth);
  const fullWidth = getFullWidth(containerWidth);

  const pan = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(8)
    .onStart(() => {
      scheduleOnRN(handleDragStartJS);
      isRaised.set(true);
      lift.set(withSpring(DRAG_SCALE, SPRING));
    })
    .onUpdate((e) => {
      translateX.set(e.translationX);
      translateY.set(e.translationY);
    })
    .onEnd((e) => {
      scheduleOnRN(handleDropJS, e.translationX, e.translationY);
    })
    .onFinalize((_e, success) => {
      if (success) return;
      scheduleOnRN(handleCancelJS);
    });

  const beginResize = () => {
    'worklet';
    isResizing.set(true);
    startW.set(previewW.value);
    startH.set(previewH.value);
  };

  const applyResize = (tx: number, ty: number) => {
    'worklet';
    previewW.set(Math.max(unit, Math.min(fullWidth, startW.value + tx)));
    if (isAction) {
      previewH.set(ACTION_HEIGHT);
    } else {
      previewH.set(Math.max(unit, Math.min(unit * 2 + GRID_GAP, startH.value + ty)));
    }
  };

  const endResize = () => {
    'worklet';
    isResizing.set(false);
    scheduleOnRN(commitResizeJS, previewW.value, previewH.value);
  };

  const resizeCorner = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(1)
    .onStart(beginResize)
    .onUpdate((e) => applyResize(e.translationX, e.translationY))
    .onEnd(endResize);

  const resizeRight = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(1)
    .onStart(beginResize)
    .onUpdate((e) => applyResize(e.translationX, 0))
    .onEnd(endResize);

  const resizeLeft = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(1)
    .onStart(beginResize)
    .onUpdate((e) => applyResize(-e.translationX, 0))
    .onEnd(endResize);

  const resizeBottom = Gesture.Pan()
    .enabled(isEditing)
    .minDistance(1)
    .onStart(beginResize)
    .onUpdate((e) => applyResize(0, e.translationY))
    .onEnd(endResize);

  // Grid-local layout, not measureInWindow: a transform never changes it, and it
  // stays valid no matter where the page is scrolled.
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const slot = e.nativeEvent.layout;
    onNavLayout({ nativeEvent: { layout: { width, height } } });
    onRegisterFrame(id, { x: slot.x, y: slot.y, width: slot.width, height: slot.height });
  }, [onNavLayout, width, height, id, onRegisterFrame]);

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
      width={width}
      height={height}
      isEditing={isEditing}
      onEnterEdit={onEnterEdit}
      onOpenDetail={openDetail}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    />
  );

  const chrome = isEditing ? (
    <View pointerEvents="box-none" className="absolute inset-0 z-10">
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-2xl"
        style={{ borderWidth: EDIT_BORDER, borderColor: colors.muted }}
      />
      <Pressable
        onPress={() => onRemove(id)}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.editRemove')}
        hitSlop={8}
        className="absolute -top-2 -left-2 h-12 w-12 items-center justify-center z-20"
      >
        <View className="h-7 w-7 rounded-full bg-muted items-center justify-center">
          <Icon icon={Minus} size={16} color={colors.surface} strokeWidth={3} />
        </View>
      </Pressable>

      <GestureDetector gesture={pan}>
        <View
          className="absolute"
          style={
            isAction
              ? { top: 0, bottom: 0, left: RESIZE_EDGE, right: RESIZE_EDGE }
              : { top: RESIZE_EDGE, right: RESIZE_EDGE, bottom: RESIZE_EDGE, left: RESIZE_EDGE }
          }
        />
      </GestureDetector>

      <GestureDetector gesture={resizeLeft}>
        <View
          className="absolute"
          style={
            isAction
              ? { top: 0, bottom: 0, left: 0, width: RESIZE_EDGE }
              : { top: RESIZE_CORNER, bottom: RESIZE_CORNER, left: 0, width: RESIZE_EDGE }
          }
        />
      </GestureDetector>
      <GestureDetector gesture={resizeRight}>
        <View
          className="absolute"
          style={
            isAction
              ? { top: 0, bottom: 0, right: 0, width: RESIZE_EDGE }
              : { top: RESIZE_CORNER, bottom: RESIZE_CORNER, right: 0, width: RESIZE_EDGE }
          }
        />
      </GestureDetector>
      {!isAction && (
        <GestureDetector gesture={resizeBottom}>
          <View className="absolute" style={{ left: RESIZE_CORNER, right: RESIZE_CORNER, bottom: 0, height: RESIZE_EDGE }} />
        </GestureDetector>
      )}
      <GestureDetector gesture={resizeCorner}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={t('dashboard.editResize')}
          className="absolute items-center justify-center"
          style={{ right: 0, bottom: 0, width: RESIZE_CORNER, height: isAction ? ACTION_HEIGHT : RESIZE_CORNER }}
        >
          <View className="absolute right-2 bottom-2 h-4 w-4 border-r-2 border-b-2 border-muted rounded-br-sm" />
        </View>
      </GestureDetector>
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
      ref={cardRef}
      onLayout={handleLayout}
      accessible={isEditing}
      accessibilityLabel={isEditing ? `${t(def.titleKey)}, ${t(`dashboard.size.${size}`)}` : undefined}
      accessibilityHint={isEditing ? t('dashboard.a11yEditHint') : undefined}
      accessibilityActions={isEditing ? editActions : undefined}
      onAccessibilityAction={isEditing ? handleEditAction : undefined}
      layout={isEditing ? (isDragSource ? dropTransition : LinearTransition) : undefined}
      style={[styles.slot, slotStyle]}
    >
      <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, styles.clip, animatedStyle]}>
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
          accessibilityActions={pressable ? [{ name: 'longpress', label: t('dashboard.editLayout') }] : undefined}
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
  slot: { borderRadius: 16, overflow: 'visible' },
  clip: { borderRadius: 16, overflow: 'hidden' },
  fill: { flex: 1 },
});
