import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PersonStanding } from 'lucide-react-native';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { useBodyStore, carryForward } from '@/features/body/bodyStore';
import { useLengthUnit } from '@/features/body/hooks/useLengthUnit';
import { cn } from '@/shared/lib/cn';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';

interface BodyCardContentProps {
  size?: WidgetSize;
  style?: StyleProp<ViewStyle>;
}

/** Home card: latest waist + change since the previous session, or an invitation to measure. */
export function BodyCardContent({ size = 'half', style }: BodyCardContentProps) {
  const { t } = useTranslation();
  const entries = useBodyStore((s) => s.measurements);
  const hydrated = useHasHydrated(useBodyStore);
  const { unit, format } = useLengthUnit();
  const compact = size === 'compact';

  const now = carryForward(entries);
  const before = carryForward(entries.slice(0, -1));
  const waist = now.waist;
  const change = waist !== undefined && before.waist !== undefined ? waist - before.waist : undefined;

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface" style={style}>
      <Card
        className="h-full w-full flex-1 bg-transparent"
        title={t('dashboard.body')}
        headerRight={<Icon icon={PersonStanding} size={20} color={colors.subtle} />}
      >
        {!hydrated ? null : entries.length === 0 || waist === undefined ? (
          <Text className={cn('text-subtle', compact ? 'text-xs' : 'text-sm')} numberOfLines={3}>
            {t('body.cardEmpty')}
          </Text>
        ) : (
          <View className={compact ? 'flex-1 justify-center' : 'mt-1'}>
            {!compact && <Text className="text-sm text-muted">{t('body.cardWaist')}</Text>}
            <View className="flex-row items-baseline">
              <Text className={cn('font-bold text-foreground', compact ? 'text-2xl' : 'text-4xl')} numberOfLines={1}>
                {format(waist)}
              </Text>
              <Text className="ml-1 text-subtle">{unit}</Text>
            </View>
            {change !== undefined && Math.abs(change) >= 0.1 && (
              <Text className="mt-1 text-sm text-muted">
                {format(change, true)} {unit}
              </Text>
            )}
            {size === 'full' && (
              <Text className="mt-1 text-xs text-subtle">
                {t('body.valuesCount', { count: Object.keys(now).length })}
              </Text>
            )}
          </View>
        )}
      </Card>
    </View>
  );
}
