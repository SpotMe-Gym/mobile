import { Text, View } from 'react-native';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/utils/number';
import type { WeightTrend } from '@/hooks/useWeightTrend';
import { Icon } from '../ui/Icon';

/** Colour follows the user's goal: gaining is good when building muscle, bad when cutting. */
export function TrendBadge({
  trend,
  compact = false,
  pill = false,
}: {
  trend: WeightTrend;
  compact?: boolean;
  pill?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const size = compact ? 12 : 16;

  if (!trend.hasTrend) {
    return (
      <View className="flex-row items-center">
        <Icon icon={Minus} size={size} color={colors.subtle} />
        {!compact && <Text className="ml-1 text-sm font-medium text-subtle">{t('dashboard.noChange')}</Text>}
      </View>
    );
  }

  const color =
    trend.favourable === null
      ? colors.muted
      : trend.favourable
        ? colors['success-text']
        : colors['danger-text'];
  const value = `${trend.diff > 0 ? '+' : '−'}${formatNumber(Math.abs(trend.diff), i18n.language, 1)}`;
  const direction = trend.diff > 0 ? t('bodyWeight.up') : t('bodyWeight.down');

  return (
    <View
      accessible
      accessibilityLabel={t('bodyWeight.trendA11y', {
        direction,
        value: formatNumber(Math.abs(trend.diff), i18n.language, 1),
        unit: trend.unit,
      })}
      className={cn('flex-row items-center', pill && 'rounded-full bg-surface-elevated px-3 py-1')}
    >
      <Icon icon={trend.diff > 0 ? TrendingUp : TrendingDown} size={size} color={color} />
      <Text className={cn('ml-1 font-semibold', compact ? 'text-xs' : 'text-sm')} style={{ color }}>
        {value}
        {compact ? '' : ` ${trend.unit} ${t('dashboard.sinceLast')}`}
      </Text>
    </View>
  );
}
