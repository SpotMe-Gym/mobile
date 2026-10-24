import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { TOUCH_HEIGHT_CLASS } from '@/lib/platform';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'white' | 'danger' | 'ai';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  textClassName?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-surface-elevated',
  outline: 'border border-border-strong bg-transparent',
  ghost: 'bg-transparent',
  white: 'bg-foreground',
  danger: 'border border-danger/30 bg-danger/10',
  ai: 'border border-accent/30 bg-accent/20',
};

const TEXT: Record<ButtonVariant, string> = {
  primary: 'font-bold text-primary-foreground',
  secondary: 'font-medium text-foreground',
  outline: 'font-medium text-foreground',
  ghost: 'font-medium text-muted',
  white: 'font-bold text-on-light',
  danger: 'font-bold text-danger-text',
  ai: 'font-medium text-primary-text',
};

const SIZES: Record<ButtonSize, string> = { sm: 'px-3 py-2', md: 'px-4 py-3', lg: 'px-6 py-4' };
const TEXT_SIZES: Record<ButtonSize, string> = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

/** Text button. For icon-only actions use IconButton (it requires an accessibility label). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  textClassName,
  disabled,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const isDisabled = !!disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center rounded-xl active:opacity-70',
        TOUCH_HEIGHT_CLASS,
        VARIANTS[variant],
        SIZES[size],
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'white' ? colors['on-light'] : colors.foreground}
          size="small"
        />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={cn(TEXT[variant], TEXT_SIZES[size], textClassName)}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
