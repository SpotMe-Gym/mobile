import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Watch } from 'lucide-react-native';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { colors } from '@/theme/colors';
import { useHeartRateStore } from '@/features/heartRate/heartRateStore';
import {
  allowAppleHealth,
  useWatchPrefs,
  watchAvailable,
  watchStatus,
  type WatchStatus,
} from '@/features/watch/watch';

/** Apple Watch in the heart rate sheet: is it there, is SpotMe on it, use it or not. */
export function WatchSection({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const enabled = useWatchPrefs((s) => s.enabled);
  const setEnabled = useWatchPrefs((s) => s.setEnabled);
  const connected = useHeartRateStore((s) => s.watchConnected);
  const [status, setStatus] = useState<WatchStatus | null>(null);

  useEffect(() => {
    if (!visible || !watchAvailable) return;
    const id = setTimeout(() => void watchStatus().then(setStatus), 0);
    return () => clearTimeout(id);
  }, [visible, connected]);

  if (!watchAvailable) return null;
  const text = connected
    ? t('heartRate.watch.connected')
    : !status
      ? t('heartRate.watch.checking')
      : !status.isPaired
        ? t('heartRate.watch.notPaired')
        : !status.isWatchAppInstalled
          ? t('heartRate.watch.notInstalled')
          : t('heartRate.watch.ready');

  return (
    <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <Icon icon={Watch} size={20} color={colors['primary-text']} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">Apple Watch</Text>
          <Text className="text-xs text-subtle">{text}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          accessibilityLabel={t('heartRate.watch.useA11y')}
          trackColor={{ true: colors.primary, false: colors['surface-elevated'] }}
        />
      </View>
      <Text className="mt-3 text-xs text-muted">{t('heartRate.watch.how')}</Text>
      {enabled && status?.isPaired && (
        <Button
          label={t('heartRate.watch.allowHealth')}
          variant="secondary"
          size="sm"
          className="mt-3"
          onPress={() => void allowAppleHealth()}
        />
      )}
    </View>
  );
}
