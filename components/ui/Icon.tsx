import { View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string; // Apply styles to the wrapper view
  opacity?: number;
  strokeWidth?: number;
}

export function Icon({ icon: IconComponent, size = 24, color = 'white', className, opacity = 1, strokeWidth = 1 }: IconProps) {
  return (
    <View pointerEvents="none" className={className}>
      <IconComponent size={size} color={color} opacity={opacity} strokeWidth={strokeWidth} />
    </View>
  );
}
