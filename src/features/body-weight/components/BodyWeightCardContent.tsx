import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useWeightTrend } from '@/features/body-weight/hooks/useWeightTrend';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { useWeightStore } from '@/features/body-weight/weightStore';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';
import { TrendBadge } from '@/features/body-weight/components/TrendBadge';

interface BodyWeightCardContentProps {
  size?: WidgetSize;
  /** Explicit cell box from the grid or expand preview. Parent always owns width/height. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Closed-card body for Body Weight. Fills the parent's box with flex:1 so percentage heights
 * never leak to the ScrollView.
 */
export function BodyWeightCardContent({ size = 'full', style }: BodyWeightCardContentProps) {
  const { t } = useTranslation();
  const { currentWeight } = useUnitConverter();
  const trend = useWeightTrend();
  const isHydrated = useHasHydrated(useWeightStore);
  const isCompact = size === 'compact';

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface" style={style}>
      <Card className="h-full w-full flex-1 bg-transparent" title={t('dashboard.bodyWeight')}>
        {!isHydrated ? null : (
          <View className={isCompact ? 'flex-1 justify-center' : 'mt-1'}>
            <View className="flex-row items-baseline">
              <Text
                className={`font-bold text-foreground ${isCompact ? 'text-2xl' : size === 'half' ? 'text-4xl' : 'text-5xl'}`}
                numberOfLines={1}
              >
                {currentWeight.formatted}
              </Text>
              <Text className={`ml-1 text-subtle ${isCompact ? 'text-sm' : 'text-xl'}`}>
                {currentWeight.unit}
              </Text>
            </View>
            <View className={isCompact ? 'mt-1' : 'mt-3'}>
              <TrendBadge trend={trend} compact={isCompact} />
            </View>
          </View>
        )}
      </Card>
    </View>
  );
}
