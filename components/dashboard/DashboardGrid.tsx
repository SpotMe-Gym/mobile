import { useCallback, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { lightImpact } from '../../lib/haptics';
import { WidgetCell } from './WidgetCell';
import { AddWidgetSheet } from './AddWidgetSheet';
import { getWidgetDimensions, GRID_GAP } from './widgetSizes';
import { findDropTarget, type WidgetFrame } from './dropTarget';
import { WIDGET_REGISTRY } from './catalog';
import { useDashboardStore, WidgetId } from '../../store/dashboardStore';

interface DashboardGridProps {
  isEditing: boolean;
  onEnterEdit: () => void;
  addSheetOpen?: boolean;
  onAddSheetOpenChange?: (open: boolean) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

export function DashboardGrid({
  isEditing,
  onEnterEdit,
  addSheetOpen,
  onAddSheetOpenChange,
  onDraggingChange,
}: DashboardGridProps) {
  const { t } = useTranslation();
  const widgets = useDashboardStore(s => s.widgets);
  const removeWidget = useDashboardStore(s => s.removeWidget);
  const addWidget = useDashboardStore(s => s.addWidget);
  const setWidgetSize = useDashboardStore(s => s.setWidgetSize);
  const reorderWidgets = useDashboardStore(s => s.reorderWidgets);

  const [containerWidth, setContainerWidth] = useState(0);
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const sheetOpen = addSheetOpen ?? internalSheetOpen;
  const setSheetOpen = onAddSheetOpenChange ?? setInternalSheetOpen;

  const frames = useRef<Record<string, WidgetFrame>>({});
  const frozenFrames = useRef<Record<string, WidgetFrame>>({});
  const draggingIdRef = useRef<WidgetId | null>(null);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);

  const registerFrame = useCallback((id: WidgetId, frame: WidgetFrame) => {
    // The dragged cell's window rect follows the finger — never use that as home.
    if (draggingIdRef.current === id) return;
    frames.current[id] = frame;
  }, []);

  const handleDragStart = useCallback((id: WidgetId) => {
    draggingIdRef.current = id;
    frozenFrames.current = { ...frames.current };
    setDraggingId(id);
    onDraggingChange?.(true);
  }, [onDraggingChange]);

  const handleDragEnd = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    onDraggingChange?.(false);
  }, [onDraggingChange]);

  const handleDrop = useCallback(
    (fromId: WidgetId, translationX: number, translationY: number) => {
      const targetId = findDropTarget(
        fromId,
        translationX,
        translationY,
        widgets,
        frozenFrames.current,
      );
      handleDragEnd();
      if (!targetId) return false;
      reorderWidgets(fromId, targetId);
      lightImpact();
      return true;
    },
    [widgets, reorderWidgets, handleDragEnd],
  );

  const handleAdd = useCallback(
    (id: WidgetId) => {
      addWidget(id, WIDGET_REGISTRY[id].defaultSize);
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

  const colWidth = containerWidth > 0 ? getWidgetDimensions('compact', containerWidth).width : 0;
  const placedIds = widgets.map(w => w.id);
  const hasAddable = Object.keys(WIDGET_REGISTRY).some(
    (id) => !placedIds.includes(id as WidgetId),
  );

  return (
    <View collapsable={false} style={{ overflow: 'visible' }}>
      <View
        className="flex-row flex-wrap"
        style={{ gap: GRID_GAP, overflow: 'visible' }}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== containerWidth) setContainerWidth(w);
        }}
      >
        {containerWidth > 0 &&
          widgets.map((widget, index) => {
            const def = WIDGET_REGISTRY[widget.id];
            if (!def) return null;
            const dims = getWidgetDimensions(widget.size, containerWidth, def.kind);
            return (
              <WidgetCell
                key={widget.id}
                id={widget.id}
                size={widget.size}
                width={dims.width}
                height={dims.height}
                containerWidth={containerWidth}
                index={index}
                isEditing={isEditing}
                onEnterEdit={onEnterEdit}
                onRemove={handleRemove}
                onSetSize={setWidgetSize}
                onDragStart={handleDragStart}
                onDragCancel={handleDragEnd}
                onDrop={handleDrop}
                onRegisterFrame={registerFrame}
                layoutLocked={draggingId !== null}
              />
            );
          })}

        {isEditing && containerWidth > 0 && hasAddable && (
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.editAddCard')}
            style={{ width: colWidth, height: colWidth }}
            className="rounded-2xl border border-dashed border-zinc-700 items-center justify-center"
          >
            <View className="h-12 w-12 items-center justify-center">
              <Plus size={28} color="#71717a" />
            </View>
          </Pressable>
        )}
      </View>

      <AddWidgetSheet
        visible={sheetOpen}
        placedIds={placedIds}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
