import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/shared/ui/Icon';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
}

export function EmptyState({ icon, title, message, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <View className="items-center px-8 py-16" accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}>
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full border border-border bg-surface">
        <Icon icon={icon} size={36} color={tone === 'error' ? colors['danger-text'] : colors.subtle} />
      </View>
      <Text className="text-center text-xl font-bold text-foreground">{title}</Text>
      {message && <Text className="mt-2 text-center text-base text-subtle">{message}</Text>}
      {action && <View className="mt-6">{action}</View>}
    </View>
  );
}
