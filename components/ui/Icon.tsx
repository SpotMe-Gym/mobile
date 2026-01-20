import { View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string; // Apply styles to the wrapper view
}

export function Icon({ icon: IconComponent, size = 24, color = 'white', className }: IconProps) {
  return (
    <View pointerEvents="none" className={className}>
      <IconComponent size={size} color={color} />
    </View>
  );
}
