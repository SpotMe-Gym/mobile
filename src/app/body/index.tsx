import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { colors } from '@/theme/colors';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '@/shared/expandable-card/ExpandableCardLayout';
import { BodyCardContent } from '@/features/body/components/BodyCardContent';
import { BodyViewer } from '@/features/body/components/BodyViewer';
import { LogMeasurementsSheet } from '@/features/body/components/LogMeasurementsSheet';
import { MeasurementRow } from '@/features/body/components/MeasurementRow';
import { useBodyAvatar } from '@/features/body/hooks/useBodyAvatar';
import { useLengthUnit } from '@/features/body/hooks/useLengthUnit';
import { useBodyStore } from '@/features/body/bodyStore';
import { MEASUREMENTS, type MeasurementGroup } from '@/features/body/measurementCatalog';
import { toneFor, type HighlightMode } from '@/features/body/avatar/zoneColors';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { successFeedback } from '@/shared/lib/haptics';
import { formatDayKey } from '@/shared/utils/date';
import type { CompareTo } from '@/features/body/snapshots';
import type { MeasurementEntry } from '@/features/body/types';

// Preview renders the same component as the home grid card so the two can never drift.
function BodyCardPreview() {
  const { cardDimensions, widgetSize } = useExpandableCardContext();
  const { cardWidth, cardHeight } = cardDimensions;
  return (
    <View style={{ width: cardWidth, height: cardHeight }}>
      <BodyCardContent size={widgetSize} style={{ width: cardWidth, height: cardHeight }} />
    </View>
  );
}

function Legend({ mode }: { mode: HighlightMode }) {
  const { t } = useTranslation();
  const items = [
    { color: colors.success, label: mode === 'progress' ? t('body.legendGood') : t('body.legendGrew') },
    { color: colors.danger, label: mode === 'progress' ? t('body.legendBad') : t('body.legendShrank') },
    { color: '#b07a5e', label: t('body.legendSame') },
  ];
  return (
    <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1" accessible accessibilityRole="text">
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center">
          <View className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          <Text className="text-xs text-muted">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BodyDetailContent() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { handleClose, isExpanded } = useExpandableCardContext();
  const [mode, setMode] = useState<HighlightMode>('progress');
  const [compare, setCompare] = useState<CompareTo>('previous');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hydrated = useHasHydrated(useBodyStore);
  const entries = useBodyStore((s) => s.measurements);
  const addMeasurements = useBodyStore((s) => s.addMeasurements);
  const removeMeasurements = useBodyStore((s) => s.removeMeasurements);
  const { unit, format } = useLengthUnit();
  const { convertWeight, convertHeight } = useUnitConverter();
  const { model, failed, current, baseline, deltas, solution, positions, colors: vertexColors, goal } =
    useBodyAvatar(compare, mode);

  const since = baseline ? formatDayKey(baseline.day, i18n.language, { day: 'numeric', month: 'short' }) : undefined;
  const weight = convertWeight(current.weightKg);
  const height = convertHeight(current.heightCm);

  const confirmDelete = useCallback(
    (entry: MeasurementEntry) => {
      Alert.alert(t('body.deleteSessionTitle'), t('body.deleteSessionMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeMeasurements(entry.id) },
      ]);
    },
    [removeMeasurements, t],
  );

  const rows = (group: MeasurementGroup) => {
    const defs = MEASUREMENTS.filter((d) => d.group === group);
    return (
      <View className="overflow-hidden rounded-2xl border border-border bg-surface">
        {defs.map((def, i) => {
          const delta = deltas[def.key];
          return (
            <MeasurementRow
              key={def.key}
              def={def}
              value={current.measurements[def.key]}
              estimate={solution?.predictedCm[def.key]}
              delta={delta}
              tone={delta === undefined ? 'neutral' : toneFor(def.key, delta, mode, goal)}
              unit={unit}
              format={format}
              sinceLabel={since}
              last={i === defs.length - 1}
            />
          );
        })}
      </View>
    );
  };

  // The 3D canvas mounts once the card has finished expanding: GL setup during the morph
  // would cost frames, and the canvas can't be clipped by the growing card anyway.
  const viewerHeight = Math.round(windowHeight * 0.5);

  return (
    <View className="flex-1">
      <View className="items-center pb-1 pt-2">
        <View className="h-1 w-10 rounded-full bg-border-strong" />
      </View>
      <View className="px-4">
        <ScreenHeader title={t('body.title')} subtitle={t('body.subtitle')} onBack={handleClose} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface"
          style={{ height: viewerHeight }}
        >
          {failed ? (
            <Text className="text-subtle">{t('body.loadFailed')}</Text>
          ) : isExpanded && model && positions && vertexColors && solution ? (
            <BodyViewer
              positions={positions}
              colors={vertexColors}
              indices={model.indices}
              heightM={(current.heightCm / 100)}
              accessibilityLabel={t('body.viewerA11y')}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <ActivityIndicator color={colors.muted} />
          )}
        </View>

        <Text className="mt-2 text-center text-sm text-muted">
          {t('body.heightWeight', {
            height: `${height.formatted} ${height.unit}`,
            weight: `${weight.formatted} ${weight.unit}`,
          })}
        </Text>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1.5 ml-1 text-xs font-medium text-muted">{t('body.colours')}</Text>
            <SegmentedControl
              size="sm"
              value={mode}
              onChange={setMode}
              segments={[
                { value: 'progress', label: t('body.modeProgress') },
                { value: 'change', label: t('body.modeChange') },
              ]}
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1.5 ml-1 text-xs font-medium text-muted">{t('body.compareWith')}</Text>
            <SegmentedControl
              size="sm"
              value={compare}
              onChange={setCompare}
              segments={[
                { value: 'previous', label: t('body.comparePrevious') },
                { value: 'first', label: t('body.compareFirst') },
              ]}
            />
          </View>
        </View>
        <View className="mt-3">
          {baseline ? (
            <Legend mode={mode} />
          ) : (
            <Text className="text-center text-xs text-subtle">{t('body.noBaseline')}</Text>
          )}
        </View>

        <View className="mb-3 mt-6 flex-row items-baseline justify-between">
          <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
            {t('body.measurements')}
          </Text>
          {since && <Text className="text-xs text-subtle">{t('body.since', { date: since })}</Text>}
        </View>
        {hydrated && entries.length === 0 && (
          <View className="mb-3 rounded-2xl border border-border bg-surface p-4">
            <Text className="font-semibold text-foreground">{t('body.noMeasurements')}</Text>
            <Text className="mt-1 text-sm text-muted">{t('body.noMeasurementsHint')}</Text>
          </View>
        )}
        {rows('primary')}

        <Pressable
          onPress={() => setShowAdvanced((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAdvanced }}
          accessibilityLabel={showAdvanced ? t('body.hideAdvanced') : t('body.showAdvanced')}
          className="mt-3 h-12 flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4"
        >
          <Text className="font-semibold text-foreground">{t('body.advanced')}</Text>
          <Icon icon={showAdvanced ? ChevronUp : ChevronDown} size={20} color={colors.muted} />
        </Pressable>
        {showAdvanced && <View className="mt-3">{rows('advanced')}</View>}

        <Text accessibilityRole="header" className="mb-3 mt-6 text-lg font-bold text-foreground">
          {t('body.composition')}
        </Text>
        <View className="rounded-2xl border border-border bg-surface p-4">
          <Text className="text-sm text-muted">{t('body.compositionHint')}</Text>
        </View>

        {entries.length > 0 && (
          <>
            <Text accessibilityRole="header" className="mb-3 mt-6 text-lg font-bold text-foreground">
              {t('body.history')}
            </Text>
            <View className="overflow-hidden rounded-2xl border border-border bg-surface">
              {[...entries].reverse().map((entry, i, list) => {
                const date = formatDayKey(entry.day, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <View
                    key={entry.id}
                    className={`flex-row items-center justify-between py-1 pl-4 pr-1 ${i < list.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <View>
                      <Text className="capitalize text-foreground">{date}</Text>
                      <Text className="text-xs text-subtle">
                        {t('body.valuesCount', { count: Object.keys(entry.values).length })}
                      </Text>
                    </View>
                    <IconButton
                      icon={Trash2}
                      variant="danger"
                      iconSize={18}
                      accessibilityLabel={t('body.deleteSessionA11y', { date })}
                      onPress={() => confirmDelete(entry)}
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <LogMeasurementsSheet
        visible={sheetOpen}
        previous={current.measurements}
        onClose={() => setSheetOpen(false)}
        onSave={(values) => {
          addMeasurements(values);
          successFeedback();
        }}
      />

      <IconButton
        icon={Plus}
        variant="primary"
        iconSize={28}
        accessibilityLabel={t('body.logMeasurements')}
        onPress={() => setSheetOpen(true)}
        className="absolute right-6 h-14 w-14 shadow-lg"
        style={{ bottom: insets.bottom + 24 }}
      />
    </View>
  );
}

export default function BodyScreen() {
  return (
    <ExpandableCardLayoutWithContext previewContent={<BodyCardPreview />}>
      <BodyDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
