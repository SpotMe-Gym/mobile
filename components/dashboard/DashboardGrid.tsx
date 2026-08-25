import { useCallback, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { lightImpact } from '../../lib/haptics';
import { WidgetCell } from './WidgetCell';
import { AddWidgetSheet } from './AddWidgetSheet';
import { getWidgetDimensions, GRID_GAP } from './widgetSizes';
import { WIDGET_REGISTRY } from './catalog';
import { useDashboardStore, WidgetId } from '../../store/dashboardStore';

interface DashboardGridProps {
  isEditing: boolean;
  onEnterEdit: () => void;
  addSheetOpen?: boolean;
  onAddSheetOpenChange?: (open: boolean) => void;
}

export function DashboardGrid({
  isEditing,
  onEnterEdit,
  addSheetOpen,
  onAddSheetOpenChange,
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

  const frames = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});

  const registerFrame = useCallback(
    (id: WidgetId, frame: { x: number; y: number; width: number; height: number }) => {
      frames.current[id] = frame;
    },
    [],
  );

  const handleDrop = useCallback(
    (fromId: WidgetId, absX: number, absY: number) => {
      let targetId: WidgetId | null = null;
      let closestDist = Infinity;
      for (const widget of widgets) {
        if (widget.id === fromId) continue;
        const frame = frames.current[widget.id];
        if (!frame) continue;
        const cx = frame.x + frame.width / 2;
        const cy = frame.y + frame.height / 2;
        const dist = (absX - cx) ** 2 + (absY - cy) ** 2;
        const inside =
          absX >= frame.x &&
          absX <= frame.x + frame.width &&
          absY >= frame.y &&
          absY <= frame.y + frame.height;
        if (inside || dist < closestDist) {
          closestDist = dist;
          targetId = widget.id;
          if (inside) break;
        }
      }
      if (targetId && targetId !== fromId) {
        reorderWidgets(fromId, targetId);
        lightImpact();
      }
    },
    [widgets, reorderWidgets],
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
    <View
      className="flex-row flex-wrap"
      style={{ gap: GRID_GAP }}
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
              onDrop={handleDrop}
              onRegisterFrame={registerFrame}
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

      <AddWidgetSheet
        visible={sheetOpen}
        placedIds={placedIds}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
