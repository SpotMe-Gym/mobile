import { Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { clamp } from '@/shared/utils/number';
import { IconButton } from '@/shared/ui/IconButton';

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Rendered value, e.g. "25" or "2 servings". Defaults to the number. */
  display?: string;
  caption?: string;
  className?: string;
}

/**
 * −/+ control exposed to screen readers as one adjustable element (swipe up/down), so it
 * doesn't require two separate taps on tiny buttons.
 */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  display,
  caption,
  className,
}: StepperProps) {
  const { t } = useTranslation();
  const set = (v: number) => onChange(clamp(Math.round(v * 1000) / 1000, min, max));
  const shown = display ?? String(value);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') set(value + step);
        if (e.nativeEvent.actionName === 'decrement') set(value - step);
      }}
      className={cn(
        'flex-row items-center justify-between rounded-2xl border border-border bg-surface p-3',
        className,
      )}
    >
      <IconButton
        icon={Minus}
        accessibilityLabel={t('common.decrease')}
        onPress={() => set(value - step)}
        disabled={value <= min}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View className="flex-1 items-center">
        <Text className="text-3xl font-bold text-foreground">{shown}</Text>
        {caption && <Text className="text-xs uppercase text-subtle">{caption}</Text>}
      </View>
      <IconButton
        icon={Plus}
        accessibilityLabel={t('common.increase')}
        onPress={() => set(value + step)}
        disabled={value >= max}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </View>
  );
}
