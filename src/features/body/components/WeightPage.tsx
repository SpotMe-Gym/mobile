import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { TrendBadge } from '@/features/body-weight/components/TrendBadge';
import { WeightChart } from '@/features/body-weight/components/WeightChart';

/** First page of the body screen's top slider: current weight, change and the last entries. */
export function WeightPage({ height, heightLabel }: { height: number; heightLabel: string }) {
  const { t } = useTranslation();
  const entries = useWeightStore((s) => s.entries);
  const { currentWeight, convertWeight, units } = useUnitConverter();
  const trend = useWeightTrend();
  const chartData = useMemo(
    () => entries.map((e) => ({ id: e.id, day: e.day, weight: convertWeight(e.kg).value })),
    [entries, convertWeight],
  );
  const chartHeight = Math.max(110, height - 150);

  return (
    <View className="flex-1 justify-between p-5" style={{ height }}>
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-xs font-semibold uppercase tracking-wider text-primary-text">
            {t('bodyWeight.weight')}
          </Text>
          <Text className="mt-1 text-5xl font-black tracking-tighter text-foreground" numberOfLines={1}>
            {currentWeight.formatted}
            <Text className="text-xl font-medium text-subtle"> {currentWeight.unit}</Text>
          </Text>
        </View>
        <View className="items-end gap-2 pt-1">
          <TrendBadge trend={trend} pill />
          <Text className="text-xs text-muted">{heightLabel}</Text>
        </View>
      </View>
      <WeightChart data={chartData} unit={units.weight} height={chartHeight} bare />
    </View>
  );
}
