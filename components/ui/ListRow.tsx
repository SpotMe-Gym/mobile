import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { Icon } from './Icon';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Shows a check and announces the row as selected (radio-style lists). */
  selected?: boolean;
  /** Shows a chevron (navigation rows). */
  chevron?: boolean;
  right?: ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  icon,
  selected,
  chevron,
  right,
  onPress,
  isLast,
  disabled,
}: ListRowProps) {
  const isRadio = selected !== undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={isRadio ? 'radio' : 'button'}
      accessibilityState={isRadio ? { checked: selected, disabled } : { disabled }}
      className={cn(
        'min-h-14 flex-row items-center justify-between px-4 py-4 active:bg-surface-elevated',
        !isLast && 'border-b border-border',
        disabled && 'opacity-50',
      )}
    >
      <View className="flex-1 flex-row items-center">
        {icon && <Icon icon={icon} size={20} className="mr-3" />}
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          {subtitle && <Text className="text-sm text-subtle">{subtitle}</Text>}
        </View>
      </View>
      {right}
      {isRadio && selected && (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Icon icon={Check} size={16} />
        </View>
      )}
      {chevron && <Icon icon={ChevronRight} size={20} color={colors.subtle} />}
    </Pressable>
  );
}

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('mb-8 overflow-hidden rounded-2xl border border-border bg-surface', className)}>
      {children}
    </View>
  );
}
