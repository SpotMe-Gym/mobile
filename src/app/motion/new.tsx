import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { SafeScreen } from '@/shared/components/SafeScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { CameraStep } from '@/features/motion/components/CameraStep';
import { MarkStep, type Marks } from '@/features/motion/components/MarkStep';
import { MARKERS, type MotionMode } from '@/features/motion/markers';
import { MOVEMENTS, fitMachine, type MovementId } from '@/features/motion/analysis/movements';
import { machinesOf, useMotionStore } from '@/features/motion/motionStore';
import {
  MotionError,
  discardFrame,
  executionFrom,
  firstFrame,
  machineFrom,
  track,
  type AnalysisError,
} from '@/features/motion/runAnalysis';
import { motionAvailable, type FrameInfo } from '../../../modules/spotme-motion';

type Step = 'setup' | 'camera' | 'mark' | 'working';

function Working({ fraction }: { fraction: number }) {
  const { t } = useTranslation();
  useKeepAwake();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
        {Math.round(fraction * 100)}%
      </Text>
      <View className="mt-6 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
        <View className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </View>
      <Text className="mt-4 text-center text-base text-muted">{t('motion.working')}</Text>
      <Text className="mt-1 text-center text-sm text-subtle">{t('motion.workingPrivate')}</Text>
    </View>
  );
}

export default function NewMotion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: MotionMode = params.mode === 'machine' ? 'machine' : 'execution';
  const records = useMotionStore((s) => s.records);
  const machines = useMemo(() => machinesOf(records), [records]);
  const add = useMotionStore((s) => s.add);

  const [step, setStep] = useState<Step>('setup');
  const [name, setName] = useState('');
  const [machineId, setMachineId] = useState<string | undefined>();
  const [movement, setMovement] = useState<MovementId>('chestPress');
  const [startsWithLowering, setStartsWithLowering] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [fraction, setFraction] = useState(0);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [loading, setLoading] = useState(false);

  // A frame that never became a result is deleted when the screen closes.
  const kept = useRef(false);
  const frameUri = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (!kept.current) discardFrame(frameUri.current);
    },
    [],
  );

  const loadVideo = async (uri: string) => {
    setError(null);
    setLoading(true);
    try {
      discardFrame(frameUri.current);
      const info = await firstFrame(uri);
      frameUri.current = info.uri;
      setVideo(uri);
      setFrame(info);
      setStep('mark');
    } catch (e) {
      setError(e instanceof MotionError ? e.reason : 'failed');
      setStep('setup');
    } finally {
      setLoading(false);
    }
  };

  const chooseVideo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    const uri = picked.canceled ? null : picked.assets[0]?.uri;
    if (uri) await loadVideo(uri);
  };

  const analyse = async (marks: Marks) => {
    if (!video || !frame) return;
    const points = marks.filter((m): m is [number, number] => m !== null);
    const hasPivot = mode === 'machine' && marks[2] !== null && marks[2] !== undefined;
    setFraction(0);
    setStep('working');
    try {
      const data = await track(video, points, mode === 'execution', setFraction);
      const base = {
        name: name.trim(),
        image: frame.uri,
        aspect: frame.height > 0 ? frame.width / frame.height : 9 / 16,
      };
      const id =
        mode === 'machine'
          ? (() => {
              const result = machineFrom(data, hasPivot);
              return add({
                ...base,
                kind: 'machine',
                movement,
                result,
                fit: fitMachine(result.profile, movement),
              });
            })()
          : add({ ...base, kind: 'execution', machineId, result: executionFrom(data, startsWithLowering) });
      kept.current = true;
      router.replace({ pathname: '/motion/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof MotionError ? e.reason : 'failed');
      setStep('mark');
    }
  };

  if (step === 'camera') {
    return (
      <CameraStep
        tips={[
          t('motion.tipSide'),
          t('motion.tipSteady'),
          t(mode === 'machine' ? 'motion.tipMachine' : 'motion.tipBody'),
          t('motion.tipRest'),
        ]}
        onRecorded={(uri) => void loadVideo(uri)}
        onClose={() => setStep('setup')}
      />
    );
  }

  const title = t(mode === 'machine' ? 'motion.machineTitle' : 'motion.executionTitle');
  const errorText = error ? t(`motion.error.${error}`) : null;

  return (
    <SafeScreen className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <ScreenHeader
          title={title}
          subtitle={step === 'mark' ? t('motion.markSubtitle') : undefined}
          showBackButton={step !== 'working'}
          onBack={step === 'mark' ? () => setStep('setup') : undefined}
        />

        {step === 'working' && <Working fraction={fraction} />}

        {step === 'mark' && frame && (
          <>
            {errorText && (
              <View className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3">
                <Text className="text-sm text-danger-text">{errorText}</Text>
              </View>
            )}
            <MarkStep
              image={frame.uri}
              aspect={frame.height > 0 ? frame.width / frame.height : 9 / 16}
              markers={MARKERS[mode]}
              onDone={(marks) => void analyse(marks)}
              onBack={() => setStep('setup')}
            />
          </>
        )}

        {step === 'setup' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
            <ScrollView
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-4 text-base leading-6 text-muted">
                {t(mode === 'machine' ? 'motion.machineIntro' : 'motion.executionIntro')}
              </Text>

              <Text className="mb-2 ml-1 font-medium text-muted">
                {t(mode === 'machine' ? 'motion.machineName' : 'motion.exerciseName')}
              </Text>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setMachineId(undefined);
                }}
                placeholder={t(
                  mode === 'machine' ? 'motion.machineNamePlaceholder' : 'motion.exerciseNamePlaceholder',
                )}
                placeholderTextColor={colors.placeholder}
                className="h-14 rounded-xl border border-border bg-surface px-4 text-lg text-foreground"
                maxLength={60}
                returnKeyType="done"
              />

              {mode === 'execution' && machines.length > 0 && (
                <>
                  <Text className="mb-2 ml-1 mt-5 font-medium text-muted">{t('motion.onMachine')}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {machines.map((m) => (
                      <Chip
                        key={m.id}
                        label={m.name || t('motion.unnamedMachine')}
                        selected={machineId === m.id}
                        onPress={() => {
                          setMachineId(machineId === m.id ? undefined : m.id);
                          if (machineId !== m.id && m.name) setName(m.name);
                        }}
                      />
                    ))}
                  </View>
                </>
              )}

              {mode === 'machine' && (
                <>
                  <Text className="mb-2 ml-1 mt-5 font-medium text-muted">{t('motion.movement')}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {MOVEMENTS.map((m) => (
                      <Chip
                        key={m.id}
                        label={t(`motion.movements.${m.id}`)}
                        selected={movement === m.id}
                        onPress={() => setMovement(m.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              {mode === 'execution' && (
                <View className="mt-5 flex-row items-center rounded-xl border border-border bg-surface px-4 py-3">
                  <View className="mr-3 flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {t('motion.startsWithLowering')}
                    </Text>
                    <Text className="text-sm text-subtle">{t('motion.startsWithLoweringHint')}</Text>
                  </View>
                  <Switch
                    value={startsWithLowering}
                    onValueChange={setStartsWithLowering}
                    trackColor={{ true: colors.primary, false: colors['border-strong'] }}
                    accessibilityLabel={t('motion.startsWithLowering')}
                  />
                </View>
              )}

              <View className="mt-5 rounded-xl border border-border bg-surface p-4">
                <Text className="mb-2 text-base font-bold text-foreground">{t('motion.tipsTitle')}</Text>
                {[
                  t('motion.tipSide'),
                  t('motion.tipSteady'),
                  t(mode === 'machine' ? 'motion.tipMachine' : 'motion.tipBody'),
                  t('motion.tipRest'),
                  t(mode === 'machine' ? 'motion.tipReps' : 'motion.tipRepsExecution'),
                ].map((tip) => (
                  <Text key={tip} className="text-sm leading-6 text-muted">
                    • {tip}
                  </Text>
                ))}
              </View>

              {errorText && (
                <View className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3">
                  <Text className="text-sm text-danger-text">{errorText}</Text>
                </View>
              )}
              {!motionAvailable && !errorText && (
                <View className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <Text className="text-sm text-warning-text">{t('motion.unavailable')}</Text>
                </View>
              )}
            </ScrollView>

            <View className="mt-3 gap-2">
              <Button
                label={t('motion.record')}
                size="lg"
                disabled={!motionAvailable || loading}
                onPress={() => {
                  setError(null);
                  setStep('camera');
                }}
              />
              <Button
                label={t('motion.chooseVideo')}
                variant="secondary"
                loading={loading}
                disabled={!motionAvailable}
                onPress={() => void chooseVideo()}
              />
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeScreen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'rounded-full border px-3 py-2',
        selected ? 'border-primary bg-primary/20' : 'border-border bg-surface',
      )}
    >
      <Text className={cn('text-sm font-medium', selected ? 'text-primary-text' : 'text-muted')}>
        {label}
      </Text>
    </Pressable>
  );
}
