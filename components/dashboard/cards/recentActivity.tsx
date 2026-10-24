import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Scale, Utensils, Activity } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useNutritionStore, type LogEntry } from '../../../store/nutritionStore';
import { useWeightStore } from '../../../store/weightStore';
import { useUnitConverter } from '../../../hooks/useUnitConverter';
import { colors } from '../../../theme/colors';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

interface ActivityItem {
  id: string;
  kind: 'food' | 'weight';
  title: string;
  detail: string;
  at: string;
}

const relativeFormatter = (locale: string) => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

function relativeDay(iso: string, locale: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(then) - startOf(now)) / 86_400_000);
  return relativeFormatter(locale).format(days, 'day');
}

/** Latest logged foods and weigh-ins — real data, newest first. */
function RecentActivityRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const days = useNutritionStore((s) => s.days);
  const weights = useWeightStore((s) => s.entries);
  const { convertWeight } = useUnitConverter();
  const count = size === 'compact' ? 1 : size === 'half' ? 2 : 3;

  const items = useMemo(() => {
    const foods: ActivityItem[] = Object.values(days)
      .flat()
      .map((e: LogEntry) => ({
        id: e.id,
        kind: 'food' as const,
        title: e.name,
        detail: t('common.kcalValue', { value: Math.round(e.macros.kcal) }),
        at: e.loggedAt,
      }));
    const weighIns: ActivityItem[] = weights.map((w) => {
      const dw = convertWeight(w.kg);
      return {
        id: w.id,
        kind: 'weight' as const,
        title: t('dashboard.bodyWeight'),
        detail: `${dw.formatted} ${dw.unit}`,
        at: w.createdAt,
      };
    });
    return [...foods, ...weighIns].sort((a, b) => b.at.localeCompare(a.at)).slice(0, count);
  }, [days, weights, count, t, convertWeight]);

  return (
    <View className="flex-1 overflow-hidden rounded-2xl">
      <Card className="h-full w-full flex-1" title={t('dashboard.recentActivity')}>
        {items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Icon icon={Activity} size={24} color={colors.subtle} />
            <Text className="mt-2 text-center text-sm text-subtle">{t('dashboard.noActivityYet')}</Text>
          </View>
        ) : (
          items.map((item, i) => (
            <View
              key={item.id}
              className={`flex-row items-center justify-between py-3 ${i < items.length - 1 ? 'border-b border-border' : ''}`}
            >
              <View className="flex-1 flex-row items-center pr-2">
                <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-surface-elevated">
                  <Icon icon={item.kind === 'food' ? Utensils : Scale} size={14} color={colors.muted} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-foreground" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-subtle">{relativeDay(item.at, i18n.language)}</Text>
                </View>
              </View>
              {size !== 'compact' && <Text className="text-sm text-muted">{item.detail}</Text>}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

export const recentActivityWidget: WidgetDefinition = {
  id: 'recentActivity',
  kind: 'card',
  category: 'general',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'full',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.recentActivity',
  gestureMode: 'wrapper',
  Render: RecentActivityRender,
};
