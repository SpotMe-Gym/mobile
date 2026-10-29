import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check, Music, X } from 'lucide-react-native';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { useTopInset } from '@/shared/components/SafeScreen';
import { connectSpotify, disconnectSpotify, spotifyConfigured } from '@/features/music/spotify';
import { phoneSource, useMusicPrefs } from '@/features/music/useMusic';
import { NowPlayingModule, type NowPlayingAccess } from '../../../../modules/spotme-now-playing';
import type { MusicSource } from '@/features/music/types';

/** Choose and connect the music source: Spotify, Apple Music (iPhone), the phone's player (Android). */
export function MusicSheet({
  visible,
  onClose,
  source,
  spotifyConnected,
  phoneAccess,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  source: MusicSource | null;
  spotifyConnected: boolean;
  phoneAccess: NowPlayingAccess | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const top = useTopInset(true);
  const setPreferred = useMusicPrefs((s) => s.setPreferred);

  const allowPhone = async () => {
    if (!NowPlayingModule) return;
    if (Platform.OS === 'android') await NowPlayingModule.openAccessSettings();
    else await NowPlayingModule.requestAccess();
    setPreferred('phone');
    onChanged();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface-sunken" style={{ paddingTop: top }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            {t('music.title')}
          </Text>
          <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
          <Text className="text-sm text-muted">{t('music.intro')}</Text>

          <SourceCard
            title="Spotify"
            active={source === 'spotify'}
            body={
              spotifyConfigured()
                ? spotifyConnected
                  ? t('music.spotifyConnected')
                  : t('music.spotifyHint')
                : t('music.spotifyNotSetUp')
            }
            note={t('music.spotifyPremium')}
          >
            {spotifyConfigured() &&
              (spotifyConnected ? (
                <View className="flex-row gap-2">
                  {source !== 'spotify' && (
                    <Button
                      label={t('music.use')}
                      size="sm"
                      className="flex-1"
                      onPress={() => {
                        setPreferred('spotify');
                        onChanged();
                      }}
                    />
                  )}
                  <Button
                    label={t('music.disconnect')}
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onPress={async () => {
                      await disconnectSpotify();
                      onChanged();
                    }}
                  />
                </View>
              ) : (
                <Button
                  label={t('music.connectSpotify')}
                  size="sm"
                  onPress={async () => {
                    if (await connectSpotify()) {
                      setPreferred('spotify');
                      onChanged();
                    }
                  }}
                />
              ))}
          </SourceCard>

          {phoneSource && (
            <SourceCard
              title={phoneSource === 'appleMusic' ? 'Apple Music' : t('music.phonePlayer')}
              active={source === phoneSource}
              body={
                phoneAccess === 'granted'
                  ? phoneSource === 'appleMusic'
                    ? t('music.appleMusicReady')
                    : t('music.androidReady')
                  : phoneSource === 'appleMusic'
                    ? t('music.appleMusicHint')
                    : t('music.androidHint')
              }
            >
              {phoneAccess === 'granted' ? (
                source !== phoneSource && (
                  <Button
                    label={t('music.use')}
                    size="sm"
                    onPress={() => {
                      setPreferred('phone');
                      onChanged();
                    }}
                  />
                )
              ) : phoneAccess === 'denied' && phoneSource === 'appleMusic' ? (
                <Text className="text-xs text-subtle">{t('music.appleMusicDenied')}</Text>
              ) : (
                <Button label={t('music.allow')} size="sm" onPress={() => void allowPhone()} />
              )}
            </SourceCard>
          )}

          {!phoneSource && <Text className="text-xs text-subtle">{t('music.needsBuild')}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SourceCard({
  title,
  body,
  note,
  active,
  children,
}: {
  title: string;
  body: string;
  note?: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View className={cn('rounded-2xl border bg-surface p-4', active ? 'border-primary' : 'border-border')}>
      <View className="mb-1 flex-row items-center gap-2">
        <Icon icon={Music} size={18} color={active ? colors['primary-text'] : colors.subtle} />
        <Text className="flex-1 text-base font-bold text-foreground">{title}</Text>
        {active && <Icon icon={Check} size={18} color={colors['primary-text']} />}
      </View>
      <Text className="text-sm text-muted">{body}</Text>
      {note ? <Text className="mt-1 text-xs text-subtle">{note}</Text> : null}
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

export function MusicBarEmpty({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-12 flex-row items-center gap-3 rounded-2xl bg-surface px-3 active:opacity-70"
    >
      <Icon icon={Music} size={18} color={colors.subtle} />
      <Text className="flex-1 text-sm font-medium text-muted" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
