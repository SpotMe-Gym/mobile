import { Pressable, Text, View } from 'react-native';
import { cn } from '@/shared/lib/cn';
import { lightImpact } from '@/shared/lib/haptics';

export interface Segment<T extends string> {
  value: T;
  label: string;
  accessibilityLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" className={cn('flex-row rounded-xl bg-surface-sunken p-1', className)}>
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.accessibilityLabel ?? s.label}
            onPress={() => {
              if (active) return;
              lightImpact();
              onChange(s.value);
            }}
            className={cn(
              'flex-1 items-center justify-center rounded-lg px-2',
              size === 'sm' ? 'min-h-9 py-1.5' : 'min-h-11 py-2',
              active ? 'bg-primary' : 'active:bg-surface-elevated',
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                'font-semibold',
                size === 'sm' ? 'text-sm' : 'text-base',
                active ? 'text-primary-foreground' : 'text-muted',
              )}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
