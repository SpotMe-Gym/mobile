import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { successFeedback } from '@/shared/lib/haptics';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { AddWeightModal } from '@/features/body-weight/components/AddWeightModal';
import { formatNumber } from '@/shared/utils/number';

const SPARK_POINTS = 14;

/** The last entries as a tiny line, scaled to its own range. */
function Sparkline({
  values,
  width,
  height,
  color,
}: {
  values: number[];
  width: number;
  height: number;
  color: string;
}) {
  if (values.length < 2 || width <= 0) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = 3 + (1 - (v - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no">
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Right half of the body card: current weight, change since the last entry, a short trend
 * line, height, and a button to log a new weight without leaving the body screen.
 */
export function WeightPanel({ heightLabel }: { heightLabel: string }) {
  const { t, i18n } = useTranslation();
  const entries = useWeightStore((s) => s.entries);
  const addEntry = useWeightStore((s) => s.addEntry);
  const { currentWeight, convertWeight, toKg, units } = useUnitConverter();
  const trend = useWeightTrend();
  const [width, setWidth] = useState(0);
  const [adding, setAdding] = useState(false);

  const spark = useMemo(
    () => entries.slice(-SPARK_POINTS).map((e) => convertWeight(e.kg).value),
    [entries, convertWeight],
  );
  const trendColor =
    trend.favourable === null
      ? colors.muted
      : trend.favourable
        ? colors['success-text']
        : colors['danger-text'];

  return (
    <View className="flex-1 justify-between p-3" onLayout={(e) => setWidth(e.nativeEvent.layout.width - 24)}>
      <View>
        <Text className="text-xs font-medium uppercase tracking-wider text-subtle">
          {t('bodyWeight.weight')}
        </Text>
        <Text
          className="mt-1 text-4xl font-bold tracking-tighter text-foreground"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {currentWeight.formatted}
          <Text className="text-base font-normal text-subtle"> {currentWeight.unit}</Text>
        </Text>
        {trend.hasTrend ? (
          <View
            className="mt-1 flex-row items-center gap-1"
            accessible
            accessibilityLabel={t('bodyWeight.trendA11y', {
              direction: trend.diff > 0 ? t('bodyWeight.up') : t('bodyWeight.down'),
              value: formatNumber(Math.abs(trend.diff), i18n.language, 1),
              unit: trend.unit,
            })}
          >
            <Icon icon={trend.diff > 0 ? TrendingUp : TrendingDown} size={14} color={trendColor} />
            <Text className="text-xs font-semibold" style={{ color: trendColor }}>
              {trend.diff > 0 ? '+' : '−'}
              {formatNumber(Math.abs(trend.diff), i18n.language, 1)} {trend.unit}
            </Text>
          </View>
        ) : (
          <Text className="mt-1 text-xs text-subtle">{t('dashboard.noChange')}</Text>
        )}
      </View>

      <View className="my-2">
        <Sparkline values={spark} width={width} height={44} color={colors.accent} />
      </View>

      <View>
        <Text className="mb-2 text-xs text-muted">{heightLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bodyWeight.logWeight')}
          onPress={() => setAdding(true)}
          className={cn(
            'h-10 flex-row items-center justify-center gap-1.5 rounded-xl bg-surface-elevated active:opacity-70',
          )}
        >
          <Icon icon={Plus} size={16} />
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {t('bodyWeight.logWeight')}
          </Text>
        </Pressable>
      </View>

      <AddWeightModal
        visible={adding}
        onClose={() => setAdding(false)}
        unit={units.weight}
        initialWeight={currentWeight.formatted === '--' ? null : Number(currentWeight.formatted)}
        onSave={(w, day) => {
          addEntry(toKg(w), day);
          successFeedback();
        }}
      />
    </View>
  );
}
