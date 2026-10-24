import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { lightImpact } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import type { FoodRef, PortionUnit } from '@/store/nutritionStore';
import { formatNumber, parseDecimal, sanitizeDecimalInput, sanitizeIntegerInput } from '@/utils/number';
import { DECIMALS, QUICK_AMOUNTS, STEP, portionToBase } from '@/utils/portion';
import { IconButton } from '../ui/IconButton';
import { SegmentedControl } from '../ui/SegmentedControl';

interface PortionEditorProps {
  food: FoodRef;
  units: PortionUnit[];
  unit: PortionUnit;
  quantity: number | null;
  onChangeUnit: (unit: PortionUnit) => void;
  onChangeQuantity: (quantity: number | null) => void;
}

/** Unit tabs → big quantity with −/+ → quick-pick chips → "= 30 g" conversion line. */
export function PortionEditor({
  food,
  units,
  unit,
  quantity,
  onChangeUnit,
  onChangeQuantity,
}: PortionEditorProps) {
  const { t, i18n } = useTranslation();
  const decimals = DECIMALS[unit];
  const fmt = (n: number) => formatNumber(n, i18n.language, decimals);
  const [text, setText] = useState(quantity === null ? '' : fmt(quantity));
  const [synced, setSynced] = useState({ quantity, unit });

  // External changes (chips, steppers, unit switches) replace the text; typing doesn't.
  if (synced.quantity !== quantity || synced.unit !== unit) {
    setSynced({ quantity, unit });
    if (parseDecimal(text) !== quantity || synced.unit !== unit) setText(quantity === null ? '' : fmt(quantity));
  }

  const handleText = (next: string) => {
    const clean = decimals > 0 ? sanitizeDecimalInput(next, decimals) : sanitizeIntegerInput(next);
    if (clean === null) return;
    setText(clean);
    onChangeQuantity(parseDecimal(clean));
  };

  const step = (dir: 1 | -1) => {
    lightImpact();
    const next = Math.max(0, Math.round(((quantity ?? 0) + dir * STEP[unit]) * 100) / 100);
    onChangeQuantity(next);
  };

  const unitLabel = (u: PortionUnit, count: number) =>
    u === 'serving' ? t('food.units.serving', { count }) : t(`food.units.${u}`);

  const base = quantity !== null ? portionToBase(quantity, unit, food) : null;
  const showConversion = base !== null && unit !== food.base;

  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      {units.length > 1 && (
        <SegmentedControl
          className="mb-4"
          value={unit}
          onChange={onChangeUnit}
          segments={units.map((u) => ({
            value: u,
            label:
              u === 'serving' && food.servingSize
                ? t('food.servingWithSize', {
                    size: fmt(food.servingSize),
                    unit: t(`food.units.${food.base}`),
                  })
                : unitLabel(u, 2),
          }))}
        />
      )}

      <View className="flex-row items-center justify-between gap-3">
        <IconButton
          icon={Minus}
          accessibilityLabel={t('common.decrease')}
          onPress={() => step(-1)}
          disabled={!quantity}
        />
        <View className="flex-1 items-center">
          <View className="flex-row items-baseline justify-center">
            <TextInput
              value={text}
              onChangeText={handleText}
              keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
              selectTextOnFocus
              accessibilityLabel={t('food.quantity')}
              accessibilityHint={unitLabel(unit, quantity ?? 0)}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              className="min-w-16 p-0 text-center text-5xl font-black text-foreground"
            />
            <Text className="ml-2 text-lg font-bold text-subtle">{unitLabel(unit, quantity ?? 0)}</Text>
          </View>
          {showConversion && (
            <Text className="mt-1 text-sm text-subtle">
              = {formatNumber(base, i18n.language, 0)} {t(`food.units.${food.base}`)}
            </Text>
          )}
        </View>
        <IconButton icon={Plus} accessibilityLabel={t('common.increase')} onPress={() => step(1)} />
      </View>

      <View className="mt-4 flex-row flex-wrap justify-center gap-2">
        {QUICK_AMOUNTS[unit].map((amount) => {
          const active = quantity === amount;
          return (
            <Pressable
              key={amount}
              onPress={() => {
                lightImpact();
                onChangeQuantity(amount);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${fmt(amount)} ${unitLabel(unit, amount)}`}
              className={cn(
                'min-h-11 min-w-14 items-center justify-center rounded-full border px-4',
                active
                  ? 'border-primary bg-primary'
                  : 'border-border bg-surface-sunken active:bg-surface-elevated',
              )}
            >
              <Text className={cn('font-bold', active ? 'text-primary-foreground' : 'text-muted')}>
                {unit === 'serving' ? fmtFraction(amount, fmt) : fmt(amount)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** ½ and 1½ read faster than 0.5 / 1.5 on a chip. */
function fmtFraction(n: number, fmt: (n: number) => string): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (Math.abs(frac - 0.5) < 1e-9) return whole === 0 ? '½' : `${whole}½`;
  return fmt(n);
}
