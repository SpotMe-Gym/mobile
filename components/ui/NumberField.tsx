import { forwardRef, useState, type ComponentRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { formatNumber, parseDecimal, sanitizeDecimalInput, sanitizeIntegerInput } from '@/utils/number';
import { Icon } from './Icon';

interface NumberFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  label?: string;
  value: number | null;
  onChangeValue: (value: number | null) => void;
  /** 0 = integer field. */
  decimals?: number;
  unit?: string;
  icon?: LucideIcon;
  error?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Locale-safe numeric input: accepts "72,5" and "72.5", keeps the user's raw text while
 * typing (so the cursor never jumps) and reports a parsed number (or null) upward.
 */
export const NumberField = forwardRef<ComponentRef<typeof TextInput>, NumberFieldProps>(function NumberField(
  { label, value, onChangeValue, decimals = 0, unit, icon, error, className, inputClassName, ...props },
  ref,
) {
  const { i18n } = useTranslation();
  const format = (v: number | null) =>
    v === null ? '' : formatNumber(v, i18n.language, decimals).replace(/\s/g, '');
  const [text, setText] = useState(() => format(value));
  const [synced, setSynced] = useState(value);

  // Sync external changes (steppers, resets) without clobbering what is being typed.
  if (synced !== value) {
    setSynced(value);
    if (parseDecimal(text) !== value) setText(format(value));
  }

  const handleChange = (next: string) => {
    const clean = decimals > 0 ? sanitizeDecimalInput(next, decimals) : sanitizeIntegerInput(next);
    if (clean === null) return;
    setText(clean);
    onChangeValue(parseDecimal(clean));
  };

  return (
    <View className={className}>
      {label && <Text className="mb-2 ml-1 font-medium text-muted">{label}</Text>}
      <View
        className={cn(
          'h-14 flex-row items-center rounded-xl border bg-surface px-4',
          error ? 'border-danger' : 'border-border',
        )}
      >
        {icon && <Icon icon={icon} size={20} color={colors.muted} className="mr-3" />}
        <TextInput
          ref={ref}
          value={text}
          onChangeText={handleChange}
          keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={error}
          className={cn('h-full flex-1 text-lg text-foreground', inputClassName)}
          {...props}
        />
        {unit && <Text className="ml-2 text-base text-subtle">{unit}</Text>}
      </View>
      {error && <Text className="ml-1 mt-1 text-sm text-danger-text">{error}</Text>}
    </View>
  );
});
