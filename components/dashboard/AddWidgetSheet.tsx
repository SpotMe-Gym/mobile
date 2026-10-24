import { Modal, View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/keys';
import { IconButton } from '../ui/IconButton';
import { WIDGET_CATALOG, CATEGORY_ORDER, CATEGORY_TITLE_KEYS } from './catalog';
import type { WidgetId } from '../../store/dashboardStore';
import type { WidgetCategory } from './types';

type CatalogRow =
  | { type: 'header'; key: string; category: WidgetCategory }
  | { type: 'widget'; key: string; id: WidgetId; titleKey: TranslationKey; placed: boolean };

interface AddWidgetSheetProps {
  visible: boolean;
  placedIds: WidgetId[];
  onClose: () => void;
  onAdd: (id: WidgetId) => void;
}

function buildRows(placedIds: WidgetId[]): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const category of CATEGORY_ORDER) {
    const widgets = WIDGET_CATALOG.filter((w) => w.category === category);
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
      <View
        className="flex-1 bg-surface-sunken"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            {t('dashboard.editAddCard')}
          </Text>
          <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>

        <FlashList
          data={rows}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text
                  accessibilityRole="header"
                  className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-subtle"
                >
                  {t(CATEGORY_TITLE_KEYS[item.category])}
                </Text>
              );
            }
            return (
              <Pressable
                onPress={() => onAdd(item.id)}
                disabled={item.placed}
                accessibilityRole="button"
                accessibilityLabel={t(item.titleKey)}
                accessibilityState={{ disabled: item.placed }}
                className={cn(
                  'mb-2 min-h-14 flex-row items-center justify-between rounded-2xl border border-border px-4 py-4',
                  item.placed ? 'bg-surface/50' : 'bg-surface active:bg-surface-elevated',
                )}
              >
                <Text
                  className={cn('text-base font-medium', item.placed ? 'text-subtle' : 'text-foreground')}
                >
                  {t(item.titleKey)}
                </Text>
                {item.placed && (
                  <Text className="text-xs text-subtle">{t('dashboard.editAlreadyAdded')}</Text>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
