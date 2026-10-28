import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { colors } from '@/theme/colors';
import {
  ExpandableCardLayoutWithContext,
  useExpandableCardContext,
} from '@/shared/expandable-card/ExpandableCardLayout';
import { BodyCardContent } from '@/features/body/components/BodyCardContent';
import { BodyViewer } from '@/features/body/components/BodyViewer';
import { LogMeasurementsSheet } from '@/features/body/components/LogMeasurementsSheet';
import { MeasurementRow } from '@/features/body/components/MeasurementRow';
import { WeightPage } from '@/features/body/components/WeightPage';
import { AddWeightModal } from '@/features/body-weight/components/AddWeightModal';
import { useWeightStore, type WeightEntry } from '@/features/body-weight/weightStore';
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

type Page = 'weight' | 'body';
const PAGES: Page[] = ['weight', 'body'];
const WEIGHT_ROWS = 5;

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
        {title}
      </Text>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={action}
        className="h-9 flex-row items-center gap-1 rounded-full bg-primary/15 px-3 active:opacity-70"
      >
        <Icon icon={Plus} size={16} color={colors['primary-text']} />
        <Text className="text-sm font-semibold text-primary-text">{action}</Text>
      </Pressable>
    </View>
  );
}

function BodyDetailContent() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { handleClose, isExpanded } = useExpandableCardContext();
  const [mode, setMode] = useState<HighlightMode>('progress');
  const [compare, setCompare] = useState<CompareTo>('previous');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [allWeights, setAllWeights] = useState(false);
  const [measureSheet, setMeasureSheet] = useState(false);
  const [weightSheet, setWeightSheet] = useState(false);
  const [page, setPage] = useState(0);
  const pager = useRef<ScrollViewInstance>(null);

  const hydrated = useHasHydrated(useBodyStore);
  const entries = useBodyStore((s) => s.measurements);
  const addMeasurements = useBodyStore((s) => s.addMeasurements);
  const removeMeasurements = useBodyStore((s) => s.removeMeasurements);
  const weights = useWeightStore((s) => s.entries);
  const addWeight = useWeightStore((s) => s.addEntry);
  const removeWeight = useWeightStore((s) => s.removeEntry);
  const { unit, format } = useLengthUnit();
  const { convertHeight, convertWeight, currentWeight, toKg, units } = useUnitConverter();
  const {
    model,
    failed,
    current,
    baseline,
    deltas,
    solution,
    positions,
    colors: vertexColors,
    goal,
  } = useBodyAvatar(compare, mode);

  const since = baseline
    ? formatDayKey(baseline.day, i18n.language, { day: 'numeric', month: 'short' })
    : undefined;
  const height = convertHeight(current.heightCm);
  const newestWeights = useMemo(() => [...weights].reverse(), [weights]);
  const shownWeights = allWeights ? newestWeights : newestWeights.slice(0, WEIGHT_ROWS);

  // The top slider, like Today's plan: one page per view, the logs below stay where they are.
  const pageWidth = windowWidth - 32;
  const gap = 12;
  const sliderHeight = Math.round(windowHeight * 0.62);
  const goTo = (i: number) => {
    pager.current?.scrollTo({ x: i * (pageWidth + gap), animated: true });
    setPage(i);
  };
  const onPageSettled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setPage(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + gap))),
    [pageWidth],
  );

  const confirmDeleteMeasurements = useCallback(
    (entry: MeasurementEntry) => {
      Alert.alert(t('body.deleteSessionTitle'), t('body.deleteSessionMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeMeasurements(entry.id) },
      ]);
    },
    [removeMeasurements, t],
  );
  const confirmDeleteWeight = useCallback(
    (entry: WeightEntry) => {
      Alert.alert(t('bodyWeight.deleteEntryTitle'), t('bodyWeight.deleteEntryMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeWeight(entry.id) },
      ]);
    },
    [removeWeight, t],
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

  const pageLabel = (p: Page) => (p === 'weight' ? t('bodyWeight.weight') : t('body.page3d'));

  return (
    <View className="flex-1">
      <View className="items-center pb-1 pt-2">
        <View className="h-1 w-10 rounded-full bg-border-strong" />
      </View>
      <View className="px-4">
        <ScreenHeader title={t('body.title')} subtitle={t('body.subtitle')} onBack={handleClose} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Which slide: the clearest way to switch, whatever the finger is doing on the body. */}
        <View className="px-4 pb-3">
          <SegmentedControl
            value={PAGES[page] ?? 'weight'}
            onChange={(p) => goTo(PAGES.indexOf(p))}
            segments={PAGES.map((p) => ({ value: p, label: pageLabel(p) }))}
          />
        </View>

        {/* Swipe between the weight and the 3D body. On the body, a slow sideways drag turns
          it, a quick swipe changes slide, and an up/down drag scrolls the page. */}
        <ScrollView
          ref={pager}
          horizontal
          decelerationRate="fast"
          snapToInterval={pageWidth + gap}
          snapToAlignment="start"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPageSettled}
          contentContainerStyle={{ paddingHorizontal: 16, gap }}
          style={{ flexGrow: 0 }}
        >
          <View
            style={{ width: pageWidth, height: sliderHeight }}
            className="overflow-hidden rounded-3xl border border-border bg-surface"
            accessibilityLabel={pageLabel('weight')}
          >
            <WeightPage
              height={sliderHeight}
              heightLabel={t('body.heightLabel', { height: `${height.formatted} ${height.unit}` })}
            />
          </View>
          <View
            style={{ width: pageWidth, height: sliderHeight }}
            className="overflow-hidden rounded-3xl border border-border bg-surface"
          >
            <View className="flex-row items-center justify-between px-5 pt-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
                {t('body.page3d')}
              </Text>
            </View>
            <View className="flex-1 items-center justify-center">
              {failed ? (
                <Text className="text-subtle">{t('body.loadFailed')}</Text>
              ) : isExpanded && model && positions && vertexColors && solution ? (
                <BodyViewer
                  positions={positions}
                  colors={vertexColors}
                  indices={model.indices}
                  heightM={current.heightCm / 100}
                  accessibilityLabel={t('body.viewerA11y')}
                  style={{ width: '100%', height: '100%' }}
                  scrollFriendly
                  onSwipe={(direction) => goTo(direction === 'right' ? 0 : 1)}
                />
              ) : (
                <ActivityIndicator color={colors.muted} />
              )}
            </View>
            {baseline ? (
              <View className="pb-2">
                <Legend mode={mode} />
              </View>
            ) : null}
            <View className="flex-row gap-2 px-3 pb-3">
              <SegmentedControl
                size="sm"
                className="flex-1"
                value={mode}
                onChange={setMode}
                segments={[
                  {
                    value: 'progress',
                    label: t('body.modeProgress'),
                    accessibilityLabel: `${t('body.colours')}: ${t('body.modeProgress')}`,
                  },
                  {
                    value: 'change',
                    label: t('body.modeChange'),
                    accessibilityLabel: `${t('body.colours')}: ${t('body.modeChange')}`,
                  },
                ]}
              />
              <SegmentedControl
                size="sm"
                className="flex-1"
                value={compare}
                onChange={setCompare}
                segments={[
                  {
                    value: 'previous',
                    label: t('body.comparePrevious'),
                    accessibilityLabel: `${t('body.compareWith')}: ${t('body.comparePrevious')}`,
                  },
                  {
                    value: 'first',
                    label: t('body.compareFirst'),
                    accessibilityLabel: `${t('body.compareWith')}: ${t('body.compareFirst')}`,
                  },
                ]}
              />
            </View>
          </View>
        </ScrollView>

        <View className="mt-3 flex-row justify-center gap-1.5" pointerEvents="none">
          {PAGES.map((p, i) => (
            <View
              key={p}
              className={`h-1.5 rounded-full ${page === i ? 'w-5 bg-primary' : 'w-1.5 bg-border-strong'}`}
            />
          ))}
        </View>

        <View className="px-4">
          <SectionHeader
            title={t('body.weightLog')}
            action={t('bodyWeight.logWeight')}
            onAction={() => setWeightSheet(true)}
          />
          {newestWeights.length === 0 ? (
            <View className="rounded-2xl border border-border bg-surface p-4">
              <Text className="text-sm text-muted">{t('bodyWeight.noHistoryYet')}</Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl border border-border bg-surface">
              {shownWeights.map((entry, i) => {
                const dw = convertWeight(entry.kg);
                const date = formatDayKey(entry.day, i18n.language, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <View
                    key={entry.id}
                    className={`flex-row items-center justify-between py-1 pl-4 pr-1 ${i < shownWeights.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <Text className="capitalize text-muted">{date}</Text>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-base font-bold text-foreground">
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
                        onPress={() => confirmDeleteWeight(entry)}
                      />
                    </View>
                  </View>
                );
              })}
              {newestWeights.length > WEIGHT_ROWS && (
                <Pressable
                  onPress={() => setAllWeights((v) => !v)}
                  accessibilityRole="button"
                  className="h-11 items-center justify-center border-t border-border active:bg-surface-elevated"
                >
                  <Text className="text-sm font-semibold text-primary-text">
                    {allWeights ? t('body.showLess') : t('body.showAll', { count: newestWeights.length })}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <SectionHeader
            title={t('body.measurementsLog')}
            action={t('body.logMeasurements')}
            onAction={() => setMeasureSheet(true)}
          />
          {since && (
            <Text className="-mt-2 mb-2 ml-1 text-xs text-subtle">{t('body.since', { date: since })}</Text>
          )}
          {hydrated && entries.length === 0 && (
            <View className="mb-3 rounded-2xl border border-border bg-surface p-4">
              <Text className="font-semibold text-foreground">{t('body.noMeasurements')}</Text>
              <Text className="mt-1 text-sm text-muted">{t('body.noMeasurementsHint')}</Text>
            </View>
          )}
          {!baseline && entries.length > 0 && (
            <Text className="mb-2 ml-1 text-xs text-subtle">{t('body.noBaseline')}</Text>
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

          {entries.length > 0 && (
            <>
              <Text accessibilityRole="header" className="mb-3 mt-6 text-base font-bold text-foreground">
                {t('body.history')}
              </Text>
              <View className="overflow-hidden rounded-2xl border border-border bg-surface">
                {[...entries].reverse().map((entry, i, list) => {
                  const date = formatDayKey(entry.day, i18n.language, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
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
                        onPress={() => confirmDeleteMeasurements(entry)}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <Text accessibilityRole="header" className="mb-3 mt-6 text-base font-bold text-foreground">
            {t('body.composition')}
          </Text>
          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="text-sm text-muted">{t('body.compositionHint')}</Text>
          </View>
        </View>
      </ScrollView>

      <LogMeasurementsSheet
        visible={measureSheet}
        previous={current.measurements}
        onClose={() => setMeasureSheet(false)}
        onSave={(values) => {
          addMeasurements(values);
          successFeedback();
        }}
      />
      <AddWeightModal
        visible={weightSheet}
        onClose={() => setWeightSheet(false)}
        unit={units.weight}
        initialWeight={currentWeight.formatted === '--' ? null : Number(currentWeight.formatted)}
        onSave={(w, day) => {
          addWeight(toKg(w), day);
          successFeedback();
        }}
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
