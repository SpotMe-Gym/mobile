import { View } from 'react-native';
import { LucideIcon, LucideProps } from 'lucide-react-native';

interface IconProps {
  icon: LucideIcon;
}

export function Icon({
  icon: IconComponent,
  size = 24,
  color = 'white',
  className,
  opacity = 1,
  strokeWidth = 2,
  fill = "none",
  fillOpacity,
}: LucideProps & IconProps) {
  return (
    <View pointerEvents="none" className={className}>
      <IconComponent size={size} color={color} opacity={opacity} strokeWidth={strokeWidth} fill={fill} fillOpacity={fillOpacity} />
    </View>
  );
}
