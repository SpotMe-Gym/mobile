import { useEffect } from 'react';
import { Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { reportError } from '@/shared/lib/reporting';
import { colors } from '@/theme/colors';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

/** Route-level error boundary UI (exported as `ErrorBoundary` from layouts/routes). */
export function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  useEffect(() => reportError(error, { context: 'ErrorBoundary' }), [error]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Icon icon={AlertTriangle} size={48} color={colors['warning-text']} />
      <Text accessibilityRole="header" className="mt-4 text-center text-2xl font-bold text-foreground">
        {t('errors.crashTitle')}
      </Text>
      <Text className="mt-2 text-center text-base text-subtle">{t('errors.crashMessage')}</Text>
      <Button label={t('common.tryAgain')} variant="white" className="mt-8 px-8" onPress={retry} />
    </View>
  );
}
