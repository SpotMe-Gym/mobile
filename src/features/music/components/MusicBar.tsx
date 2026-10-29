import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { colors } from '@/theme/colors';
import { useMusic } from '@/features/music/useMusic';
import { MusicBarEmpty, MusicSheet } from '@/features/music/components/MusicSheet';
import type { TranslationKey } from '@/i18n/keys';

const PROBLEM_KEY: Record<string, TranslationKey> = {
  notConnected: 'music.connect',
  noAccess: 'music.connect',
  nothingPlaying: 'music.nothingPlaying',
  premiumRequired: 'music.premiumRequired',
  noDevice: 'music.noDevice',
  error: 'music.error',
};

/** The song playing now, with previous / play-pause / next. Tap the song to change source. */
export function MusicBar() {
  const { t } = useTranslation();
  const music = useMusic();
  const [open, setOpen] = useState(false);
  const np = music.nowPlaying;

  return (
    <>
      {np ? (
        <View className="h-14 flex-row items-center gap-3 rounded-2xl bg-surface pl-2 pr-1">
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('music.nowPlayingA11y', { title: np.title, artist: np.artist })}
            className="min-w-0 flex-1 flex-row items-center gap-3"
          >
            {np.artwork ? (
              <Image
                source={{ uri: np.artwork }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                contentFit="cover"
              />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                <Icon icon={Music} size={18} color={colors.subtle} />
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                {np.title}
              </Text>
              <Text className="text-xs text-subtle" numberOfLines={1}>
                {[np.artist, np.app].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
          <IconButton
            icon={SkipBack}
            variant="ghost"
            iconSize={20}
            accessibilityLabel={t('music.previous')}
            onPress={() => void music.run('previous')}
          />
          <IconButton
            icon={np.isPlaying ? Pause : Play}
            variant="ghost"
            iconSize={22}
            accessibilityLabel={np.isPlaying ? t('music.pause') : t('music.play')}
            onPress={() => void music.run(np.isPlaying ? 'pause' : 'play')}
          />
          <IconButton
            icon={SkipForward}
            variant="ghost"
            iconSize={20}
            accessibilityLabel={t('music.next')}
            onPress={() => void music.run('next')}
          />
        </View>
      ) : (
        <MusicBarEmpty
          onPress={() => setOpen(true)}
          label={
            music.source
              ? t(PROBLEM_KEY[music.problem?.kind ?? 'nothingPlaying'] ?? 'music.nothingPlaying')
              : t('music.connect')
          }
        />
      )}
      <MusicSheet
        visible={open}
        onClose={() => setOpen(false)}
        source={music.source}
        spotifyConnected={music.spotifyConnected}
        phoneAccess={music.phoneAccess}
        onChanged={() => void music.refreshAccess()}
      />
    </>
  );
}
