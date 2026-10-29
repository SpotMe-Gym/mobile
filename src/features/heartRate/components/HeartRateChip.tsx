import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react-native';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { useUserStore } from '@/features/profile/userStore';
import { HR_STALE_MS, useHeartRateStore } from '@/features/heartRate/heartRateStore';
import { heartRateZone, maxHeartRate, type HeartRateZone } from '@/features/heartRate/heartRate';

export const ZONE_COLOR: Record<HeartRateZone, string> = {
  1: '#9CA3AF',
  2: '#3B82F6',
  3: '#22C55E',
  4: '#F59E0B',
  5: '#EF4444',
};

/** Live heart rate and zone in the session header; tap to connect or change monitor. */
export function HeartRateChip({ now, onPress }: { now: number; onPress: () => void }) {
  const { t } = useTranslation();
  const { bpm, at, status, saved } = useHeartRateStore();
  const age = useUserStore((s) => s.age);
  const live = bpm !== null && at !== null && now - at < HR_STALE_MS;
  const zone = live ? heartRateZone(bpm, maxHeartRate(age)) : null;
  const label = live
    ? t('heartRate.chipA11y', { bpm, zone })
    : saved
      ? t('heartRate.chipWaiting')
      : t('heartRate.chipConnect');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full px-3',
        live ? 'bg-surface-elevated' : 'border border-border',
      )}
    >
      <Icon
        icon={Heart}
        size={15}
        color={zone ? ZONE_COLOR[zone] : status === 'connected' ? colors.danger : colors.subtle}
        fill={live ? (zone ? ZONE_COLOR[zone] : colors.danger) : 'none'}
      />
      <Text className={cn('text-sm font-bold tabular-nums', live ? 'text-foreground' : 'text-subtle')}>
        {live ? bpm : '--'}
      </Text>
      {zone && <Text className="text-[11px] font-semibold text-subtle">Z{zone}</Text>}
    </Pressable>
  );
}
