import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';
import { fromDayKey, type DayKey } from '@/shared/utils/date';

interface WeightPoint {
  id: string;
  day: DayKey;
  /** In the display unit. */
  weight: number;
}

interface WeightChartProps {
  data: WeightPoint[];
  unit: string;
  height?: number;
}

/** Last 7 entries as bars, scaled to their own range so small changes stay visible. */
export function WeightChart({ data, unit, height = 200 }: WeightChartProps) {
  const { t, i18n } = useTranslation();

  const points = useMemo(() => {
    const recent = data.slice(-7);
    const weights = recent.map((d) => d.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const buffer = range * 0.2;
    return recent.map((d) => ({
      ...d,
      normalized: (d.weight - (min - buffer)) / (range + buffer * 2),
      label: fromDayKey(d.day).toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric' }),
      value: formatNumber(d.weight, i18n.language, 1),
    }));
  }, [data, i18n.language]);

  if (points.length < 2) {
    return (
      <View
        style={{ height }}
        className="items-center justify-center rounded-3xl border border-border bg-surface px-6"
      >
        <Text className="text-center text-subtle">{t('bodyWeight.addMoreEntries')}</Text>
      </View>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  return (
    <View
      accessible
      accessibilityLabel={t('bodyWeight.chartA11y', {
        count: points.length,
        from: first?.value ?? '',
        to: last?.value ?? '',
        unit,
      })}
      style={{ height }}
      className="flex-row items-end justify-between rounded-3xl border border-border bg-surface p-4 pt-8"
    >
      {points.map((d, i) => (
        <View key={d.id} className="items-center" style={{ width: `${100 / points.length}%` }}>
          <Text className="mb-1 text-xs font-medium text-foreground" numberOfLines={1}>
            {d.value}
          </Text>
          <View
            style={{
              height: Math.max(d.normalized * (height - 84), 4),
              width: 8,
              borderRadius: 4,
              backgroundColor: i === points.length - 1 ? colors.accent : colors['border-strong'],
            }}
          />
          <Text className="mt-2 text-xs text-subtle">{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
