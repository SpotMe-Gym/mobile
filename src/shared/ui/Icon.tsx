import { View } from 'react-native';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { colors } from '@/theme/colors';

interface IconProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon;
  className?: string;
}

/** Decorative icon. It never receives touches and is hidden from screen readers. */
export function Icon({
  icon: IconComponent,
  size = 24,
  color = colors.foreground,
  className,
  opacity = 1,
  strokeWidth = 2,
  fill = 'none',
  fillOpacity,
}: IconProps) {
  return (
    <View
      pointerEvents="none"
      className={className}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <IconComponent
        size={size}
        color={color}
        opacity={opacity}
        strokeWidth={strokeWidth}
        fill={fill}
        fillOpacity={fillOpacity}
      />
    </View>
  );
}
