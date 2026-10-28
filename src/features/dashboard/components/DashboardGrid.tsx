import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { lightImpact } from '@/shared/lib/haptics';
import { WidgetCell, LAYOUT_SPRING, type DragContext } from '@/features/dashboard/components/WidgetCell';
import { AddWidgetSheet } from '@/features/dashboard/components/AddWidgetSheet';
import { getWidgetDimensions, GRID_GAP } from '@/features/dashboard/layout/widgetSizes';
import {
  autoScrollSpeed,
  computeGrid,
  moveItem,
  type GridFrame,
} from '@/features/dashboard/layout/gridLayout';
import { WIDGET_REGISTRY } from '@/features/dashboard/widgets/catalog';
import { useDashboardStore, type DashboardWidget, type WidgetId } from '@/features/dashboard/dashboardStore';
import { colors } from '@/theme/colors';

const ADD_TILE = '__add';

/** The page the grid scrolls in: lets a dragged card scroll it near the top or bottom. */
export interface GridScroll {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any scrollable animated component
  ref: AnimatedRef<any>;
  offset: SharedValue<number>;
  /** Visible part of the page in window coordinates, and the scrollable content height. */
  viewportTop: SharedValue<number>;
  viewportBottom: SharedValue<number>;
  contentHeight: SharedValue<number>;
}

interface DashboardGridProps {
  isEditing: boolean;
  onEnterEdit: () => void;
  addSheetOpen?: boolean;
  onAddSheetOpenChange?: (open: boolean) => void;
  onDraggingChange?: (dragging: boolean) => void;
  scroll?: GridScroll;
}

/** Slides to its slot like the cards do. */
function AddTile({ frame, onPress, label }: { frame: GridFrame; onPress: () => void; label: string }) {
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.y);
  useEffect(() => {
    x.set(withSpring(frame.x, LAYOUT_SPRING));
    y.set(withSpring(frame.y, LAYOUT_SPRING));
  }, [frame.x, frame.y, x, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, width: frame.width, height: frame.height }, style]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="flex-1 items-center justify-center rounded-2xl border border-dashed border-border-strong"
      >
        <Plus size={28} color={colors.subtle} />
      </Pressable>
    </Animated.View>
  );
}

export function DashboardGrid({
  isEditing,
  onEnterEdit,
  addSheetOpen,
  onAddSheetOpenChange,
  onDraggingChange,
  scroll,
}: DashboardGridProps) {
  const { t } = useTranslation();
  const widgets = useDashboardStore((s) => s.widgets);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const addWidget = useDashboardStore((s) => s.addWidget);
  const setWidgetSize = useDashboardStore((s) => s.setWidgetSize);
  const reorderWidgets = useDashboardStore((s) => s.reorderWidgets);
  const setOrder = useDashboardStore((s) => s.setOrder);

  const [containerWidth, setContainerWidth] = useState(0);
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const sheetOpen = addSheetOpen ?? internalSheetOpen;
  const setSheetOpen = onAddSheetOpenChange ?? setInternalSheetOpen;

  // While a card is dragged the order lives here (cards make room live); it's saved on drop.
  const [dragOrder, setDragOrderState] = useState<DashboardWidget[] | null>(null);
  const dragOrderRef = useRef<DashboardWidget[] | null>(null);
  const setDragOrder = useCallback((order: DashboardWidget[] | null) => {
    dragOrderRef.current = order;
    setDragOrderState(order);
  }, []);
  const shown = dragOrder ?? widgets;

  const placedIds = widgets.map((w) => w.id);
  const hasAddable = Object.keys(WIDGET_REGISTRY).some((id) => !placedIds.includes(id as WidgetId));
  const showAddTile = isEditing && hasAddable && containerWidth > 0;

  const layout = useMemo(() => {
    if (containerWidth <= 0) return { frames: [] as GridFrame[], height: 0 };
    const items = shown.flatMap((w) => {
      const def = WIDGET_REGISTRY[w.id];
      if (!def) return [];
      const d = getWidgetDimensions(w.size, containerWidth, def.kind);
      return [{ id: w.id, width: d.width, height: d.height }];
    });
    if (showAddTile) {
      const d = getWidgetDimensions('compact', containerWidth);
      items.push({ id: ADD_TILE, width: d.width, height: d.height });
    }
    return computeGrid(items, containerWidth, GRID_GAP);
  }, [shown, containerWidth, showAddTile]);
  const frameOf = useMemo(() => new Map(layout.frames.map((f) => [f.id, f])), [layout]);

  // UI-thread copies for the drag worklets.
  const frames = useSharedValue<GridFrame[]>(layout.frames);
  useEffect(() => {
    frames.set(layout.frames);
  }, [layout, frames]);
  const fallbackOffset = useSharedValue(0);
  const scrollOffset = scroll?.offset ?? fallbackOffset;
  const fingerY = useSharedValue(0);
  const activeId = useSharedValue<string | null>(null);

  const height = useSharedValue(layout.height);
  useEffect(() => {
    height.set(withSpring(layout.height, LAYOUT_SPRING));
  }, [layout.height, height]);
  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));

  // Holding a card near the top or bottom of the screen scrolls the page.
  const autoScroll = useFrameCallback(() => {
    if (!scroll || activeId.value === null) return;
    const speed = autoScrollSpeed(fingerY.value, scroll.viewportTop.value, scroll.viewportBottom.value);
    if (speed === 0) return;
    const max = Math.max(
      0,
      scroll.contentHeight.value - (scroll.viewportBottom.value - scroll.viewportTop.value),
    );
    const next = Math.min(max, Math.max(0, scroll.offset.value + speed));
    if (next === scroll.offset.value) return;
    scroll.offset.set(next);
    scrollTo(scroll.ref, 0, next, false);
  }, false);

  const handleDragStart = useCallback(() => {
    setDragOrder(widgets);
    onDraggingChange?.(true);
    autoScroll.setActive(true);
  }, [widgets, setDragOrder, onDraggingChange, autoScroll]);

  const handleHover = useCallback(
    (id: WidgetId, targetId: WidgetId) => {
      const order = dragOrderRef.current;
      if (!order || targetId === ADD_TILE) return;
      const next = moveItem(order, id, targetId);
      if (next === order) return;
      setDragOrder(next);
      lightImpact();
    },
    [setDragOrder],
  );

  const handleDrop = useCallback(() => {
    autoScroll.setActive(false);
    const order = dragOrderRef.current;
    if (order) setOrder(order.map((w) => w.id));
    setDragOrder(null);
    onDraggingChange?.(false);
  }, [setOrder, setDragOrder, onDraggingChange, autoScroll]);

  const drag: DragContext = useMemo(
    () => ({
      frames,
      scrollOffset,
      fingerY,
      activeId,
      onDragStart: handleDragStart,
      onHover: handleHover,
      onDrop: handleDrop,
    }),
    [frames, scrollOffset, fingerY, activeId, handleDragStart, handleHover, handleDrop],
  );

  const handleMove = useCallback(
    (id: WidgetId, direction: -1 | 1) => {
      const index = widgets.findIndex((w) => w.id === id);
      const neighbour = widgets[index + direction];
      if (index < 0 || !neighbour) return;
      reorderWidgets(id, neighbour.id);
      lightImpact();
    },
    [widgets, reorderWidgets],
  );

  const handleAdd = useCallback(
    (id: WidgetId) => {
      const def = WIDGET_REGISTRY[id];
      if (!def) return;
      addWidget(id, def.defaultSize);
      setSheetOpen(false);
      lightImpact();
    },
    [addWidget, setSheetOpen],
  );

  const handleRemove = useCallback(
    (id: WidgetId) => {
      removeWidget(id);
      lightImpact();
    },
    [removeWidget],
  );

  const addFrame = frameOf.get(ADD_TILE);

  return (
    <View collapsable={false} pointerEvents="box-none">
      {/* Gaps between cards let taps through to the edit-mode backdrop behind the grid. */}
      <Animated.View
        pointerEvents="box-none"
        style={[{ overflow: 'visible' }, containerStyle]}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== containerWidth) setContainerWidth(w);
        }}
      >
        {containerWidth > 0 &&
          shown.map((widget) => {
            const frame = frameOf.get(widget.id);
            if (!frame || !WIDGET_REGISTRY[widget.id]) return null;
            const index = widgets.findIndex((w) => w.id === widget.id);
            return (
              <WidgetCell
                key={widget.id}
                id={widget.id}
                size={widget.size}
                frame={frame}
                containerWidth={containerWidth}
                index={index}
                isEditing={isEditing}
                drag={drag}
                onEnterEdit={onEnterEdit}
                onRemove={handleRemove}
                onSetSize={setWidgetSize}
                onMove={handleMove}
                isFirst={index === 0}
                isLast={index === widgets.length - 1}
              />
            );
          })}

        {addFrame && (
          <AddTile frame={addFrame} onPress={() => setSheetOpen(true)} label={t('dashboard.editAddCard')} />
        )}
      </Animated.View>

      <AddWidgetSheet
        visible={sheetOpen}
        placedIds={placedIds}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
