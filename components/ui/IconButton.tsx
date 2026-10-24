import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { TOUCH_SIZE_CLASS } from '@/lib/platform';
import { Icon } from './Icon';

export type IconButtonVariant = 'secondary' | 'ghost' | 'primary' | 'ai' | 'outline' | 'danger';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style' | 'accessibilityLabel'> {
  icon: LucideIcon;
  /** Required: icon-only controls are meaningless to screen readers without it. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  iconSize?: number;
  iconColor?: string;
  filled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  secondary: 'bg-surface-elevated',
  ghost: 'bg-transparent',
  primary: 'bg-primary',
  ai: 'border border-accent/30 bg-accent/20',
  outline: 'border border-border-strong',
  danger: 'bg-transparent',
};

const DEFAULT_ICON_COLOR: Record<IconButtonVariant, string> = {
  secondary: colors.foreground,
  ghost: colors.foreground,
  primary: colors['primary-foreground'],
  ai: colors.accent,
  outline: colors.foreground,
  danger: colors.danger,
};

export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'secondary',
  iconSize = 22,
  iconColor,
  filled = false,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const color = iconColor ?? DEFAULT_ICON_COLOR[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      className={cn(
        'items-center justify-center rounded-full active:opacity-70',
        TOUCH_SIZE_CLASS,
        VARIANTS[variant],
        disabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      <Icon
        icon={icon}
        size={iconSize}
        color={color}
        fill={filled ? color : 'none'}
        fillOpacity={filled ? 0.2 : undefined}
      />
    </Pressable>
  );
}
