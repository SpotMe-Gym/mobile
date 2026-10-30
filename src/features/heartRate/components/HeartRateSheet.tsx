import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bluetooth, Heart, X } from 'lucide-react-native';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { colors } from '@/theme/colors';
import { useTopInset } from '@/shared/components/SafeScreen';
import { useHeartRateStore, type HeartRateStatus } from '@/features/heartRate/heartRateStore';
import {
  connectMonitor,
  disconnectMonitor,
  forgetMonitor,
  scanForMonitors,
} from '@/features/heartRate/bleHeartRate';
import type { TranslationKey } from '@/i18n/keys';
import { WatchSection } from '@/features/watch/WatchSection';

const STATUS_KEY: Record<HeartRateStatus, TranslationKey> = {
  idle: 'heartRate.status.idle',
  scanning: 'heartRate.status.scanning',
  connecting: 'heartRate.status.connecting',
  connected: 'heartRate.status.connected',
  reconnecting: 'heartRate.status.reconnecting',
  bluetoothOff: 'heartRate.status.bluetoothOff',
  unauthorized: 'heartRate.status.unauthorized',
  unsupported: 'heartRate.status.unsupported',
  error: 'heartRate.status.error',
};

/** Pick, connect, disconnect or forget a Bluetooth heart rate monitor. */
export function HeartRateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = useTopInset(true);
  const { saved, status, found, bpm } = useHeartRateStore();
  const busy = status === 'scanning' || status === 'connecting' || status === 'reconnecting';
  const isConnected = status === 'connected';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface-sunken" style={{ paddingTop: top }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            {t('heartRate.title')}
          </Text>
          <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <Text className="text-sm text-muted">{t('heartRate.intro')}</Text>

          <WatchSection visible={visible} />

          <View className="mt-4 flex-row items-center gap-2" accessibilityLiveRegion="polite">
            {busy ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Icon icon={Bluetooth} size={16} color={colors.subtle} />
            )}
            <Text className="text-sm font-semibold text-foreground">{t(STATUS_KEY[status])}</Text>
          </View>

          {saved && (
            <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-danger/15">
                  <Icon icon={Heart} size={20} color={colors.danger} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground" numberOfLines={1}>
                    {saved.name}
                  </Text>
                  <Text className="text-xs text-subtle">
                    {isConnected && bpm ? t('heartRate.bpmNow', { bpm }) : t('heartRate.saved')}
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row gap-2">
                {isConnected ? (
                  <Button
                    label={t('heartRate.disconnect')}
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onPress={() => void disconnectMonitor()}
                  />
                ) : (
                  <Button
                    label={t('heartRate.connect')}
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onPress={() => void connectMonitor(saved)}
                  />
                )}
                <Button
                  label={t('heartRate.forget')}
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onPress={forgetMonitor}
                />
              </View>
            </View>
          )}

          <Button
            label={status === 'scanning' ? t('heartRate.searching') : t('heartRate.search')}
            variant={saved ? 'outline' : 'primary'}
            className="mt-4"
            disabled={status === 'scanning' || status === 'connecting'}
            onPress={() => void scanForMonitors()}
          />

          {found.filter((d) => d.id !== saved?.id).length > 0 && (
            <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
              {found
                .filter((d) => d.id !== saved?.id)
                .map((d, i, list) => (
                  <Pressable
                    key={d.id}
                    onPress={() => void connectMonitor({ id: d.id, name: d.name })}
                    accessibilityRole="button"
                    accessibilityLabel={t('heartRate.connectTo', { name: d.name })}
                    className={`flex-row items-center gap-3 px-4 py-3 active:bg-surface-elevated ${i < list.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <Icon icon={Heart} size={18} color={colors.subtle} />
                    <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text className="text-xs text-subtle">{t('heartRate.connect')}</Text>
                  </Pressable>
                ))}
            </View>
          )}

          <Text className="mt-6 text-xs text-subtle">{t('heartRate.compat')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
