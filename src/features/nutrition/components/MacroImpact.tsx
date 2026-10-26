import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { Macros } from '@/features/nutrition/utils/nutrition';
import { formatNumber } from '@/shared/utils/number';
import { MacroBar } from '@/features/nutrition/components/MacroBar';

interface MacroImpactProps {
  portion: Macros;
  today: Macros;
  targets: Macros;
}

/** What this portion adds, and where it leaves today's targets. */
export function MacroImpact({ portion, today, targets }: MacroImpactProps) {
  const { t, i18n } = useTranslation();
  const after = today.kcal + portion.kcal;
  const left = targets.kcal - after;
  const pct = targets.kcal > 0 ? Math.min(after / targets.kcal, 1) : 0;
  const todayPct = targets.kcal > 0 ? Math.min(today.kcal / targets.kcal, 1) : 0;
  const f = (n: number) => formatNumber(n, i18n.language, 0);

  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      <View className="flex-row items-end justify-between">
        <View accessible accessibilityLabel={t('common.kcalValue', { value: f(portion.kcal) })}>
          <Text className="text-4xl font-black text-foreground">{f(portion.kcal)}</Text>
          <Text className="text-xs font-bold uppercase text-subtle">{t('common.kcal')}</Text>
        </View>
        <Text
          className={cn('text-sm font-semibold', left < 0 ? 'text-warning-text' : 'text-muted')}
          accessibilityLiveRegion="polite"
        >
          {left >= 0
            ? t('food.kcalLeftAfter', { value: f(left) })
            : t('food.kcalOverAfter', { value: f(-left) })}
        </Text>
      </View>

      <View
        className="mb-4 mt-3 h-2 flex-row overflow-hidden rounded-full bg-surface-elevated"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View className="bg-primary" style={{ width: `${todayPct * 100}%` }} />
        <View
          className={left < 0 ? 'bg-warning' : 'bg-primary/40'}
          style={{ width: `${Math.max(pct - todayPct, 0) * 100}%` }}
        />
      </View>

      <View className="flex-row gap-2">
        <MacroBar macro="protein" value={today.protein} pending={portion.protein} target={targets.protein} />
        <MacroBar macro="carbs" value={today.carbs} pending={portion.carbs} target={targets.carbs} />
        <MacroBar macro="fat" value={today.fat} pending={portion.fat} target={targets.fat} />
      </View>
    </View>
  );
}
