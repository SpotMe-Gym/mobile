import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';

export type MacroKey = 'protein' | 'carbs' | 'fat';

interface MacroBarProps {
  macro: MacroKey;
  value: number;
  target: number;
  /** Optional preview of an addition (e.g. the food being logged), drawn lighter. */
  pending?: number;
}

/** One macro's progress toward its daily target. */
export function MacroBar({ macro, value, target, pending = 0 }: MacroBarProps) {
  const { t, i18n } = useTranslation();
  const color = colors[macro];
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const pendingPct = target > 0 ? Math.min((value + pending) / target, 1) - pct : 0;
  const label = t(`food.${macro}`);

  return (
    <View
      className="flex-1 items-center rounded-xl border border-border bg-surface-sunken p-2"
      accessible
      accessibilityLabel={t('food.macroA11y', {
        macro: label,
        value: formatNumber(value + pending, i18n.language, 0),
        target: formatNumber(target, i18n.language, 0),
      })}
    >
      <Text className="text-lg font-bold" style={{ color }}>
        {formatNumber(value + pending, i18n.language, 0)}
        <Text className="text-sm font-medium text-subtle">/{formatNumber(target, i18n.language, 0)}g</Text>
      </Text>
      <Text className="text-xs font-medium uppercase text-subtle">{label}</Text>
      <View className="mt-1.5 h-1.5 w-full flex-row overflow-hidden rounded-full bg-surface-elevated">
        <View style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        {pendingPct > 0 && (
          <View style={{ width: `${pendingPct * 100}%`, backgroundColor: color, opacity: 0.4 }} />
        )}
      </View>
    </View>
  );
}
