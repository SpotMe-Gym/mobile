import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { lightImpact } from '@/shared/lib/haptics';
import { hoverIndex, moveTo, stackRows, type RowFrame } from '@/shared/lib/reorder';

const SPRING = { damping: 24, stiffness: 260, mass: 0.9 } as const;
/** Hold the handle this long to pick a row up (a quick flick over it still scrolls the page). */
const HOLD_MS = 140;
const EDGE = 90;
const MAX_SPEED = 14;

/** The scroll view the list lives in, so a row held near the top or bottom scrolls it. */
export interface ReorderScroll {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any scrollable animated component
  ref: AnimatedRef<any>;
  offset: SharedValue<number>;
  /** Visible part of the scroll view in window coordinates, and its content height. */
  viewportTop: SharedValue<number>;
  viewportBottom: SharedValue<number>;
  contentHeight: SharedValue<number>;
}

interface HandleValue {
  gesture: GestureType;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}
const HandleContext = createContext<HandleValue | null>(null);

/**
 * The part of a row you hold to drag it. Put it anywhere inside a row rendered by
 * ReorderableList. With a screen reader it's an adjustable control: swipe up or down to move
 * the row one place.
 */
export function ReorderHandle({
  children,
  accessibilityLabel,
  style,
  className,
}: {
  children: ReactNode;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
}) {
  const handle = useContext(HandleContext);
  const content = (
    <View
      style={style}
      className={className}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        if (!handle) return;
        if (e.nativeEvent.actionName === 'increment' && !handle.isLast) handle.onMove(1);
        if (e.nativeEvent.actionName === 'decrement' && !handle.isFirst) handle.onMove(-1);
      }}
    >
      {children}
    </View>
  );
  return handle ? <GestureDetector gesture={handle.gesture}>{content}</GestureDetector> : content;
}

interface Shared {
  frames: SharedValue<RowFrame[]>;
  activeId: SharedValue<string | null>;
  fingerY: SharedValue<number>;
  scrollOffset: SharedValue<number>;
}

function Row({
  id,
  frame,
  index,
  count,
  settled,
  shared,
  onHeight,
  onStart,
  onHover,
  onDrop,
  onStep,
  children,
}: {
  id: string;
  frame: RowFrame;
  index: number;
  count: number;
  /** Every row has been measured: from here on, rows slide to their place instead of jumping. */
  settled: boolean;
  shared: Shared;
  onHeight: (id: string, height: number) => void;
  onStart: (id: string) => void;
  onHover: (id: string, index: number) => void;
  onDrop: (id: string) => void;
  onStep: (id: string, direction: -1 | 1) => void;
  children: ReactNode;
}) {
  const { frames, activeId, fingerY, scrollOffset } = shared;
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(frame.y);
  const slot = useSharedValue(frame.y);
  const height = useSharedValue(frame.height);
  const dragY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** From pick-up until it has landed: drawn above the others, doesn't follow reflows. */
  const raised = useSharedValue(false);
  const lift = useSharedValue(1);
  const lastIndex = useSharedValue(index);

  useEffect(() => {
    slot.set(frame.y);
    height.set(frame.height);
    if (raised.get()) return;
    y.set(settled && !reduceMotion ? withSpring(frame.y, SPRING) : frame.y);
  }, [frame.y, frame.height, settled, reduceMotion, slot, height, raised, y]);

  const startJS = useCallback(() => {
    lightImpact();
    onStart(id);
  }, [onStart, id]);
  const hoverJS = useCallback((to: number) => onHover(id, to), [onHover, id]);
  const dropJS = useCallback(() => onDrop(id), [onDrop, id]);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .maxPointers(1)
    .onStart(() => {
      cancelAnimation(y);
      dragging.set(true);
      raised.set(true);
      startScroll.set(scrollOffset.value);
      activeId.set(id);
      lift.set(withSpring(1.03, SPRING));
      let own = 0;
      for (let i = 0; i < frames.value.length; i++) if (frames.value[i]?.id === id) own = i;
      lastIndex.set(own);
      scheduleOnRN(startJS);
    })
    .onUpdate((e) => {
      dragY.set(e.translationY);
      fingerY.set(e.absoluteY);
      const following = scrollOffset.value - startScroll.value;
      const centre = y.value + e.translationY + following + height.value / 2;
      const to = hoverIndex(frames.value, id, centre);
      if (to !== lastIndex.value) {
        lastIndex.set(to);
        scheduleOnRN(hoverJS, to);
      }
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      // Fold the finger's travel into the position, then land in the slot it ended up in.
      y.set(y.value + dragY.value + (scrollOffset.value - startScroll.value));
      dragY.set(0);
      dragging.set(false);
      activeId.set(null);
      for (const f of frames.value) if (f.id === id) slot.set(f.y);
      lift.set(withSpring(1, SPRING));
      y.set(
        withSpring(slot.value, SPRING, (finished) => {
          if (!finished) return;
          raised.set(false);
          if (y.value !== slot.value) y.set(withSpring(slot.value, SPRING));
        }),
      );
      scheduleOnRN(dropJS);
    });

  const style = useAnimatedStyle(() => {
    const following = dragging.value ? scrollOffset.value - startScroll.value : 0;
    return {
      zIndex: raised.value ? 20 : 0,
      elevation: raised.value ? 12 : 0,
      shadowOpacity: raised.value ? 0.35 : 0,
      transform: [{ translateY: y.value + dragY.value + following }, { scale: lift.value }],
    };
  });

  const handle: HandleValue = {
    gesture,
    onMove: (direction) => onStep(id, direction),
    isFirst: index === 0,
    isLast: index === count - 1,
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          shadowColor: '#000',
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        },
        style,
      ]}
    >
      <View onLayout={(e) => onHeight(id, Math.round(e.nativeEvent.layout.height))}>
        <HandleContext.Provider value={handle}>{children}</HandleContext.Provider>
      </View>
    </Animated.View>
  );
}

interface ReorderableListProps<T> {
  items: readonly T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** A row was dropped (or stepped with the screen reader) at a new place. */
  onMove: (from: number, to: number) => void;
  gap?: number;
  scroll?: ReorderScroll;
  /** True from pick-up to drop: turn the page's own scrolling off meanwhile. */
  onDraggingChange?: (dragging: boolean) => void;
}

/**
 * A vertical list whose rows are reordered by holding their ReorderHandle and dragging. The
 * other rows make room as the held one passes, rows can have different heights and change
 * height (an editor opening), and holding a row near the edge of the screen scrolls the page.
 */
export function ReorderableList<T>({
  items,
  keyOf,
  renderItem,
  onMove,
  gap = 12,
  scroll,
  onDraggingChange,
}: ReorderableListProps<T>) {
  const keys = useMemo(() => items.map(keyOf), [items, keyOf]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  // While a row is held, the order on screen lives here; it's saved on drop.
  const [dragOrder, setDragOrderState] = useState<readonly string[] | null>(null);
  const dragOrderRef = useRef<readonly string[] | null>(null);
  const setDragOrder = useCallback((order: readonly string[] | null) => {
    dragOrderRef.current = order;
    setDragOrderState(order);
  }, []);
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  // A row added or removed while one is held would leave the held order out of date.
  const order = dragOrder && dragOrder.length === keys.length ? dragOrder : keys;
  const layout = useMemo(() => stackRows(order, heights, gap), [order, heights, gap]);
  const frameOf = useMemo(() => new Map(layout.frames.map((f) => [f.id, f])), [layout]);
  const settled = keys.every((k) => (heights[k] ?? 0) > 0);

  const frames = useSharedValue<RowFrame[]>(layout.frames);
  useEffect(() => {
    frames.set(layout.frames);
  }, [layout, frames]);
  const activeId = useSharedValue<string | null>(null);
  const fingerY = useSharedValue(0);
  const fallbackOffset = useSharedValue(0);
  const shared = useMemo<Shared>(
    () => ({ frames, activeId, fingerY, scrollOffset: scroll?.offset ?? fallbackOffset }),
    [frames, activeId, fingerY, scroll?.offset, fallbackOffset],
  );

  const reduceMotion = useReducedMotion();
  const height = useSharedValue(layout.height);
  useEffect(() => {
    height.set(settled && !reduceMotion ? withSpring(layout.height, SPRING) : layout.height);
  }, [layout.height, settled, reduceMotion, height]);
  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));

  const autoScroll = useFrameCallback(() => {
    if (!scroll || activeId.value === null) return;
    const top = scroll.viewportTop.value;
    const bottom = scroll.viewportBottom.value;
    const finger = fingerY.value;
    let speed = 0;
    if (finger < top + EDGE) speed = -MAX_SPEED * Math.min(1, (top + EDGE - finger) / EDGE);
    else if (finger > bottom - EDGE) speed = MAX_SPEED * Math.min(1, (finger - (bottom - EDGE)) / EDGE);
    if (speed === 0) return;
    const max = Math.max(0, scroll.contentHeight.value - (bottom - top));
    const next = Math.min(max, Math.max(0, scroll.offset.value + speed));
    if (next === scroll.offset.value) return;
    scroll.offset.set(next);
    scrollTo(scroll.ref, 0, next, false);
  }, false);

  // The list is hidden only until its first rows are measured (they'd all sit at the top for
  // a frame); a row added later appears in place without hiding the rest.
  const [shown, setShown] = useState(false);
  const measured = useRef<Record<string, number>>({});
  const onHeight = useCallback((id: string, h: number) => {
    measured.current[id] = h;
    if (keysRef.current.every((k) => (measured.current[k] ?? 0) > 0)) setShown(true);
    setHeights((current) => (current[id] === h ? current : { ...current, [id]: h }));
  }, []);

  const onStart = useCallback(() => {
    setDragOrder(keysRef.current);
    onDraggingChange?.(true);
    autoScroll.setActive(true);
  }, [setDragOrder, onDraggingChange, autoScroll]);

  const onHover = useCallback(
    (id: string, index: number) => {
      const current = dragOrderRef.current;
      if (!current) return;
      const next = moveTo(current, id, index);
      if (next === current) return;
      setDragOrder(next);
      lightImpact();
    },
    [setDragOrder],
  );

  const onDrop = useCallback(
    (id: string) => {
      autoScroll.setActive(false);
      const from = keysRef.current.indexOf(id);
      const to = dragOrderRef.current?.indexOf(id) ?? -1;
      if (from >= 0 && to >= 0 && from !== to) onMove(from, to);
      setDragOrder(null);
      onDraggingChange?.(false);
    },
    [autoScroll, onMove, setDragOrder, onDraggingChange],
  );

  const onStep = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = keysRef.current.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= keysRef.current.length) return;
      onMove(from, to);
      lightImpact();
    },
    [onMove],
  );

  return (
    <Animated.View style={[{ opacity: shown || keys.length === 0 ? 1 : 0 }, containerStyle]}>
      {items.map((item, index) => {
        const id = keys[index]!;
        const frame = frameOf.get(id);
        if (!frame) return null;
        return (
          <Row
            key={id}
            id={id}
            frame={frame}
            index={index}
            count={keys.length}
            settled={settled}
            shared={shared}
            onHeight={onHeight}
            onStart={onStart}
            onHover={onHover}
            onDrop={onDrop}
            onStep={onStep}
          >
            {renderItem(item, index)}
          </Row>
        );
      })}
    </Animated.View>
  );
}
