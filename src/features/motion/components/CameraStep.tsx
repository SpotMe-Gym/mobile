import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { lightImpact } from '@/shared/lib/haptics';
import { colors } from '@/theme/colors';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';

/** Longest clip: a set, with margin. The tracker reads every frame, so shorter is faster. */
const MAX_SECONDS = 90;

/**
 * Records the set. No sound is recorded (the microphone is never asked for). The framing
 * tips matter more than anything the analysis does afterwards.
 */
export function CameraStep({
  tips,
  onRecorded,
  onClose,
}: {
  tips: string[];
  onRecorded: (uri: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [recording]);

  const toggle = async () => {
    const cam = camera.current;
    if (!cam || !ready) return;
    lightImpact();
    if (recording) {
      cam.stopRecording();
      return;
    }
    setSeconds(0);
    setRecording(true);
    try {
      const video = await cam.recordAsync({ maxDuration: MAX_SECONDS });
      if (video?.uri) onRecorded(video.uri);
    } catch {
      // Recording interrupted (call, app in background): stay here to try again.
    } finally {
      setRecording(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Icon icon={Video} size={56} color={colors.accent} />
        <Text className="mt-4 text-center text-2xl font-bold text-foreground">{t('motion.cameraTitle')}</Text>
        <Text className="mt-2 text-center text-base text-subtle">{t('motion.cameraMessage')}</Text>
        {permission && !permission.canAskAgain ? (
          <Button
            label={t('common.openSettings')}
            variant="white"
            className="mt-8 px-8"
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Button
            label={t('motion.allowCamera')}
            variant="white"
            className="mt-8 px-8"
            onPress={() => void requestPermission()}
          />
        )}
        <Button label={t('common.cancel')} variant="ghost" className="mt-2" onPress={onClose} />
      </View>
    );
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <View className="flex-1 bg-overlay">
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        mode="video"
        facing="back"
        mute
        onCameraReady={() => setReady(true)}
      />
      {/* Controls sit over the preview (CameraView takes no children on Android). */}
      <View
        pointerEvents="box-none"
        className="absolute inset-0 justify-between"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}
      >
        <View className="flex-row items-start justify-between px-4">
          <View className="mr-3 flex-1 rounded-xl bg-overlay/70 p-3">
            {recording ? (
              <View className="flex-row items-center gap-2">
                <View className="h-3 w-3 rounded-full bg-danger" />
                <Text className="text-lg font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                  {clock}
                </Text>
              </View>
            ) : (
              tips.map((tip) => (
                <Text key={tip} className="text-sm leading-5 text-foreground">
                  • {tip}
                </Text>
              ))
            )}
          </View>
          {!recording && (
            <IconButton
              icon={X}
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              className="bg-overlay/70"
            />
          )}
        </View>
        <View className="items-center">
          <Pressable
            onPress={() => void toggle()}
            accessibilityRole="button"
            accessibilityLabel={recording ? t('motion.stopRecording') : t('motion.startRecording')}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-foreground active:opacity-70"
          >
            <View
              className={recording ? 'h-8 w-8 rounded-md bg-danger' : 'h-16 w-16 rounded-full bg-danger'}
            />
          </Pressable>
          <Text className="mt-3 rounded bg-overlay/60 px-3 py-1 text-sm font-medium text-foreground">
            {recording ? t('motion.stopHint') : t('motion.recordHint')}
          </Text>
        </View>
      </View>
    </View>
  );
}
