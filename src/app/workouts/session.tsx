import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Armchair, Check, ChevronLeft, ChevronRight, Plus, Timer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { lightImpact, successFeedback } from '@/shared/lib/haptics';
import { newId } from '@/shared/lib/ids';
import { formatNumber } from '@/shared/utils/number';
import { useWorkoutStore, type Exercise } from '@/features/workouts/workoutStore';
import {
  lastPerformance,
  selectActiveSession,
  summarizeSession,
  useSessionStore,
  type LoggedSet,
  type WorkoutSession,
} from '@/features/sessions/sessionStore';
import { ExerciseAnimation } from '@/features/exercises/components/ExerciseAnimation';
import { resolveExercise } from '@/features/exercises/resolve';
import { requestExercise } from '@/features/exercises/pickerStore';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** "8-12" → 8, "AMRAP" → null. */
const firstNumber = (reps: string) => {
  const m = /\d+/.exec(reps);
  return m ? Number(m[0]) : null;
};

/**
 * A once-a-second clock plus the rest timer. The timer ends inside the tick (not in an effect):
 * one state update, one buzz.
 */
function useWorkoutClock() {
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEnd] = useState<number | null>(null);
  const endRef = useRef<number | null>(null);
  const setRestEndsAt = useCallback((next: number | null | ((prev: number | null) => number | null)) => {
    const value = typeof next === 'function' ? next(endRef.current) : next;
    endRef.current = value;
    setRestEnd(value);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (endRef.current !== null && endRef.current <= t) {
        endRef.current = null;
        setRestEnd(null);
        successFeedback();
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return { now, restEndsAt, setRestEndsAt };
}

/**
 * A workout as it happens: one exercise at a time with its animation, last time's numbers, the
 * planned sets to tick off, and a rest timer after each set. Survives leaving the app: the
 * session stays active until it's finished or discarded.
 */
export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [sessionId] = useState(() => {
    const store = useSessionStore.getState();
    const active = selectActiveSession(store);
    if (active) return active.id;
    const workout = useWorkoutStore.getState().workouts.find((w) => w.id === workoutId) ?? null;
    return store.start(workout, t('session.start')).id;
  });
  const sessions = useSessionStore((s) => s.sessions);
  const session = sessions.find((s) => s.id === sessionId);
  const [index, setIndex] = useState(0);
  const { now, restEndsAt, setRestEndsAt } = useWorkoutClock();
  const restLeft = restEndsAt ? (restEndsAt - now) / 1000 : 0;

  if (!session) return null;
  const plan = session.plan;
  const block = plan[Math.min(index, plan.length - 1)];

  const finish = () => {
    if (session.sets.length === 0) {
      Alert.alert(t('session.emptyTitle'), t('session.emptyMessage'), [
        { text: t('session.keepGoing'), style: 'cancel' },
        {
          text: t('session.discard'),
          style: 'destructive',
          onPress: () => {
            useSessionStore.getState().discard(session.id);
            router.back();
          },
        },
      ]);
      return;
    }
    Alert.alert(t('session.finishTitle'), t('session.finishMessage', { count: session.sets.length }), [
      { text: t('session.keepGoing'), style: 'cancel' },
      {
        text: t('session.finish'),
        onPress: () => {
          useSessionStore.getState().finish(session.id);
          const all = useSessionStore.getState().sessions;
          const done = all.find((s) => s.id === session.id)!;
          const sum = summarizeSession(done, all);
          successFeedback();
          const body = [
            t('session.savedBody', {
              sets: sum.sets,
              volume: formatNumber(sum.volumeKg, i18n.language, 0),
              minutes: sum.minutes,
            }),
            sum.records.length
              ? t('session.records', {
                  list: sum.records
                    .map((r) => `${r.name} (${formatNumber(r.oneRepMaxKg, i18n.language, 1)} kg)`)
                    .join(', '),
                })
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');
          Alert.alert(t('session.savedTitle'), body, [{ text: 'OK', onPress: () => router.back() }]);
        },
      },
    ]);
  };

  const addExercise = () => {
    requestExercise((picked) => {
      useSessionStore.getState().addBlock(session.id, {
        id: newId(),
        exerciseId: picked.exerciseId,
        name: picked.name,
        sets: 3,
        reps: '10',
        restTime: 90,
        executionTime: 0,
        type: 'exercise',
      });
      setIndex(useSessionStore.getState().sessions.find((s) => s.id === session.id)!.plan.length - 1);
    });
    router.push('/workouts/exercise-picker');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-subtle">
              {clock((now - Date.parse(session.startedAt)) / 1000)}
            </Text>
            <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
              {session.name}
            </Text>
          </View>
          <Button label={t('session.finish')} size="sm" onPress={finish} />
        </View>

        {plan.length > 1 && (
          <View className="flex-row gap-1 px-4 pb-3">
            {plan.map((b, i) => (
              <Pressable
                key={b.id}
                onPress={() => setIndex(i)}
                accessibilityRole="button"
                accessibilityLabel={t('session.exerciseOf', { n: i + 1, total: plan.length })}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i === index
                    ? 'bg-primary'
                    : session.sets.some((s) => s.blockId === b.id)
                      ? 'bg-success'
                      : 'bg-surface-elevated',
                )}
              />
            ))}
          </View>
        )}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          {!block ? (
            <View className="items-center py-10">
              <Text className="mb-4 text-muted">{t('session.noPlan')}</Text>
              <Button
                label={t('exercises.pick')}
                icon={<Icon icon={Plus} size={18} />}
                onPress={addExercise}
              />
            </View>
          ) : block.type === 'rest' ? (
            <RestBlock block={block} onStart={() => setRestEndsAt(Date.now() + block.restTime * 1000)} />
          ) : (
            <ExerciseBlock
              key={block.id}
              block={block}
              session={session}
              sessions={sessions}
              onSetDone={(seconds) => seconds > 0 && setRestEndsAt(Date.now() + seconds * 1000)}
            />
          )}
          {plan.length > 0 && (
            <Pressable
              onPress={addExercise}
              accessibilityRole="button"
              className="mt-6 flex-row items-center justify-center gap-2 py-3 active:opacity-70"
            >
              <Icon icon={Plus} size={16} color={colors['primary-text']} />
              <Text className="font-semibold text-primary-text">{t('workouts.addExercise')}</Text>
            </Pressable>
          )}
        </ScrollView>

        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {restEndsAt && (
            <View
              className="mb-3 flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3"
              accessibilityLiveRegion="polite"
            >
              <Icon icon={Timer} size={18} color={colors['primary-text']} />
              <Text className="flex-1 text-base font-bold text-foreground">
                {t('session.restLeft', { time: clock(restLeft) })}
              </Text>
              <Pressable
                onPress={() => setRestEndsAt((e) => (e ? e + 15000 : e))}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text className="font-semibold text-primary-text">{t('session.restAdd')}</Text>
              </Pressable>
              <Pressable onPress={() => setRestEndsAt(null)} hitSlop={8} accessibilityRole="button">
                <Text className="font-semibold text-muted">{t('session.restSkip')}</Text>
              </Pressable>
            </View>
          )}
          {plan.length > 1 && (
            <View className="flex-row items-center gap-3">
              <Button
                variant="secondary"
                label={t('session.previous')}
                icon={<Icon icon={ChevronLeft} size={18} />}
                disabled={index === 0}
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                className="flex-1"
              />
              <Text className="text-sm text-subtle">
                {t('session.exerciseOf', { n: index + 1, total: plan.length })}
              </Text>
              <Button
                variant="secondary"
                label={t('session.next')}
                icon={<Icon icon={ChevronRight} size={18} />}
                disabled={index >= plan.length - 1}
                onPress={() => setIndex((i) => Math.min(plan.length - 1, i + 1))}
                className="flex-1"
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RestBlock({ block, onStart }: { block: Exercise; onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center rounded-3xl border border-warning/30 bg-warning/10 p-8">
      <Icon icon={Armchair} size={36} color={colors.warning} />
      <Text className="mt-3 text-lg font-bold text-foreground">{t('session.restBlock')}</Text>
      <Text className="mt-1 text-4xl font-bold tracking-tight text-foreground">{clock(block.restTime)}</Text>
      <Button label={t('session.startRest')} className="mt-5" onPress={onStart} />
    </View>
  );
}

function ExerciseBlock({
  block,
  session,
  sessions,
  onSetDone,
}: {
  block: Exercise;
  session: WorkoutSession;
  sessions: readonly WorkoutSession[];
  onSetDone: (restSeconds: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const info = resolveExercise(block.exerciseId, block.name);
  const done = session.sets.filter((s) => s.blockId === block.id).sort((a, b) => a.setIndex - b.setIndex);
  const last = useMemo(
    () => lastPerformance(sessions, block.exerciseId, block.name, session.id),
    [sessions, block.exerciseId, block.name, session.id],
  );
  const [extra, setExtra] = useState(0);
  const rows = Math.max(block.sets || 1, done.length) + extra;
  const w = (kg: number | null | undefined) => (kg ? `${convertWeight(kg).formatted}` : '');
  const lastText = last
    .map((s) => (s.weightKg ? `${s.reps ?? '–'}×${w(s.weightKg)}` : `${s.reps ?? '–'}`))
    .join(' · ');
  const muscleNames = info.muscles
    .map((m) => t(`exercises.muscles.${m.replace(' ', '_')}` as never, { defaultValue: m }))
    .join(', ');

  return (
    <View>
      <ExerciseAnimation
        frames={info.frames}
        style={{ width: '100%', aspectRatio: 1.6, borderRadius: 24 }}
        accessibilityLabel={info.name}
      />
      <Text className="mt-4 text-2xl font-bold text-foreground">{info.name}</Text>
      {muscleNames ? <Text className="mt-1 text-sm text-subtle">{muscleNames}</Text> : null}
      <Text className="mt-3 text-sm text-muted">
        {last.length
          ? t('session.lastTime', {
              sets: `${lastText}${last.some((s) => s.weightKg) ? ` ${units.weight}` : ''}`,
            })
          : t('session.firstTime')}
      </Text>
      <Text className="mt-1 text-xs text-subtle">
        {block.weight
          ? t('session.targetWeight', {
              reps: `${block.sets}×${block.reps}`,
              weight: `${w(block.weight)} ${units.weight}`,
            })
          : t('session.target', { reps: `${block.sets}×${block.reps}` })}
      </Text>

      <View className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        <View className="flex-row border-b border-border px-4 py-2">
          <Text className="w-12 text-xs font-semibold uppercase text-subtle">{t('session.set')}</Text>
          <Text className="flex-1 text-center text-xs font-semibold uppercase text-subtle">
            {t('session.reps')}
          </Text>
          <Text className="flex-1 text-center text-xs font-semibold uppercase text-subtle">
            {t('session.weight')} ({units.weight})
          </Text>
          <View className="w-12" />
        </View>
        {Array.from({ length: rows }, (_, i) => {
          const logged = done.find((s) => s.setIndex === i);
          const prev = last.find((s) => s.setIndex === i) ?? last[last.length - 1];
          return (
            <SetRow
              key={`${block.id}-${i}`}
              n={i + 1}
              logged={logged}
              defaultReps={prev?.reps ?? firstNumber(block.reps)}
              defaultWeightKg={prev?.weightKg ?? block.weight ?? null}
              onDone={(reps, weightKg) => {
                useSessionStore.getState().logSet(session.id, {
                  blockId: block.id,
                  exerciseId: block.exerciseId,
                  exerciseName: info.name,
                  setIndex: i,
                  reps,
                  weightKg,
                });
                lightImpact();
                onSetDone(block.restTime);
              }}
              onUndo={() => logged && useSessionStore.getState().removeSet(session.id, logged.id)}
              locale={i18n.language}
            />
          );
        })}
      </View>
      <Pressable
        onPress={() => setExtra((x) => x + 1)}
        accessibilityRole="button"
        className="mt-2 flex-row items-center gap-2 self-start py-2 active:opacity-70"
      >
        <Icon icon={Plus} size={16} color={colors.muted} />
        <Text className="font-semibold text-muted">{t('session.addSet')}</Text>
      </Pressable>
    </View>
  );
}

function SetRow({
  n,
  logged,
  defaultReps,
  defaultWeightKg,
  onDone,
  onUndo,
  locale,
}: {
  n: number;
  logged?: LoggedSet;
  defaultReps: number | null;
  defaultWeightKg: number | null;
  onDone: (reps: number | null, weightKg: number | null) => void;
  onUndo: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const { convertWeight, toKg } = useUnitConverter();
  const [reps, setReps] = useState(defaultReps ? String(defaultReps) : '');
  const [weight, setWeight] = useState(defaultWeightKg ? convertWeight(defaultWeightKg).formatted : '');

  if (logged) {
    return (
      <View className="flex-row items-center border-b border-border bg-success/10 px-4 py-2 last:border-b-0">
        <Text className="w-12 font-bold text-success-text">{n}</Text>
        <Text className="flex-1 text-center text-base font-semibold text-foreground">
          {logged.reps ?? '–'}
        </Text>
        <Text className="flex-1 text-center text-base font-semibold text-foreground">
          {logged.weightKg ? formatNumber(convertWeight(logged.weightKg).value, locale, 1) : '–'}
        </Text>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={t('session.undoSetA11y', { n })}
          className="h-10 w-12 items-center justify-center"
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-success">
            <Icon icon={Check} size={16} color={colors.background} />
          </View>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="flex-row items-center border-b border-border px-4 py-2">
      <Text className="w-12 font-bold text-subtle">{n}</Text>
      <TextInput
        className="mx-1 flex-1 rounded-lg bg-surface-sunken py-2 text-center text-base font-semibold text-foreground"
        value={reps}
        onChangeText={(v) => setReps(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        placeholder="–"
        placeholderTextColor={colors.placeholder}
        selectTextOnFocus
        accessibilityLabel={`${t('session.set')} ${n} · ${t('session.reps')}`}
      />
      <TextInput
        className="mx-1 flex-1 rounded-lg bg-surface-sunken py-2 text-center text-base font-semibold text-foreground"
        value={weight}
        onChangeText={(v) =>
          setWeight(
            v
              .replace(',', '.')
              .replace(/[^0-9.]/g, '')
              .slice(0, 6),
          )
        }
        keyboardType="decimal-pad"
        placeholder="–"
        placeholderTextColor={colors.placeholder}
        selectTextOnFocus
        accessibilityLabel={`${t('session.set')} ${n} · ${t('session.weight')}`}
      />
      <Pressable
        onPress={() => {
          const r = parseInt(reps, 10);
          const wv = parseFloat(weight);
          onDone(
            Number.isFinite(r) ? r : null,
            Number.isFinite(wv) && wv > 0 ? Math.round(toKg(wv) * 100) / 100 : null,
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={t('session.setDoneA11y', { n })}
        className="h-10 w-12 items-center justify-center"
      >
        <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-border-strong">
          <Icon icon={Check} size={16} color={colors.subtle} />
        </View>
      </Pressable>
    </View>
  );
}
