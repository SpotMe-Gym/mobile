/**
 * Section widgets for the home: more ways to see each section at a glance. Each one reads the
 * same stores as its section; the numbers come from `insights.ts`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Polyline } from 'react-native-svg';
import {
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  PersonStanding,
  Plus,
  Ruler,
  Scale,
  Utensils,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { successFeedback } from '@/shared/lib/haptics';
import { formatNumber } from '@/shared/utils/number';
import { formatDayKey, fromDayKey, weekdayLabel } from '@/shared/utils/date';
import { useToday } from '@/shared/hooks/useToday';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { TrendBadge } from '@/features/body-weight/components/TrendBadge';
import { AddWeightModal } from '@/features/body-weight/components/AddWeightModal';
import { useBodyStore, carryForward } from '@/features/body/bodyStore';
import { MEASUREMENTS } from '@/features/body/measurementCatalog';
import { useLengthUnit } from '@/features/body/hooks/useLengthUnit';
import { LogMeasurementsSheet } from '@/features/body/components/LogMeasurementsSheet';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useUserStore } from '@/features/profile/userStore';
import {
  useDailyTotals,
  useNutritionStore,
  type FoodHistoryItem,
  type FoodRef,
} from '@/features/nutrition/nutritionStore';
import {
  defaultPortion,
  macrosForPortion,
  mealForTime,
  portionToBase,
} from '@/features/nutrition/utils/portion';
import { useWorkoutStore } from '@/features/workouts/workoutStore';
import { useSessionStore } from '@/features/sessions/sessionStore';
import { weekStatus } from '@/features/sessions/weekStats';
import { resolveExercise } from '@/features/exercises/resolve';
import { ExerciseAnimation } from '@/features/exercises/components/ExerciseAnimation';
import { GROUP_ORDER } from '@/features/exercises/library';
import { useTodaysWorkouts } from '@/features/workouts/hooks/useTodaysWorkouts';
import { ActionButton } from '@/features/dashboard/widgets/quickActions';
import {
  caloriesWeek,
  frequentFoods,
  nextWorkout,
  trainingStreak,
  weeklyVolume,
  weightWindow,
} from '@/features/dashboard/widgets/insights';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';
import type { TranslationKey } from '@/i18n/keys';

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------

function Frame({
  title,
  icon,
  children,
  padded = true,
}: {
  title: string;
  icon?: typeof Scale;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
      <Card
        className={cn('h-full w-full flex-1 bg-transparent', !padded && 'p-0 pt-4')}
        title={title}
        headerRight={icon ? <Icon icon={icon} size={18} color={colors.subtle} /> : undefined}
      >
        {children}
      </Card>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View className="flex-1 justify-center">
      <Text className="text-sm text-subtle" numberOfLines={4}>
        {text}
      </Text>
    </View>
  );
}

/** A line scaled to its own range, with an optional dashed reference line. */
function Sparkline({
  values,
  width,
  height,
  color = colors.accent,
  reference,
}: {
  values: number[];
  width: number;
  height: number;
  color?: string;
  reference?: number;
}) {
  if (values.length < 2 || width <= 0) return <View style={{ height }} />;
  const all = reference === undefined ? values : [...values, reference];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no">
      {reference !== undefined && (
        <Line
          x1={0}
          x2={width}
          y1={y(reference)}
          y2={y(reference)}
          stroke={colors['border-strong']}
          strokeDasharray="4 4"
        />
      )}
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Pages that slide sideways inside a card, like Today's plan. Taps open the section; a long
 * press enters edit mode; while editing the pages stay put.
 */
function CardPager({
  width,
  pages,
  isEditing,
  onOpen,
  onLongPress,
  onPressIn,
  onPressOut,
  label,
}: {
  width: number;
  pages: { key: string; label: string; node: ReactNode }[];
  isEditing: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const pageWidth = Math.max(width - 2, 0);
  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
      {pageWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!isEditing}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {pages.map((p) => (
            <Pressable
              key={p.key}
              style={{ width: pageWidth }}
              className="flex-1"
              disabled={isEditing}
              onPress={onOpen}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onLongPress={onLongPress}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${p.label}`}
              accessibilityActions={[{ name: 'longpress', label: t('dashboard.editLayout') }]}
              onAccessibilityAction={onLongPress}
            >
              {p.node}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {pages.length > 1 && (
        <View pointerEvents="none" className="absolute bottom-2 left-0 right-0 flex-row justify-center gap-1">
          {pages.map((p, i) => (
            <View
              key={p.key}
              className={cn('h-1 rounded-full', i === page ? 'w-3 bg-foreground/70' : 'w-1 bg-foreground/30')}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Body & weight
// ---------------------------------------------------------------------------------------------

/** Weight and body in one card: swipe between them, tap to open the Body screen. */
function BodyAndWeightRender({
  size,
  width,
  isEditing,
  onOpenDetail,
  onEnterEdit,
  onPressIn,
  onPressOut,
}: WidgetRenderProps) {
  const { t } = useTranslation();
  const entries = useWeightStore((s) => s.entries);
  const measurements = useBodyStore((s) => s.measurements);
  const { currentWeight, convertWeight } = useUnitConverter();
  const trend = useWeightTrend();
  const { unit, format } = useLengthUnit();
  const [chartWidth, setChartWidth] = useState(0);
  const now = carryForward(measurements);
  const before = carryForward(measurements.slice(0, -1));
  const waist = now.waist;
  const waistChange = waist !== undefined && before.waist !== undefined ? waist - before.waist : undefined;
  const spark = useMemo(
    () => entries.slice(-14).map((e) => convertWeight(e.kg).value),
    [entries, convertWeight],
  );
  const big = size === 'full' ? 'text-5xl' : 'text-4xl';

  return (
    <CardPager
      width={width}
      isEditing={isEditing}
      onOpen={onOpenDetail}
      onLongPress={onEnterEdit}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      label={t('dashboard.bodyAndWeight')}
      pages={[
        {
          key: 'weight',
          label: `${currentWeight.formatted} ${currentWeight.unit}`,
          node: (
            <View
              className="flex-1 p-4 pb-5"
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 32)}
            >
              <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
                {t('bodyWeight.weight')}
              </Text>
              <Text className={cn('mt-1 font-bold tracking-tighter text-foreground', big)} numberOfLines={1}>
                {currentWeight.formatted}
                <Text className="text-base font-normal text-subtle"> {currentWeight.unit}</Text>
              </Text>
              <TrendBadge trend={trend} compact={size !== 'full'} />
              <View className="mt-auto">
                <Sparkline values={spark} width={chartWidth} height={size === 'full' ? 48 : 36} />
              </View>
            </View>
          ),
        },
        {
          key: 'body',
          label: t('body.page3d'),
          node: (
            <View className="flex-1 p-4 pb-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
                  {t('body.page3d')}
                </Text>
                <Icon icon={PersonStanding} size={18} color={colors.subtle} />
              </View>
              {waist === undefined ? (
                <Empty text={t('body.cardEmpty')} />
              ) : (
                <View className="mt-1 flex-1 justify-between">
                  <View>
                    <Text className="text-xs text-muted">{t('body.cardWaist')}</Text>
                    <Text className={cn('font-bold tracking-tighter text-foreground', big)}>
                      {format(waist)}
                      <Text className="text-base font-normal text-subtle"> {unit}</Text>
                    </Text>
                    {waistChange !== undefined && (
                      <Text className="text-xs font-semibold text-muted">
                        {format(waistChange, true)} {unit} · {t('dashboard.sinceLastSession')}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-subtle">{t('dashboard.openBody3d')}</Text>
                </View>
              )}
            </View>
          ),
        },
      ]}
    />
  );
}

/** The last 30 days of weight as a line, with the change across them. */
function WeightTrendRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const entries = useWeightStore((s) => s.entries);
  const { convertWeight } = useUnitConverter();
  const [w, setW] = useState(0);
  const { points, changeKg } = useMemo(() => weightWindow(entries, 30), [entries]);
  const values = points.map((p) => convertWeight(p.kg).value);
  const change = changeKg === null ? null : convertWeight(Math.abs(changeKg));
  return (
    <Frame title={t('dashboard.weightTrend')} icon={Scale}>
      {points.length < 2 ? (
        <Empty text={t('dashboard.notEnoughWeights')} />
      ) : (
        <View className="flex-1" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <Text className="text-2xl font-bold tracking-tight text-foreground">
            {changeKg! > 0 ? '+' : changeKg! < 0 ? '−' : '±'}
            {formatNumber(change!.value, i18n.language, 1)}
            <Text className="text-sm font-normal text-subtle"> {change!.unit}</Text>
          </Text>
          <Text className="text-xs text-subtle">{t('dashboard.last30')}</Text>
          <View className="mt-auto">
            <Sparkline values={values} width={w} height={size === 'full' ? 70 : 54} reference={values[0]} />
          </View>
        </View>
      )}
    </Frame>
  );
}

/** Every girth you've measured, one per page, with its change since the session before. */
function MeasurementsRender({
  size,
  width,
  isEditing,
  onOpenDetail,
  onEnterEdit,
  onPressIn,
  onPressOut,
}: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const sessions = useBodyStore((s) => s.measurements);
  const { unit, format } = useLengthUnit();
  const latest = sessions[sessions.length - 1];
  const now = carryForward(sessions);
  const before = carryForward(sessions.slice(0, -1));
  const measured = MEASUREMENTS.filter((d) => now[d.key] !== undefined);
  const title = t('dashboard.measurementsWidget');

  if (measured.length === 0) {
    return (
      <Pressable
        className="flex-1"
        disabled={isEditing}
        onPress={onOpenDetail}
        onLongPress={onEnterEdit}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Frame title={title} icon={Ruler}>
          <Empty text={t('dashboard.noMeasurementsWidget')} />
        </Frame>
      </Pressable>
    );
  }
  return (
    <CardPager
      width={width}
      isEditing={isEditing}
      onOpen={onOpenDetail}
      onLongPress={onEnterEdit}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      label={title}
      pages={measured.map((d) => {
        const value = now[d.key]!;
        const prev = before[d.key];
        const change = prev === undefined ? undefined : value - prev;
        const name = t(`body.m.${d.key}` as TranslationKey);
        return {
          key: d.key,
          label: `${name} ${format(value)} ${unit}`,
          node: (
            <View className="flex-1 p-4 pb-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                  {title}
                </Text>
                <Icon icon={Ruler} size={18} color={colors.subtle} />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
                  {name}
                </Text>
                <Text
                  className={cn(
                    'font-bold tracking-tighter text-foreground',
                    size === 'compact' ? 'text-3xl' : 'text-4xl',
                  )}
                >
                  {format(value)}
                  <Text className="text-base font-normal text-subtle"> {unit}</Text>
                </Text>
                {change !== undefined ? (
                  <Text className="text-xs font-semibold text-muted">
                    {format(change, true)} {unit} · {t('dashboard.sinceLastSession')}
                  </Text>
                ) : latest ? (
                  <Text className="text-xs text-subtle">
                    {formatDayKey(latest.day, i18n.language, { day: 'numeric', month: 'short' })}
                  </Text>
                ) : null}
              </View>
            </View>
          ),
        };
      })}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------------------------

/** Seven bars, one per day, against the calorie target. */
function CaloriesWeekRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const days = useNutritionStore((s) => s.days);
  const target = useUserStore((s) => s.targets.kcal);
  const today = useToday();
  const week = useMemo(() => caloriesWeek(days, fromDayKey(today)), [days, today]);
  const logged = week.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((n, d) => n + d.kcal, 0) / logged.length) : 0;
  const max = Math.max(target, ...week.map((d) => d.kcal), 1);
  const barArea = size === 'full' ? 80 : 64;
  return (
    <Frame title={t('dashboard.caloriesWeek')} icon={Flame}>
      <Text className="text-xs text-subtle">
        {logged.length
          ? t('dashboard.avgPerDay', { value: formatNumber(avg, i18n.language, 0) })
          : t('dashboard.noMealsWeek')}
      </Text>
      <View className="mt-auto flex-row items-end justify-between" style={{ height: barArea + 16 }}>
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 border-t border-dashed border-border-strong"
          style={{ bottom: 16 + (target / max) * barArea }}
        />
        {week.map((d) => {
          const over = d.kcal > target * 1.05;
          return (
            <View key={d.day} className="items-center" style={{ width: `${100 / 7}%` }}>
              <View
                style={{
                  height: Math.max(3, (d.kcal / max) * barArea),
                  width: size === 'full' ? 14 : 9,
                  borderRadius: 4,
                }}
                className={cn(
                  d.kcal === 0
                    ? 'bg-surface-elevated'
                    : over
                      ? 'bg-highlight'
                      : d.day === today
                        ? 'bg-accent'
                        : 'bg-primary/70',
                )}
              />
              <Text
                className={cn(
                  'mt-1 text-[10px] font-semibold uppercase',
                  d.day === today ? 'text-primary-text' : 'text-subtle',
                )}
              >
                {weekdayLabel(isoOf(d.day), i18n.language, 'narrow')}
              </Text>
            </View>
          );
        })}
      </View>
    </Frame>
  );
}
const isoOf = (day: string) => {
  const js = fromDayKey(day).getDay();
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

/** Protein eaten today against the target, and per kg of body weight. */
function ProteinTodayRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const totals = useDailyTotals(today);
  const target = useUserStore((s) => s.targets.protein);
  const kg = useWeightStore((s) => s.entries[s.entries.length - 1]?.kg ?? null);
  const pct = target > 0 ? Math.min(1, totals.protein / target) : 0;
  return (
    <Frame title={t('dashboard.proteinToday')}>
      <View className="flex-1 justify-center">
        <Text
          className={cn(
            'font-bold tracking-tighter text-foreground',
            size === 'compact' ? 'text-3xl' : 'text-4xl',
          )}
        >
          {formatNumber(totals.protein, i18n.language, 0)}
          <Text className="text-base font-normal text-subtle"> / {target} g</Text>
        </Text>
        {kg ? (
          <Text className="text-xs text-muted">
            {t('dashboard.perKg', { value: formatNumber(totals.protein / kg, i18n.language, 1) })}
          </Text>
        ) : null}
      </View>
      <View
        className="h-2 overflow-hidden rounded-full bg-surface-elevated"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        <View
          className={cn('h-full rounded-full', pct >= 1 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${pct * 100}%` }}
        />
      </View>
    </Frame>
  );
}

/** Your most-logged foods; one tap logs the usual portion to the meal of the hour. */
function FrequentFoodsRender({ size, isEditing, onOpenDetail, onEnterEdit }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const foods = useNutritionStore((s) => s.foods);
  const addEntry = useNutritionStore((s) => s.addEntry);
  const imperial = useUserStore((s) => s.units.weight === 'lbs');
  const today = useToday();
  const [just, setJust] = useState<string | null>(null);
  const list = useMemo(() => frequentFoods(foods, size === 'full' ? 4 : 3), [foods, size]);

  const log = (item: FoodHistoryItem) => {
    const { quantity, unit } = defaultPortion(item, imperial, item.lastPortion);
    const macros = macrosForPortion(item, quantity, unit);
    if (!macros) return;
    const ref: FoodRef = {
      code: item.code,
      name: item.name,
      brand: item.brand,
      imageUrl: item.imageUrl,
      base: item.base,
      per100: item.per100,
      servingSize: item.servingSize,
      servingLabel: item.servingLabel,
      servingOnly: item.servingOnly,
      source: item.source,
    };
    addEntry(
      today,
      {
        meal: mealForTime(),
        name: item.name,
        brand: item.brand,
        foodCode: item.code,
        quantity,
        unit,
        amount: portionToBase(quantity, unit, item) ?? undefined,
        macros,
      },
      ref,
    );
    successFeedback();
    setJust(item.code);
    setTimeout(() => setJust((c) => (c === item.code ? null : c)), 1600);
  };

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface p-4">
      <Pressable
        onPress={isEditing ? undefined : onOpenDetail}
        onLongPress={onEnterEdit}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.frequentFoods')}
        className="mb-2 flex-row items-center justify-between"
      >
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground" numberOfLines={1}>
          {t('dashboard.frequentFoods')}
        </Text>
        <Icon icon={ChevronRight} size={18} color={colors.subtle} />
      </Pressable>
      {list.length === 0 ? (
        <Empty text={t('dashboard.noFrequentFoods')} />
      ) : (
        list.map((item) => {
          const { quantity, unit } = defaultPortion(item, imperial, item.lastPortion);
          const portion =
            unit === 'serving'
              ? `${formatNumber(quantity, i18n.language, 2)} × ${item.servingLabel ?? t('dashboard.serving')}`
              : `${formatNumber(quantity, i18n.language, 1)} ${unit}`;
          const done = just === item.code;
          return (
            <Pressable
              key={item.code}
              disabled={isEditing}
              onPress={() => log(item)}
              onLongPress={onEnterEdit}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.logFoodA11y', { name: item.name, portion })}
              className="flex-row items-center gap-2 border-t border-border py-2 active:opacity-70"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-subtle" numberOfLines={1}>
                  {portion}
                </Text>
              </View>
              <View
                className={cn(
                  'h-7 w-7 items-center justify-center rounded-full',
                  done ? 'bg-success' : 'bg-primary/15',
                )}
              >
                <Icon
                  icon={done ? Check : Plus}
                  size={15}
                  color={done ? colors.background : colors['primary-text']}
                />
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------------------------

/** The next planned workout, with its first exercise moving. */
function NextWorkoutRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const schedule = useWorkoutStore((s) => s.schedule);
  const workouts = useWorkoutStore((s) => s.workouts);
  const sessions = useSessionStore((s) => s.sessions);
  const today = useToday();
  const next = useMemo(
    () => nextWorkout(schedule, workouts, sessions, fromDayKey(today)),
    [schedule, workouts, sessions, today],
  );
  const first = next?.workout.exercises.find((e) => e.type === 'exercise');
  const resolved = first ? resolveExercise(first.exerciseId, first.name) : null;
  const when = !next
    ? ''
    : next.inDays === 0
      ? t('dashboard.today')
      : next.inDays === 1
        ? t('dashboard.tomorrow')
        : weekdayLabel(next.weekday, i18n.language, 'long');
  return (
    <Frame title={t('dashboard.nextWorkout')} icon={Dumbbell}>
      {!next ? (
        <Empty text={t('dashboard.noNextWorkout')} />
      ) : (
        <View className="flex-1 flex-row gap-3">
          <View className="min-w-0 flex-1 justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">{when}</Text>
              <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                {next.workout.name}
              </Text>
              <Text className="text-xs text-muted">
                {t('workouts.durationMinutes', { duration: next.workout.duration })}
              </Text>
            </View>
            {first && (
              <Text className="text-xs text-subtle" numberOfLines={2}>
                {t('dashboard.firstExercise', { name: first.name })}
              </Text>
            )}
          </View>
          {size === 'full' && resolved && resolved.frames.length > 0 && (
            <ExerciseAnimation
              frames={resolved.frames}
              style={{ width: 110, height: 110, borderRadius: 14 }}
              accessibilityLabel={first!.name}
            />
          )}
        </View>
      )}
    </Frame>
  );
}

/** Sets per muscle group this week, with last week beside it. */
function WeeklyVolumeRender({ size }: WidgetRenderProps) {
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const today = useToday();
  const volume = useMemo(() => weeklyVolume(sessions, fromDayKey(today)), [sessions, today]);
  const rows = GROUP_ORDER.filter((g) => volume[g].now > 0 || volume[g].last > 0).slice(
    0,
    size === 'full' ? 6 : 4,
  );
  const max = Math.max(1, ...rows.map((g) => Math.max(volume[g].now, volume[g].last)));
  return (
    <Frame title={t('dashboard.weeklyVolume')}>
      {rows.length === 0 ? (
        <Empty text={t('dashboard.noVolume')} />
      ) : (
        <View className="flex-1 justify-center gap-1.5">
          {rows.map((g) => (
            <View
              key={g}
              accessible
              accessibilityLabel={`${t(`exercises.groups.${g}` as TranslationKey)}: ${t('dashboard.setsVsLast', { now: volume[g].now, last: volume[g].last })}`}
            >
              <View className="flex-row justify-between">
                <Text className="text-xs font-medium text-foreground">
                  {t(`exercises.groups.${g}` as TranslationKey)}
                </Text>
                <Text className="text-xs text-subtle">
                  {volume[g].now}
                  <Text className="text-subtle/70"> · {volume[g].last}</Text>
                </Text>
              </View>
              <View className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <View
                  className="absolute h-full rounded-full bg-border-strong"
                  style={{ width: `${(volume[g].last / max) * 100}%` }}
                />
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(volume[g].now / max) * 100}%` }}
                />
              </View>
            </View>
          ))}
          <Text className="mt-1 text-[10px] text-subtle">{t('dashboard.volumeLegend')}</Text>
        </View>
      )}
    </Frame>
  );
}

/** Sessions done against the plan this week, and the run of weeks with training. */
function ConsistencyRender() {
  const { t } = useTranslation();
  const schedule = useWorkoutStore((s) => s.schedule);
  const sessions = useSessionStore((s) => s.sessions);
  const today = useToday();
  const days = useMemo(() => weekStatus(schedule, sessions, fromDayKey(today)), [schedule, sessions, today]);
  const streak = useMemo(() => trainingStreak(sessions, fromDayKey(today)), [sessions, today]);
  const planned = days.reduce((n, d) => n + d.planned, 0);
  const done = days.reduce((n, d) => n + d.done, 0);
  return (
    <Frame title={t('dashboard.consistency')} icon={Flame}>
      <View className="flex-1 justify-center">
        <Text className="text-4xl font-bold tracking-tighter text-foreground">{streak}</Text>
        <Text className="text-xs font-medium text-muted">
          {t('dashboard.streakWeeks', { count: streak })}
        </Text>
      </View>
      <Text className="text-xs text-subtle">{t('dashboard.plannedDone', { done, planned })}</Text>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------------------------

/** One button for everything: weight, measurements, a meal or a workout. */
function LogAnythingRender({ onPressIn, onPressOut }: WidgetRenderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<'weight' | 'measurements' | null>(null);
  const addWeight = useWeightStore((s) => s.addEntry);
  const addMeasurements = useBodyStore((s) => s.addMeasurements);
  const measurements = useBodyStore((s) => s.measurements);
  const { currentWeight, toKg, units } = useUnitConverter();
  const { workouts } = useTodaysWorkouts();

  const options: { key: string; label: string; icon: typeof Scale; run: () => void }[] = [
    { key: 'weight', label: t('bodyWeight.logWeight'), icon: Scale, run: () => setSheet('weight') },
    {
      key: 'measurements',
      label: t('body.logMeasurements'),
      icon: Ruler,
      run: () => setSheet('measurements'),
    },
    {
      key: 'meal',
      label: t('dashboard.logMeal'),
      icon: Utensils,
      run: () => router.push('/nutrition/search'),
    },
    {
      key: 'workout',
      label: t('dashboard.startWorkout'),
      icon: Dumbbell,
      run: () =>
        router.push({
          pathname: '/workouts/session',
          params: workouts[0] ? { workoutId: workouts[0].id } : {},
        }),
    },
  ];

  return (
    <>
      <ActionButton
        label={t('dashboard.logAnything')}
        onPress={() => setOpen(true)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setOpen(false)}
          accessibilityLabel={t('common.close')}
        >
          <Pressable
            className="rounded-t-3xl border border-border bg-surface px-4 pt-3"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {t('dashboard.logWhat')}
              </Text>
              <IconButton
                icon={X}
                variant="ghost"
                accessibilityLabel={t('common.close')}
                onPress={() => setOpen(false)}
              />
            </View>
            {options.map((o) => (
              <Pressable
                key={o.key}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                onPress={() => {
                  setOpen(false);
                  o.run();
                }}
                className="mb-2 h-14 flex-row items-center gap-3 rounded-2xl bg-surface-elevated px-4 active:opacity-70"
              >
                <Icon icon={o.icon} size={20} color={colors['primary-text']} />
                <Text className="flex-1 text-base font-semibold text-foreground">{o.label}</Text>
                <Icon icon={ChevronRight} size={18} color={colors.subtle} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <AddWeightModal
        visible={sheet === 'weight'}
        onClose={() => setSheet(null)}
        unit={units.weight}
        initialWeight={currentWeight.formatted === '--' ? null : Number(currentWeight.formatted)}
        onSave={(w, day) => {
          addWeight(toKg(w), day);
          successFeedback();
        }}
      />
      <LogMeasurementsSheet
        visible={sheet === 'measurements'}
        previous={carryForward(measurements)}
        onClose={() => setSheet(null)}
        onSave={(values) => {
          addMeasurements(values);
          successFeedback();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------------------------

export const bodyAndWeightWidget: WidgetDefinition = {
  id: 'bodyAndWeight',
  kind: 'card',
  category: 'health',
  sizes: ['full', 'half'],
  defaultSize: 'full',
  unique: true,
  titleKey: 'dashboard.bodyAndWeight',
  detailPath: '/body',
  gestureMode: 'inner',
  Render: BodyAndWeightRender,
};

export const weightTrendWidget: WidgetDefinition = {
  id: 'weightTrend',
  kind: 'card',
  category: 'health',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.weightTrend',
  detailPath: '/body-weight',
  gestureMode: 'wrapper',
  Render: WeightTrendRender,
};

export const measurementsWidget: WidgetDefinition = {
  id: 'measurements',
  kind: 'card',
  category: 'health',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.measurementsWidget',
  detailPath: '/body',
  gestureMode: 'inner',
  Render: MeasurementsRender,
};

export const caloriesWeekWidget: WidgetDefinition = {
  id: 'caloriesWeek',
  kind: 'card',
  category: 'nutrition',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.caloriesWeek',
  detailPath: '/nutrition/detail',
  gestureMode: 'wrapper',
  Render: CaloriesWeekRender,
};

export const proteinTodayWidget: WidgetDefinition = {
  id: 'proteinToday',
  kind: 'card',
  category: 'nutrition',
  sizes: ['half', 'compact'],
  defaultSize: 'compact',
  unique: true,
  titleKey: 'dashboard.proteinToday',
  detailPath: '/nutrition/detail',
  gestureMode: 'wrapper',
  Render: ProteinTodayRender,
};

export const frequentFoodsWidget: WidgetDefinition = {
  id: 'frequentFoods',
  kind: 'card',
  category: 'nutrition',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.frequentFoods',
  detailPath: '/nutrition/detail',
  gestureMode: 'inner',
  Render: FrequentFoodsRender,
};

export const nextWorkoutWidget: WidgetDefinition = {
  id: 'nextWorkout',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.nextWorkout',
  detailPath: '/workouts/today',
  gestureMode: 'wrapper',
  Render: NextWorkoutRender,
};

export const weeklyVolumeWidget: WidgetDefinition = {
  id: 'weeklyVolume',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.weeklyVolume',
  detailPath: '/workouts/today',
  gestureMode: 'wrapper',
  Render: WeeklyVolumeRender,
};

export const consistencyWidget: WidgetDefinition = {
  id: 'consistency',
  kind: 'card',
  category: 'training',
  sizes: ['half', 'compact'],
  defaultSize: 'compact',
  unique: true,
  titleKey: 'dashboard.consistency',
  detailPath: '/workouts/today',
  gestureMode: 'wrapper',
  Render: ConsistencyRender,
};

export const logAnythingAction: WidgetDefinition = {
  id: 'logAnything',
  kind: 'action',
  category: 'general',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'full',
  unique: true,
  titleKey: 'dashboard.logAnything',
  gestureMode: 'inner',
  Render: LogAnythingRender,
};
