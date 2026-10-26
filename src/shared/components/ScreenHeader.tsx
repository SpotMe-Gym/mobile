import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { IconButton } from '@/shared/ui/IconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
  showBackButton?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  className,
  showBackButton = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className={cn('mb-6 mt-2 flex-row items-center justify-between', className)}>
      <View className="mr-4 flex-1 flex-row items-center">
        {showBackButton && (
          <IconButton
            icon={ChevronLeft}
            iconSize={24}
            accessibilityLabel={t('common.back')}
            onPress={onBack ?? (() => router.back())}
            className="mr-4"
          />
        )}
        <View className="flex-shrink">
          <Text accessibilityRole="header" className="text-2xl font-bold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && <Text className="text-sm text-subtle">{subtitle}</Text>}
        </View>
      </View>
      {rightAction}
    </View>
  );
}
