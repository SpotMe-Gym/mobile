import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { TrendBadge } from '@/features/body-weight/components/TrendBadge';
import { WeightChart } from '@/features/body-weight/components/WeightChart';
import { weightWindow } from '@/features/dashboard/widgets/insights';
import { formatDayKey } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/number';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface-elevated px-3 py-2.5">
      <Text className="text-[11px] font-medium uppercase tracking-wider text-subtle" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-0.5 text-base font-bold text-foreground" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** First slide of the body screen: the weight, its changes and the last entries as bars. */
export function WeightPage({ height, heightLabel }: { height: number; heightLabel: string }) {
  const { t, i18n } = useTranslation();
  const entries = useWeightStore((s) => s.entries);
  const { currentWeight, convertWeight, units } = useUnitConverter();
  const trend = useWeightTrend();
  const chartData = useMemo(
    () => entries.map((e) => ({ id: e.id, day: e.day, weight: convertWeight(e.kg).value })),
    [entries, convertWeight],
  );
  const { changeKg } = useMemo(() => weightWindow(entries, 30), [entries]);
  const last = entries[entries.length - 1];
  const change30 =
    changeKg === null
      ? '--'
      : `${changeKg > 0 ? '+' : changeKg < 0 ? '−' : '±'}${formatNumber(convertWeight(Math.abs(changeKg)).value, i18n.language, 1)} ${units.weight}`;
  // Header ≈ 110, stats ≈ 70, paddings ≈ 56: the chart takes what's left.
  const chartHeight = Math.max(140, height - 236);

  return (
    <View className="flex-1 p-5" style={{ height }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
            {t('bodyWeight.weight')}
          </Text>
          <Text
            className="mt-1 text-6xl font-black tracking-tighter text-foreground"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentWeight.formatted}
            <Text className="text-xl font-medium text-subtle"> {currentWeight.unit}</Text>
          </Text>
          <View className="mt-1 self-start">
            <TrendBadge trend={trend} pill />
          </View>
        </View>
        <Text className="pt-1 text-xs text-muted">{heightLabel}</Text>
      </View>

      <View className="mt-4 flex-row gap-2">
        <Stat label={t('body.change30')} value={change30} />
        <Stat label={t('body.entries')} value={String(entries.length)} />
        <Stat
          label={t('body.lastWeighIn')}
          value={last ? formatDayKey(last.day, i18n.language, { day: 'numeric', month: 'short' }) : '--'}
        />
      </View>

      <View className="mt-auto">
        <WeightChart data={chartData} unit={units.weight} height={chartHeight} bare />
      </View>
    </View>
  );
}
