import type { ReactNode } from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cn } from '@/shared/lib/cn';

interface CardProps extends ViewProps {
  className?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export function Card({ className, children, title, subtitle, headerRight, ...props }: CardProps) {
  return (
    <View className={cn('rounded-2xl bg-surface p-4', className)} {...props}>
      {(title || subtitle || headerRight) && (
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1">
            {title && (
              <Text
                accessibilityRole="header"
                className="text-lg font-bold text-foreground"
                numberOfLines={1}
              >
                {title}
              </Text>
            )}
            {subtitle && <Text className="text-sm text-muted">{subtitle}</Text>}
          </View>
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );
}
