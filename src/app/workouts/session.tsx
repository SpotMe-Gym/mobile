import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Armchair,
  Check,
  ChevronDown,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeScreen } from '@/shared/components/SafeScreen';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Stepper } from '@/shared/ui/Stepper';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { successFeedback } from '@/shared/lib/haptics';
import { newId } from '@/shared/lib/ids';
import { formatNumber } from '@/shared/utils/number';
import { useWorkoutStore, type Exercise } from '@/features/workouts/workoutStore';
import {
  lastPerformance,
  selectActiveSession,
  summarizeSession,
  useSessionStore,
  type WorkoutSession,
} from '@/features/sessions/sessionStore';
import { nextUp, nextWork, restAfter, type Step, type WorkStep } from '@/features/sessions/player';
import { defaultSetValues, usePlayer, type SetValues } from '@/features/sessions/player/usePlayer';
import { TimerRing } from '@/features/sessions/player/TimerRing';
import { usePlayerPrefs } from '@/features/sessions/player/playerPrefs';
import { ExerciseAnimation } from '@/features/exercises/components/ExerciseAnimation';
import { resolveExercise } from '@/features/exercises/resolve';
import { requestExercise } from '@/features/exercises/pickerStore';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { HeartRateChip } from '@/features/heartRate/components/HeartRateChip';
import { HeartRateSheet } from '@/features/heartRate/components/HeartRateSheet';
import { connectSavedMonitor, disconnectMonitor, onHeartRate } from '@/features/heartRate/bleHeartRate';
import { MusicBar } from '@/features/music/components/MusicBar';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds - 0.05));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * The workout player. Everything set up in the workout runs here: each set with its target reps
 * and weight, the execution timer (and the second phase, if any), the rest timer, rest blocks,
 * and what comes next. Timers keep going with the phone locked; heart rate and music sit on top.
 */
export default function SessionScreen() {
  useKeepAwake();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [sessionId] = useState(() => {
    const store = useSessionStore.getState();
    const active = selectActiveSession(store);
    if (active) return active.id;
    const workout = useWorkoutStore.getState().workouts.find((w) => w.id === workoutId) ?? null;
    return store.start(workout, t('session.start')).id;
  });
  const sound = usePlayerPrefs((s) => s.sound);
  const toggleSound = usePlayerPrefs((s) => s.toggleSound);
  const p = usePlayer(sessionId, { sound });
  const [hrOpen, setHrOpen] = useState(false);

  // Heart rate: connect the remembered monitor, record readings into the session.
  useEffect(() => {
    void connectSavedMonitor();
    const off = onHeartRate((bpm, at) => useSessionStore.getState().addHeartRate(sessionId, bpm, at));
    return off;
  }, [sessionId]);

  const session = p.session;
  if (!session) return null;

  const finish = () =>
    finishSession(session, t, i18n.language, () => {
      void disconnectMonitor();
      router.back();
    });

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
    });
    router.push('/workouts/exercise-picker');
  };

  return (
    <SafeScreen className="flex-1 bg-background" edges={['top']}>
      {/* Header: minimise (the workout keeps running), time, heart rate, finish. */}
      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <IconButton
          icon={ChevronDown}
          variant="ghost"
          iconSize={24}
          accessibilityLabel={t('player.minimise')}
          onPress={() => router.back()}
        />
        <View className="flex-1">
          <Text className="text-xs font-semibold tabular-nums text-subtle">
            {clock((p.now - Date.parse(session.startedAt)) / 1000)}
          </Text>
          <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
            {session.name}
          </Text>
        </View>
        <HeartRateChip now={p.now} onPress={() => setHrOpen(true)} />
        <Button label={t('session.finish')} size="sm" onPress={finish} />
      </View>

      <BlockProgress session={session} steps={p.steps} current={p.player.step} onJump={p.controls.jump} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {p.steps.length === 0 ? (
          <View className="items-center py-16">
            <Text className="mb-4 text-center text-muted">{t('session.noPlan')}</Text>
            <Button label={t('exercises.pick')} icon={<Icon icon={Plus} size={18} />} onPress={addExercise} />
          </View>
        ) : p.finished ? (
          <CompleteCard session={session} onFinish={finish} onAdd={addExercise} />
        ) : p.step ? (
          <StepView
            session={session}
            steps={p.steps}
            index={p.player.step}
            remaining={p.remaining}
            elapsed={p.elapsed}
            paused={p.paused}
            setValues={p.setValues}
            onDone={p.controls.done}
          />
        ) : null}
      </ScrollView>

      <Controls
        paused={p.paused}
        timed={p.remaining !== null}
        disabled={p.steps.length === 0 || p.finished}
        sound={sound}
        onBack={p.controls.back}
        onToggle={p.controls.togglePause}
        onSkip={p.controls.skip}
        onAdd={() => p.controls.addSeconds(15)}
        onSound={toggleSound}
      />

      <HeartRateSheet visible={hrOpen} onClose={() => setHrOpen(false)} />
    </SafeScreen>
  );
}

function finishSession(
  session: WorkoutSession,
  t: ReturnType<typeof useTranslation>['t'],
  lang: string,
  done: () => void,
) {
  if (session.sets.length === 0) {
    Alert.alert(t('session.emptyTitle'), t('session.emptyMessage'), [
      { text: t('session.keepGoing'), style: 'cancel' },
      {
        text: t('session.discard'),
        style: 'destructive',
        onPress: () => {
          useSessionStore.getState().discard(session.id);
          done();
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
        const saved = all.find((s) => s.id === session.id)!;
        const sum = summarizeSession(saved, all);
        successFeedback();
        const body = [
          t('session.savedBody', {
            sets: sum.sets,
            volume: formatNumber(sum.volumeKg, lang, 0),
            minutes: sum.minutes,
          }),
          saved.heartRate
            ? t('player.hrSummary', { avg: Math.round(saved.heartRate.avg), max: saved.heartRate.max })
            : '',
          sum.records.length
            ? t('session.records', {
                list: sum.records
                  .map((r) => `${r.name} (${formatNumber(r.oneRepMaxKg, lang, 1)} kg)`)
                  .join(', '),
              })
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        Alert.alert(t('session.savedTitle'), body, [{ text: 'OK', onPress: done }]);
      },
    },
  ]);
}

/** One segment per exercise: done, current, to do. Tap to jump to that exercise. */
function BlockProgress({
  session,
  steps,
  current,
  onJump,
}: {
  session: WorkoutSession;
  steps: readonly Step[];
  current: number;
  onJump: (i: number) => void;
}) {
  const { t } = useTranslation();
  const blocks = session.plan;
  if (blocks.length < 2) return null;
  const currentBlock = steps[current]?.blockIndex ?? blocks.length;
  return (
    <View className="flex-row gap-1 px-4 pb-3">
      {blocks.map((b, i) => {
        const first = steps.findIndex((s) => s.blockIndex === i);
        const done =
          b.type === 'exercise' &&
          session.sets.filter((s) => s.blockId === b.id).length >= Math.max(1, b.sets);
        return (
          <Pressable
            key={b.id}
            disabled={first < 0}
            onPress={() => onJump(first)}
            hitSlop={{ top: 10, bottom: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('player.jumpTo', {
              name: b.type === 'rest' ? t('session.restBlock') : b.name,
            })}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i === currentBlock
                ? 'bg-primary'
                : done
                  ? 'bg-success'
                  : b.type === 'rest'
                    ? 'bg-warning/40'
                    : 'bg-surface-elevated',
            )}
          />
        );
      })}
    </View>
  );
}

const phaseName = (t: ReturnType<typeof useTranslation>['t'], s: Step) =>
  s.kind === 'rest'
    ? t('player.rest')
    : s.label ||
      (s.phase === 2 ? t('player.secondPhase') : s.seconds > 0 ? t('player.execution') : t('player.yourSet'));

/** The current step: exercise, timers, the set to log and what comes next. */
function StepView({
  session,
  steps,
  index,
  remaining,
  elapsed,
  paused,
  setValues,
  onDone,
}: {
  session: WorkoutSession;
  steps: readonly Step[];
  index: number;
  remaining: number | null;
  elapsed: number;
  paused: boolean;
  setValues: (v: SetValues) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const step = steps[index]!;
  const isRest = step.kind === 'rest';
  // During a rest, show the exercise it leads into.
  const focus: WorkStep | null = step.kind === 'work' ? step : nextWork(steps, index);
  const block = focus ? session.plan[focus.blockIndex] : undefined;
  const ringColor = isRest ? colors.warning : step.phase === 2 ? colors.highlight : colors.accent;
  const total = step.seconds;
  const progress = remaining !== null && total > 0 ? 1 - remaining / total : null;
  const ring = Math.min(240, Math.round(width * 0.58));

  return (
    <View>
      {block && focus && (
        <ExerciseHeader block={block} step={focus} session={session} compact={isRest} upcoming={isRest} />
      )}

      <View className="mt-4 items-center">
        <TimerRing size={ring} progress={progress} color={ringColor}>
          <Text
            className={cn(
              'text-xs font-bold uppercase tracking-widest',
              isRest ? 'text-warning-text' : 'text-primary-text',
            )}
          >
            {phaseName(t, step)}
          </Text>
          <Text
            className="text-6xl font-black tabular-nums tracking-tight text-foreground"
            accessibilityLabel={
              remaining !== null
                ? t('player.timeLeftA11y', { time: clock(remaining) })
                : t('player.setTimeA11y', { time: clock(elapsed) })
            }
          >
            {clock(remaining ?? elapsed)}
          </Text>
          <Text className="text-xs text-subtle">
            {paused ? t('player.paused') : remaining !== null ? t('player.left') : t('player.setTime')}
          </Text>
        </TimerRing>
      </View>

      {/* Every timer of this set, the running one highlighted. */}
      <PhaseTimers steps={steps} index={index} remaining={remaining} />

      {step.kind === 'work' && block && (
        <SetPanel
          key={`${block.id}-${step.setIndex}`}
          session={session}
          step={step}
          setValues={setValues}
          onDone={onDone}
          timed={remaining !== null}
        />
      )}
      {isRest && (
        <Button
          label={t('player.skipRest')}
          variant="secondary"
          className="mt-4"
          icon={<Icon icon={SkipForward} size={18} />}
          onPress={onDone}
        />
      )}

      <NextUpCard session={session} steps={steps} index={index} />
      {step.kind === 'work' && block && <LoggedSets session={session} block={block} />}
    </View>
  );
}

function ExerciseHeader({
  block,
  step,
  session,
  compact,
  upcoming,
}: {
  block: Exercise;
  step: WorkStep;
  session: WorkoutSession;
  compact: boolean;
  upcoming: boolean;
}) {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const info = resolveExercise(block.exerciseId, block.name);
  const sessions = useSessionStore((s) => s.sessions);
  const last = useMemo(
    () => lastPerformance(sessions, block.exerciseId, block.name, session.id),
    [sessions, block.exerciseId, block.name, session.id],
  );
  const w = (kg: number | null | undefined) => (kg ? convertWeight(kg).formatted : '');
  const target = block.weight
    ? t('player.targetWeight', { reps: block.reps || '–', weight: `${w(block.weight)} ${units.weight}` })
    : t('player.targetReps', { reps: block.reps || '–' });
  return (
    <View className={cn('flex-row gap-3', compact ? 'items-center' : 'flex-col')}>
      <ExerciseAnimation
        frames={info.frames}
        style={
          compact
            ? { width: 84, height: 84, borderRadius: 16 }
            : { width: '100%', aspectRatio: 2, borderRadius: 22 }
        }
        accessibilityLabel={info.name}
      />
      <View className="flex-1">
        {upcoming && (
          <Text className="text-xs font-bold uppercase tracking-wider text-warning-text">
            {t('player.upNext')}
          </Text>
        )}
        <Text className="text-2xl font-bold text-foreground" numberOfLines={2}>
          {info.name}
        </Text>
        <Text className="mt-0.5 text-base font-semibold text-primary-text">
          {t('player.setOf', { n: step.setIndex + 1, total: step.sets })} · {target}
        </Text>
        {!compact && (
          <Text className="mt-1 text-sm text-muted">
            {last.length
              ? t('session.lastTime', {
                  sets: `${last.map((s) => (s.weightKg ? `${s.reps ?? '–'}×${w(s.weightKg)}` : `${s.reps ?? '–'}`)).join(' · ')}${last.some((s) => s.weightKg) ? ` ${units.weight}` : ''}`,
                })
              : t('session.firstTime')}
          </Text>
        )}
        {!compact && block.notes ? (
          <Text className="mt-1 text-sm italic text-subtle">{block.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** The set's timers side by side: execution, second phase, rest. */
function PhaseTimers({
  steps,
  index,
  remaining,
}: {
  steps: readonly Step[];
  index: number;
  remaining: number | null;
}) {
  const { t } = useTranslation();
  const step = steps[index]!;
  // The work steps of the current (or upcoming) set, and the rest after it.
  const anchor = step.kind === 'work' ? step : nextWork(steps, index);
  const items: {
    key: string;
    label: string;
    seconds: number;
    active: boolean;
    tone: 'work' | 'second' | 'rest';
  }[] = [];
  if (anchor) {
    steps.forEach((s, i) => {
      if (
        s.kind === 'work' &&
        s.blockIndex === anchor.blockIndex &&
        s.setIndex === anchor.setIndex &&
        s.seconds > 0
      ) {
        items.push({
          key: `w${i}`,
          label: phaseName(t, s),
          seconds: s.seconds,
          active: i === index,
          tone: s.phase === 2 ? 'second' : 'work',
        });
      }
    });
  }
  const rest = step.kind === 'rest' ? step : restAfter(steps, index);
  if (rest)
    items.push({
      key: 'rest',
      label: t('player.rest'),
      seconds: rest.seconds,
      active: step.kind === 'rest',
      tone: 'rest',
    });
  if (items.length === 0) return null;
  return (
    <View className="mt-4 flex-row gap-2">
      {items.map((it) => (
        <View
          key={it.key}
          className={cn(
            'flex-1 items-center rounded-2xl border px-2 py-2.5',
            it.active
              ? it.tone === 'rest'
                ? 'border-warning bg-warning/15'
                : it.tone === 'second'
                  ? 'border-highlight bg-highlight/15'
                  : 'border-primary bg-primary/15'
              : 'border-border bg-surface',
          )}
        >
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-subtle" numberOfLines={1}>
            {it.label}
          </Text>
          <Text className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
            {clock(it.active && remaining !== null ? remaining : it.seconds)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Reps and weight for the set (prefilled from last time / the plan) and the Done button. */
function SetPanel({
  session,
  step,
  setValues,
  onDone,
  timed,
}: {
  session: WorkoutSession;
  step: WorkStep;
  setValues: (v: SetValues) => void;
  onDone: () => void;
  timed: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { convertWeight, toKg, units } = useUnitConverter();
  const [initial] = useState(() => defaultSetValues(session, useSessionStore.getState().sessions, step));
  const [reps, setReps] = useState(initial.reps ?? 0);
  const [weight, setWeight] = useState(initial.weightKg ? convertWeight(initial.weightKg).value : 0);
  useEffect(() => {
    setValues({ reps: reps || null, weightKg: weight > 0 ? Math.round(toKg(weight) * 100) / 100 : null });
  }, [reps, weight, setValues, toKg]);
  const endsSet = step.endsSet;
  const doneLabel = timed
    ? endsSet
      ? t('player.finishSetEarly')
      : t('player.nextPhase')
    : t('player.setDone');
  return (
    <View className="mt-4 rounded-3xl border border-border bg-surface p-4">
      {endsSet && (
        <View className="flex-row gap-3">
          <Stepper
            label={t('session.reps')}
            value={reps}
            onChange={setReps}
            min={0}
            max={200}
            className="flex-1"
          />
          <Stepper
            label={`${t('session.weight')} (${units.weight})`}
            value={weight}
            onChange={setWeight}
            step={units.weight === 'lbs' ? 5 : 2.5}
            min={0}
            max={1000}
            display={weight ? formatNumber(weight, i18n.language, 1) : '–'}
            className="flex-1"
          />
        </View>
      )}
      <Button
        label={doneLabel}
        size="lg"
        variant={timed ? 'secondary' : 'primary'}
        icon={
          <Icon icon={Check} size={20} color={timed ? colors.foreground : colors['primary-foreground']} />
        }
        className={endsSet ? 'mt-4' : ''}
        onPress={onDone}
      />
      {timed && endsSet && (
        <Text className="mt-2 text-center text-xs text-subtle">{t('player.autoLogHint')}</Text>
      )}
    </View>
  );
}

/** What comes after this step: the next phase, the next set, or (on the last set) the next exercise. */
function NextUpCard({
  session,
  steps,
  index,
}: {
  session: WorkoutSession;
  steps: readonly Step[];
  index: number;
}) {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const n = nextUp(steps, index);
  const step = steps[index]!;
  // During a rest the header already shows what it leads into: only say what's after that set.
  if (step.kind === 'rest' && n.kind !== 'finish') return null;
  let title = '';
  let detail = '';
  let exercise: Exercise | undefined;
  if (n.kind === 'finish') {
    title = t('player.lastOne');
  } else if (n.kind === 'phase') {
    title = t('player.thenPhase', { name: phaseName(t, n.step), time: clock(n.step.seconds) });
  } else if (n.kind === 'rest') {
    const after = nextUp(steps, index + 1);
    title = t('player.thenRest', { time: clock(n.step.seconds) });
    if (after.kind === 'exercise') {
      exercise = session.plan[after.step.blockIndex];
      detail = t('player.nextExercise');
    } else if (after.kind === 'set') {
      detail = t('player.nextSet', { n: after.step.setIndex + 1, total: after.step.sets });
    } else if (after.kind === 'finish') {
      detail = t('player.lastOne');
    }
  } else if (n.kind === 'set') {
    title = t('player.nextSet', { n: n.step.setIndex + 1, total: n.step.sets });
  } else if (n.kind === 'exercise') {
    exercise = session.plan[n.step.blockIndex];
    title = t('player.nextExercise');
  }
  const info = exercise ? resolveExercise(exercise.exerciseId, exercise.name) : null;
  return (
    <View className="mt-4 rounded-3xl border border-border bg-surface-sunken p-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-subtle">{t('player.upNext')}</Text>
      <Text className="mt-1 text-base font-semibold text-foreground">{title}</Text>
      {detail ? <Text className="text-sm text-muted">{detail}</Text> : null}
      {exercise && info && (
        <View className="mt-3 flex-row items-center gap-3">
          {exercise.type === 'rest' ? (
            <View className="h-14 w-14 items-center justify-center rounded-xl bg-warning/15">
              <Icon icon={Armchair} size={22} color={colors.warning} />
            </View>
          ) : (
            <ExerciseAnimation
              frames={info.frames}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              accessibilityLabel={info.name}
            />
          )}
          <View className="flex-1">
            <Text className="font-semibold text-foreground" numberOfLines={1}>
              {exercise.type === 'rest' ? t('session.restBlock') : info.name}
            </Text>
            {exercise.type !== 'rest' && (
              <Text className="text-xs text-subtle">
                {exercise.sets} × {exercise.reps}
                {exercise.weight ? ` · ${convertWeight(exercise.weight).formatted} ${units.weight}` : ''}
                {exercise.executionTime ? ` · ${clock(exercise.executionTime)}` : ''}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/** The sets of this exercise done so far. */
function LoggedSets({ session, block }: { session: WorkoutSession; block: Exercise }) {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const done = session.sets.filter((s) => s.blockId === block.id).sort((a, b) => a.setIndex - b.setIndex);
  if (done.length === 0) return null;
  return (
    <View className="mt-4">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
        {t('player.doneSets')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {done.map((s) => (
          <Pressable
            key={s.id}
            onLongPress={() => useSessionStore.getState().removeSet(session.id, s.id)}
            accessibilityRole="button"
            accessibilityLabel={t('session.undoSetA11y', { n: s.setIndex + 1 })}
            accessibilityHint={t('player.undoHint')}
            className="flex-row items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5"
          >
            <Icon icon={Check} size={13} color={colors['success-text']} />
            <Text className="text-sm font-semibold text-foreground">
              {s.reps ?? '–'}
              {s.weightKg ? ` × ${convertWeight(s.weightKg).formatted} ${units.weight}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CompleteCard({
  session,
  onFinish,
  onAdd,
}: {
  session: WorkoutSession;
  onFinish: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="items-center rounded-3xl border border-success/40 bg-success/10 p-6">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-success">
        <Icon icon={Check} size={28} color={colors.background} />
      </View>
      <Text className="mt-3 text-2xl font-bold text-foreground">{t('player.complete')}</Text>
      <Text className="mt-1 text-center text-muted">
        {t('session.finishMessage', { count: session.sets.length })}
      </Text>
      <Button label={t('session.finish')} size="lg" className="mt-5 w-full" onPress={onFinish} />
      <Button
        label={t('workouts.addExercise')}
        variant="ghost"
        className="mt-2"
        icon={<Icon icon={Plus} size={16} />}
        onPress={onAdd}
      />
    </View>
  );
}

function Controls({
  paused,
  timed,
  disabled,
  sound,
  onBack,
  onToggle,
  onSkip,
  onAdd,
  onSound,
}: {
  paused: boolean;
  timed: boolean;
  disabled: boolean;
  sound: boolean;
  onBack: () => void;
  onToggle: () => void;
  onSkip: () => void;
  onAdd: () => void;
  onSound: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="border-t border-border bg-background px-4 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      <MusicBar />
      <View className="mt-2 flex-row items-center justify-between">
        <IconButton
          icon={sound ? Volume2 : VolumeX}
          variant="ghost"
          accessibilityLabel={sound ? t('player.soundOff') : t('player.soundOn')}
          onPress={onSound}
        />
        <IconButton
          icon={SkipBack}
          variant="ghost"
          iconSize={26}
          disabled={disabled}
          accessibilityLabel={t('player.back')}
          onPress={onBack}
        />
        <Pressable
          onPress={onToggle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={paused ? t('player.resume') : t('player.pause')}
          className={cn(
            'h-16 w-16 items-center justify-center rounded-full bg-primary active:opacity-80',
            disabled && 'opacity-40',
          )}
        >
          <Icon
            icon={paused ? Play : Pause}
            size={28}
            color={colors['primary-foreground']}
            fill={colors['primary-foreground']}
          />
        </Pressable>
        <IconButton
          icon={SkipForward}
          variant="ghost"
          iconSize={26}
          disabled={disabled}
          accessibilityLabel={t('player.skip')}
          onPress={onSkip}
        />
        <Pressable
          onPress={onAdd}
          disabled={!timed || disabled}
          accessibilityRole="button"
          accessibilityLabel={t('player.add15A11y')}
          className={cn(
            'h-11 min-w-11 items-center justify-center rounded-full px-2',
            (!timed || disabled) && 'opacity-30',
          )}
        >
          <Text className="text-sm font-bold text-primary-text">+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}
