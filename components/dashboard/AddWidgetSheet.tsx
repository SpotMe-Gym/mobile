import { Modal, View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { WIDGET_CATALOG, CATEGORY_ORDER, CATEGORY_TITLE_KEYS } from './widgetRegistry';
import type { WidgetId } from '../../store/dashboardStore';
import type { WidgetCategory } from './widgetRegistry';

interface CatalogRow {
  type: 'header' | 'widget';
  key: string;
  category?: WidgetCategory;
  id?: WidgetId;
  titleKey?: string;
  placed?: boolean;
}

interface AddWidgetSheetProps {
  visible: boolean;
  placedIds: WidgetId[];
  onClose: () => void;
  onAdd: (id: WidgetId) => void;
}

function buildRows(placedIds: WidgetId[]): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const category of CATEGORY_ORDER) {
    const widgets = WIDGET_CATALOG.filter(w => w.category === category);
    if (widgets.length === 0) continue;
    rows.push({ type: 'header', key: `h-${category}`, category });
    for (const widget of widgets) {
      rows.push({
        type: 'widget',
        key: widget.id,
        id: widget.id,
        titleKey: widget.titleKey,
        placed: placedIds.includes(widget.id),
      });
    }
  }
  return rows;
}

export function AddWidgetSheet({ visible, placedIds, onClose, onAdd }: AddWidgetSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const rows = buildRows(placedIds);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-800">
          <Text className="text-white text-xl font-bold">{t('dashboard.editAddCard')}</Text>
          <Button
            size="icon"
            variant="ghost"
            icon={<Icon icon={X} size={22} color="white" />}
            onPress={onClose}
            accessibilityLabel={t('common.cancel')}
          />
        </View>

        <FlashList
          data={rows}
          estimatedItemSize={56}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            if (item.type === 'header' && item.category) {
              return (
                <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-4 mb-2">
                  {t(CATEGORY_TITLE_KEYS[item.category])}
                </Text>
              );
            }
            if (!item.id || !item.titleKey) return null;
            const disabled = item.placed;
            return (
              <Pressable
                onPress={() => {
                  if (disabled) return;
                  onAdd(item.id as WidgetId);
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={t(item.titleKey)}
                className={`flex-row items-center justify-between py-4 px-4 mb-2 rounded-2xl border ${
                  disabled ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text className={`text-base font-medium ${disabled ? 'text-zinc-600' : 'text-white'}`}>
                  {t(item.titleKey)}
                </Text>
                {disabled && (
                  <Text className="text-zinc-600 text-xs">{t('dashboard.editAlreadyAdded')}</Text>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
