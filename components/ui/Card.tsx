import { View, ViewProps, Text } from 'react-native';
import { cn } from '../../lib/utils';

interface CardProps extends ViewProps {
  className?: string;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}

export function Card({ className, children, title, subtitle, headerRight, ...props }: CardProps) {
  return (
    <View className={`bg-card rounded-2xl p-4 ${className || ''}`} {...props}>
      {(title || subtitle || headerRight) && (
        <View className="flex-row justify-between items-start mb-2">
          <View>
            {title && <Text className="text-white text-lg font-bold">{title}</Text>}
            {subtitle && <Text className="text-textSecondary text-sm">{subtitle}</Text>}
          </View>
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );
}
