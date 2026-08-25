import { useEffect, useCallback } from 'react';
import { View, Pressable } from 'react-native';
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
import { snapSize, getWidgetDimensions, getColumnWidth, getFullWidth, ACTION_HEIGHT, GRID_GAP } from './widgetSizes';
import type { WidgetSize } from './widgetSizes';
import type { WidgetId } from '../../store/dashboardStore';
import { Icon } from '../ui/Icon';
import { lightImpact } from '../../lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 48pt edges — smaller strips were untappable, especially on action bars. */
const RESIZE_EDGE = 48;
const RESIZE_CORNER = 56;
const EDIT_BORDER = 3;

interface WidgetCellProps {
  id: WidgetId;
  size: WidgetSize;
  width: number;
  height: number;
  containerWidth: number;
  index: number;
  isEditing: boolean;
  onEnterEdit: () => void;
  onRemove: (id: WidgetId) => void;
  onSetSize: (id: WidgetId, next: WidgetSize) => void;
  onDrop: (fromId: WidgetId, absX: number, absY: number) => void;
  onRegisterFrame: (id: WidgetId, frame: { x: number; y: number; width: number; height: number }) => void;
}

export function WidgetCell({
  id,
  size,
  width,
  height,
  containerWidth,
  index,
  isEditing,
  onEnterEdit,
  onRemove,
  onSetSize,
  onDrop,
  onRegisterFrame,
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
    const dragScale = isDragging.value ? 1.04 : 1;
    const pressScale = isEditing ? dragScale : cardScale.value;
    const jiggling = isEditing && !isDragging.value && !isResizing.value;
    return {
      width: previewW.value,
      height: previewH.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${jiggling ? rotate.value : 0}deg` },
        { scale: pressScale },
      ],
      zIndex: isDragging.value || isResizing.value ? 20 : 0,
    };
  });

  const handleDropJS = useCallback(
    (absX: number, absY: number) => {
      onDrop(id, absX, absY);
    },
    [id, onDrop],
  );

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
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      isDragging.value = false;
      runOnJS(handleDropJS)(e.absoluteX, e.absoluteY);
      translateX.value = withSpring(0, { damping: 15, stiffness: 400 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 400 });
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

  const handleLayout = useCallback(() => {
    nav.onLayout({ nativeEvent: { layout: { width, height } } });
    nav.cardRef.current?.measureInWindow((x, y, w, h) => {
      onRegisterFrame(id, { x, y, width: w, height: h });
    });
  }, [nav, width, height, id, onRegisterFrame]);

  const openDetail = useCallback(() => {
    if (isEditing || !def?.detailPath) return;
    nav.navigateToDetail(def.detailPath as string, { widgetSize: size });
  }, [isEditing, def?.detailPath, nav, size]);

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
        style={{ borderWidth: EDIT_BORDER, borderColor: '#a1a1aa' }}
      />
      <Pressable
        onPress={() => onRemove(id)}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.editRemove')}
        hitSlop={8}
        className="absolute -top-2 -left-2 h-12 w-12 items-center justify-center z-20"
      >
        <View className="h-7 w-7 rounded-full bg-zinc-200 items-center justify-center">
          <Icon icon={Minus} size={16} color="#18181b" strokeWidth={3} />
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
          <View className="absolute right-2 bottom-2 h-4 w-4 border-r-[3px] border-b-[3px] border-zinc-300 rounded-br-sm" />
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
        layout={LinearTransition}
        style={[{ borderRadius: 16 }, animatedStyle]}
      >
        <View style={{ flex: 1, overflow: 'hidden', borderRadius: 16 }} pointerEvents="none">
          {content}
        </View>
        {chrome}
      </Animated.View>
    );
  }

  if (def.gestureMode === 'inner') {
    return (
      <Animated.View
        collapsable={false}
        ref={nav.cardRef}
        onLayout={handleLayout}
        style={[{ overflow: 'hidden', borderRadius: 16 }, animatedStyle]}
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
      style={[{ overflow: 'hidden', borderRadius: 16 }, animatedStyle]}
    >
      <View style={{ flex: 1 }} pointerEvents="none">
        {content}
      </View>
    </AnimatedPressable>
  );
}
