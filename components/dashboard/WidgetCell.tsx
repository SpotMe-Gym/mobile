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
  runOnJS,
  LinearTransition,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useExpandableNavigation } from '../../hooks/useExpandableNavigation';
import { WIDGET_REGISTRY } from './catalog';
import { snapSize, getWidgetDimensions, getColumnWidth, getFullWidth, nextSize, ACTION_HEIGHT, GRID_GAP } from './widgetSizes';
import type { WidgetSize } from './widgetSizes';
import type { WidgetId } from '../../store/dashboardStore';
import { Icon } from '../ui/Icon';
import { lightImpact } from '../../lib/haptics';
import { colors } from '../../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 48pt edges — smaller strips were untappable, especially on action bars. */
const RESIZE_EDGE = 48;
const RESIZE_CORNER = 56;
const EDIT_BORDER = 3;
/** Standard press/drag spring (animations rule). */
const SPRING = { damping: 15, stiffness: 400 } as const;

interface WidgetCellProps {
  id: WidgetId;
  size: WidgetSize;
  width: number;
  height: number;
  containerWidth: number;
  index: number;
  isEditing: boolean;
  layoutLocked?: boolean;
  onEnterEdit: () => void;
  onRemove: (id: WidgetId) => void;
  onSetSize: (id: WidgetId, next: WidgetSize) => void;
  onDragStart: (id: WidgetId) => void;
  onDragCancel: () => void;
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
  layoutLocked = false,
  onEnterEdit,
  onRemove,
  onSetSize,
  onDragStart,
  onDragCancel,
  onDrop,
  onRegisterFrame,
  onMove,
  isFirst,
  isLast,
}: WidgetCellProps) {
  const { t } = useTranslation();
  const def = WIDGET_REGISTRY[id];
  const nav = useExpandableNavigation();
  const cardScale = nav.cardScale;
  const shouldReduceMotion = useReducedMotion();
  const kind = def?.kind ?? 'card';
  const isAction = kind === 'action';

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const isResizing = useSharedValue(false);
  const previewW = useSharedValue(width);
  const previewH = useSharedValue(height);
  const startW = useSharedValue(width);
  const startH = useSharedValue(height);

  useEffect(() => {
    previewW.value = width;
    previewH.value = height;
  }, [width, height, previewW, previewH]);

  useEffect(() => {
    if (!isEditing || shouldReduceMotion) {
      cancelAnimation(rotate);
      rotate.value = 0;
      return;
    }
    const delay = (index % 3) * 90;
    rotate.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-1, { duration: 220 }),
          withTiming(1, { duration: 220 }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(rotate);
    };
  }, [isEditing, shouldReduceMotion, index, rotate]);

  const animatedStyle = useAnimatedStyle(() => {
    const dragging = isDragging.value;
    const pressScale = isEditing ? (dragging ? 1.04 : 1) : cardScale.value;
    const jiggling = isEditing && !dragging && !isResizing.value;
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
    zIndex: isDragging.value || isResizing.value ? 30 : 0,
    elevation: isDragging.value || isResizing.value ? 24 : 0,
  }));

  const handleDragStartJS = useCallback(() => {
    onDragStart(id);
  }, [onDragStart, id]);

  const handleDropJS = useCallback(
    (translationX: number, translationY: number) => {
      const committed = onDrop(id, translationX, translationY);
      if (committed) {
        isDragging.value = false;
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      isDragging.value = false;
      translateX.value = withSpring(0, SPRING);
      translateY.value = withSpring(0, SPRING);
      onDragCancel();
    },
    [id, onDrop, onDragCancel, isDragging, translateX, translateY],
  );

  const handleCancelJS = useCallback(() => {
    isDragging.value = false;
    translateX.value = withSpring(0, SPRING);
    translateY.value = withSpring(0, SPRING);
    onDragCancel();
  }, [onDragCancel, isDragging, translateX, translateY]);

  const commitResizeJS = useCallback(
    (liveW: number, liveH: number) => {
      if (!def) return;
      const next = snapSize(liveW, liveH, containerWidth, def.sizes, size, kind);
      const snapped = getWidgetDimensions(next, containerWidth, kind);
      previewW.value = snapped.width;
      previewH.value = snapped.height;
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
      runOnJS(handleDragStartJS)();
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(handleDropJS)(e.translationX, e.translationY);
    })
    .onFinalize((_e, success) => {
      if (success) return;
      runOnJS(handleCancelJS)();
    });

  const beginResize = () => {
    'worklet';
    isResizing.value = true;
    startW.value = previewW.value;
    startH.value = previewH.value;
  };

  const applyResize = (tx: number, ty: number) => {
    'worklet';
    previewW.value = Math.max(unit, Math.min(fullWidth, startW.value + tx));
    if (isAction) {
      previewH.value = ACTION_HEIGHT;
    } else {
      previewH.value = Math.max(unit, Math.min(unit * 2 + GRID_GAP, startH.value + ty));
    }
  };

  const endResize = () => {
    'worklet';
    isResizing.value = false;
    runOnJS(commitResizeJS)(previewW.value, previewH.value);
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
    nav.onLayout({ nativeEvent: { layout: { width, height } } });
    onRegisterFrame(id, { x: slot.x, y: slot.y, width: slot.width, height: slot.height });
  }, [nav, width, height, id, onRegisterFrame]);

  const openDetail = useCallback(() => {
    if (isEditing || !def?.detailPath) return;
    nav.navigateToDetail(def.detailPath, { widgetSize: size });
  }, [isEditing, def?.detailPath, nav, size]);

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
      onPressIn={nav.handlePressIn}
      onPressOut={nav.handlePressOut}
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

  if (isEditing) {
    return (
      <Animated.View
        collapsable={false}
        ref={nav.cardRef}
        onLayout={handleLayout}
        accessible
        accessibilityLabel={`${t(def.titleKey)}, ${t(`dashboard.size.${size}`)}`}
        accessibilityHint={t('dashboard.a11yEditHint')}
        accessibilityActions={editActions}
        onAccessibilityAction={handleEditAction}
        layout={layoutLocked ? undefined : LinearTransition}
        style={[{ borderRadius: 16, overflow: 'visible' }, slotStyle]}
      >
        <Animated.View
          collapsable={false}
          style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }, animatedStyle]}
        >
          <View style={{ flex: 1 }} pointerEvents="none">
            {content}
          </View>
          {chrome}
        </Animated.View>
      </Animated.View>
    );
  }

  if (def.gestureMode === 'inner') {
    return (
      <Animated.View
        collapsable={false}
        ref={nav.cardRef}
        onLayout={handleLayout}
        style={[{ overflow: 'hidden', borderRadius: 16, width, height }, animatedStyle]}
      >
        <View style={{ flex: 1 }}>{content}</View>
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      collapsable={false}
      ref={nav.cardRef}
      onLayout={handleLayout}
      onPressIn={nav.handlePressIn}
      onPressOut={nav.handlePressOut}
      onPress={openDetail}
      onLongPress={onEnterEdit}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={t(def.titleKey)}
      accessibilityActions={[{ name: 'longpress', label: t('dashboard.editLayout') }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onEnterEdit();
      }}
      style={[{ overflow: 'hidden', borderRadius: 16, width, height }, animatedStyle]}
    >
      <View style={{ flex: 1 }} pointerEvents="none">
        {content}
      </View>
    </AnimatedPressable>
  );
}
