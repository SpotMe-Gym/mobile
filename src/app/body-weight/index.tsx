import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { AiButton } from '@/shared/components/AiButton';
import { IconButton } from '@/shared/ui/IconButton';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '@/shared/expandable-card/ExpandableCardLayout';
import { BodyWeightCardContent } from '@/features/body-weight/components/BodyWeightCardContent';
import { ActionButton } from '@/features/dashboard/widgets/quickActions';
import { WeightChart } from '@/features/body-weight/components/WeightChart';
import { AddWeightModal } from '@/features/body-weight/components/AddWeightModal';
import { TrendBadge } from '@/features/body-weight/components/TrendBadge';
import { useWeightStore, type WeightEntry } from '@/features/body-weight/weightStore';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { successFeedback } from '@/shared/lib/haptics';
import { formatDayKey } from '@/shared/utils/date';

// Preview renders the same component as the home grid card so the two can never drift.
// Opened from the "Add weight" quick action, the preview is that button instead.
function WeightCardPreview() {
  const { t } = useTranslation();
  const { cardDimensions, widgetSize } = useExpandableCardContext();
  const fromAddAction = useLocalSearchParams<{ add?: string }>().add === '1';
  const { cardWidth, cardHeight } = cardDimensions;
  return (
    <View style={{ width: cardWidth, height: cardHeight }}>
      {fromAddAction ? (
        <ActionButton label={t('dashboard.addWeight')} />
      ) : (
        <BodyWeightCardContent size={widgetSize} style={{ width: cardWidth, height: cardHeight }} />
      )}
    </View>
  );
}

function WeightDetailContent() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ add?: string }>();
  const { handleClose, isExpanded } = useExpandableCardContext();
  const entries = useWeightStore((s) => s.entries);
  const addEntry = useWeightStore((s) => s.addEntry);
  const removeEntry = useWeightStore((s) => s.removeEntry);
  const isHydrated = useHasHydrated(useWeightStore);
  const { currentWeight, convertWeight, toKg, units } = useUnitConverter();
  const trend = useWeightTrend();
  const [modalVisible, setModalVisible] = useState(false);
  // From the "Add weight" quick action the sheet opens by itself, but only once the card has
  // finished expanding, so the two animations don't run on top of each other.
  const [autoAddHandled, setAutoAddHandled] = useState(false);
  const showModal = modalVisible || (params.add === '1' && isExpanded && !autoAddHandled);

  const newestFirst = useMemo(() => [...entries].reverse(), [entries]);
  const chartData = useMemo(
    () => entries.map((e) => ({ id: e.id, day: e.day, weight: convertWeight(e.kg).value })),
    [entries, convertWeight],
  );

  const handleDelete = useCallback(
    (entry: WeightEntry) => {
      Alert.alert(t('bodyWeight.deleteEntryTitle'), t('bodyWeight.deleteEntryMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeEntry(entry.id) },
      ]);
    },
    [removeEntry, t],
  );

  const header = (
    <View>
      <View className="items-center py-6">
        <View className="flex-row items-baseline">
          <Text className="text-6xl font-bold tracking-tighter text-foreground">
            {currentWeight.formatted}
          </Text>
          <Text className="ml-2 text-2xl font-medium text-subtle">{currentWeight.unit}</Text>
        </View>
        <View className="mt-2">
          <TrendBadge trend={trend} pill />
        </View>
      </View>
      <Text accessibilityRole="header" className="mb-3 text-lg font-bold text-foreground">
        {t('bodyWeight.trend')}
      </Text>
      <WeightChart data={chartData} unit={units.weight} />
      <Text accessibilityRole="header" className="mb-3 mt-6 text-lg font-bold text-foreground">
        {t('bodyWeight.history')}
      </Text>
    </View>
  );

  return (
    <View className="flex-1">
      <View className="items-center pb-1 pt-2">
        <View className="h-1 w-10 rounded-full bg-border-strong" />
      </View>
      <View className="px-4">
        <ScreenHeader title={t('bodyWeight.title')} onBack={handleClose} rightAction={<AiButton />} />
      </View>

      {isHydrated && (
        <FlashList
          data={newestFirst}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}
          ListEmptyComponent={
            <View className="items-center rounded-3xl border border-border bg-surface p-6">
              <Text className="text-subtle">{t('bodyWeight.noHistoryYet')}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const dw = convertWeight(item.kg);
            return (
              <View
                className={`flex-row items-center justify-between border-x border-border bg-surface px-4 py-2 ${
                  index === 0 ? 'rounded-t-3xl border-t' : ''
                } ${index === newestFirst.length - 1 ? 'rounded-b-3xl border-b' : 'border-b'}`}
              >
                <Text className="capitalize text-muted">
                  {formatDayKey(item.day, i18n.language, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-bold text-foreground">
                    {dw.formatted} <Text className="text-xs font-normal text-subtle">{dw.unit}</Text>
                  </Text>
                  <IconButton
                    icon={Trash2}
                    variant="danger"
                    iconSize={18}
                    accessibilityLabel={t('bodyWeight.deleteEntryA11y', {
                      value: dw.formatted,
                      unit: dw.unit,
                    })}
                    onPress={() => handleDelete(item)}
                  />
                </View>
              </View>
            );
          }}
        />
      )}

      <AddWeightModal
        visible={showModal}
        onClose={() => {
          setModalVisible(false);
          setAutoAddHandled(true);
        }}
        unit={units.weight}
        initialWeight={currentWeight.formatted === '--' ? null : Number(currentWeight.formatted)}
        onSave={(w, day) => {
          addEntry(toKg(w), day);
          successFeedback();
        }}
      />

      <IconButton
        icon={Plus}
        variant="primary"
        iconSize={28}
        accessibilityLabel={t('bodyWeight.logWeight')}
        onPress={() => setModalVisible(true)}
        className="absolute right-6 h-14 w-14 shadow-lg"
        style={{ bottom: insets.bottom + 24 }}
      />
    </View>
  );
}

export default function WeightDetail() {
  return (
    <ExpandableCardLayoutWithContext previewContent={<WeightCardPreview />}>
      <WeightDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
