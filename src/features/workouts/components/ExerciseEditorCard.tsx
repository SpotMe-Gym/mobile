import { memo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { Armchair, ChevronDown, ChevronUp, Clock, Dumbbell, Minus, Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { cn } from '@/shared/lib/cn';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { DurationField } from '@/features/workouts/components/DurationField';
import { ExerciseAnimation } from '@/features/exercises/components/ExerciseAnimation';
import { resolveExercise } from '@/features/exercises/resolve';
import { requestExercise, type PickedExercise } from '@/features/exercises/pickerStore';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useRouter } from 'expo-router';
import type { WorkoutFormValues } from '@/features/workouts/workoutSchema';

interface ExerciseEditorCardProps {
  index: number;
  total: number;
  control: Control<WorkoutFormValues>;
  setValue: UseFormSetValue<WorkoutFormValues>;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

export const ExerciseEditorCard = memo(function ExerciseEditorCard({
  index,
  total,
  control,
  setValue,
  onMove,
  onRemove,
}: ExerciseEditorCardProps) {
  const { t } = useTranslation();
  const ex = useWatch({ control, name: `exercises.${index}` });
  const [phase1Open, setPhase1Open] = useState(
    () => (ex?.executionTime ?? 0) > 0 || (ex?.executionTime2 ?? 0) > 0,
  );
  const [phase2Open, setPhase2Open] = useState(() => (ex?.executionTime2 ?? 0) > 0);
  if (!ex) return null;

  const opts = { shouldDirty: true } as const;
  const set = {
    executionTime: (v: number) => setValue(`exercises.${index}.executionTime`, v, opts),
    executionName: (v: string | undefined) => setValue(`exercises.${index}.executionName`, v, opts),
    executionTime2: (v: number | undefined) => setValue(`exercises.${index}.executionTime2`, v, opts),
    executionName2: (v: string | undefined) => setValue(`exercises.${index}.executionName2`, v, opts),
  };

  const removePhase1 = () => {
    if (phase2Open) {
      // Phase 2 moves up into slot 1.
      set.executionTime(ex.executionTime2 ?? 0);
      set.executionName(ex.executionName2);
      set.executionTime2(undefined);
      set.executionName2(undefined);
      setPhase2Open(false);
    } else {
      set.executionTime(0);
      set.executionName(undefined);
      setPhase1Open(false);
    }
  };

  const removePhase2 = () => {
    set.executionTime2(undefined);
    set.executionName2(undefined);
    setPhase2Open(false);
  };

  const label =
    ex.type === 'rest'
      ? t('workouts.restPeriod')
      : ex.name || t('workouts.exerciseNumber', { number: index + 1 });

  const reorder = (
    <View className="mr-3 items-center justify-center">
      <IconButton
        icon={ChevronUp}
        variant="ghost"
        iconSize={16}
        iconColor={colors.muted}
        disabled={index === 0}
        accessibilityLabel={t('workouts.moveUp', { name: label })}
        onPress={() => onMove(index, index - 1)}
      />
      <Text className="text-xs font-bold text-subtle">{index + 1}</Text>
      <IconButton
        icon={ChevronDown}
        variant="ghost"
        iconSize={16}
        iconColor={colors.muted}
        disabled={index === total - 1}
        accessibilityLabel={t('workouts.moveDown', { name: label })}
        onPress={() => onMove(index, index + 1)}
      />
    </View>
  );

  if (ex.type === 'rest') {
    return (
      <View className="mb-4 flex-row items-center rounded-2xl border border-border bg-surface/50 p-3">
        {reorder}
        <View className="flex-1 flex-row items-center gap-3">
          <View className="rounded-xl border border-warning/20 bg-warning/10 p-2">
            <Icon icon={Armchair} size={16} color={colors.warning} />
          </View>
          <Text className="mr-auto text-sm font-bold text-muted">{t('workouts.restPeriod')}</Text>
          <Controller
            control={control}
            name={`exercises.${index}.restTime`}
            render={({ field }) => (
              <DurationField
                seconds={field.value}
                onChange={field.onChange}
                label={t('workouts.restPeriod')}
              />
            )}
          />
          <IconButton
            icon={Trash2}
            variant="danger"
            iconSize={16}
            accessibilityLabel={t('workouts.removeItem', { name: label })}
            onPress={() => onRemove(index)}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 flex-row rounded-3xl border border-border bg-surface p-4">
      {reorder}
      <View className="flex-1 gap-4">
        <View className="flex-row items-center gap-3">
          <ExerciseField
            exerciseId={ex.exerciseId}
            name={ex.name}
            onPicked={(picked) => {
              setValue(`exercises.${index}.exerciseId`, picked.exerciseId, opts);
              setValue(`exercises.${index}.name`, picked.name, opts);
            }}
          />
          <IconButton
            icon={Trash2}
            variant="danger"
            iconSize={18}
            accessibilityLabel={t('workouts.removeItem', { name: label })}
            onPress={() => onRemove(index)}
          />
        </View>

        <View className="flex-row gap-3">
          <Controller
            control={control}
            name={`exercises.${index}.sets`}
            render={({ field }) => (
              <View className="flex-1 flex-row items-center justify-between rounded-2xl border border-border bg-surface-sunken p-4">
                <Text className="text-xs font-bold uppercase tracking-widest text-subtle">
                  {t('workouts.sets')}
                </Text>
                <TextInput
                  className="min-w-10 px-2 text-right text-lg font-bold text-foreground"
                  value={field.value ? String(field.value) : ''}
                  onChangeText={(v) =>
                    field.onChange(Math.min(30, parseInt(v.replace(/\D/g, '') || '0', 10)))
                  }
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  selectTextOnFocus
                  accessibilityLabel={t('workouts.sets')}
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name={`exercises.${index}.reps`}
            render={({ field }) => (
              <View className="flex-1 flex-row items-center justify-between rounded-2xl border border-border bg-surface-sunken p-4">
                <Text className="text-xs font-bold uppercase tracking-widest text-subtle">
                  {t('workouts.reps')}
                </Text>
                <TextInput
                  className="min-w-10 px-2 text-right text-lg font-bold text-foreground"
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="10"
                  placeholderTextColor={colors.placeholder}
                  selectTextOnFocus
                  accessibilityLabel={t('workouts.reps')}
                />
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name={`exercises.${index}.weight`}
          render={({ field }) => <WeightField kg={field.value} onChange={field.onChange} />}
        />

        <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
          <Icon icon={Clock} size={16} color={colors.subtle} />
          <Text className="mr-auto text-xs font-bold uppercase tracking-widest text-subtle">
            {t('workouts.rest')}
          </Text>
          <Controller
            control={control}
            name={`exercises.${index}.restTime`}
            render={({ field }) => (
              <DurationField seconds={field.value} onChange={field.onChange} label={t('workouts.rest')} />
            )}
          />
        </View>

        {phase1Open && (
          <Phase
            tone="primary"
            name={ex.executionName}
            seconds={ex.executionTime}
            placeholder={t('workouts.execution')}
            onName={(v) => set.executionName(v)}
            onSeconds={(v) => set.executionTime(v)}
            onRemove={removePhase1}
          />
        )}
        {phase1Open && phase2Open && (
          <Phase
            tone="accent"
            name={ex.executionName2}
            seconds={ex.executionTime2 ?? 0}
            placeholder={t('workouts.altExecution')}
            onName={(v) => set.executionName2(v)}
            onSeconds={(v) => set.executionTime2(v)}
            onRemove={removePhase2}
          />
        )}

        {!(phase1Open && phase2Open) && (
          <Pressable
            onPress={() => {
              if (!phase1Open) {
                setPhase1Open(true);
                if (!ex.executionTime) set.executionTime(45);
              } else {
                setPhase2Open(true);
                if (!ex.executionTime2) set.executionTime2(30);
              }
            }}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-elevated/30 p-3 active:bg-surface-elevated"
          >
            <Icon icon={Plus} size={14} color={colors.subtle} className="mr-2" />
            <Text className="text-sm font-bold text-subtle">{t('workouts.addExecutionTime')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function Phase({
  tone,
  name,
  seconds,
  placeholder,
  onName,
  onSeconds,
  onRemove,
}: {
  tone: 'primary' | 'accent';
  name?: string;
  seconds: number;
  placeholder: string;
  onName: (v: string) => void;
  onSeconds: (v: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={cn(
          'flex-1 flex-row items-center gap-3 rounded-2xl border p-4',
          tone === 'primary' ? 'border-primary/30 bg-primary/10' : 'border-highlight/30 bg-highlight/10',
        )}
      >
        <Icon
          icon={Dumbbell}
          size={16}
          color={tone === 'primary' ? colors['primary-text'] : colors.highlight}
        />
        <TextInput
          className="mr-auto min-w-16 p-0 text-xs font-bold uppercase tracking-widest text-foreground"
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={name ?? ''}
          onChangeText={onName}
          accessibilityLabel={placeholder}
        />
        <DurationField seconds={seconds} onChange={onSeconds} label={name || placeholder} />
      </View>
      <IconButton
        icon={Minus}
        variant="outline"
        iconSize={18}
        iconColor={colors.subtle}
        accessibilityLabel={t('workouts.removePhase', { name: name || placeholder })}
        onPress={onRemove}
      />
    </View>
  );
}

/** The exercise this card is about: photos + name, tap to choose it from the library. */
function ExerciseField({
  exerciseId,
  name,
  onPicked,
}: {
  exerciseId?: string;
  name: string;
  onPicked: (picked: PickedExercise) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const resolved = resolveExercise(exerciseId, name);
  const choose = () => {
    requestExercise(onPicked);
    router.push('/workouts/exercise-picker');
  };
  return (
    <Pressable
      onPress={choose}
      accessibilityRole="button"
      accessibilityLabel={name ? t('exercises.change') : t('exercises.pick')}
      accessibilityHint={name || undefined}
      className="flex-1 flex-row items-center gap-3 active:opacity-70"
    >
      <ExerciseAnimation frames={resolved.frames} still style={{ width: 48, height: 48, borderRadius: 12 }} />
      <View className="flex-1">
        <Text
          className={cn('text-base font-bold', name ? 'text-foreground' : 'text-primary-text')}
          numberOfLines={2}
        >
          {name || t('exercises.pick')}
        </Text>
        <Text className="text-xs text-subtle" numberOfLines={1}>
          {resolved.source === 'free-text' && name ? t('exercises.linkToLibrary') : t('exercises.change')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Target weight, shown in the person's unit and stored in kg. Empty = bodyweight / not set. */
function WeightField({ kg, onChange }: { kg?: number; onChange: (kg: number | undefined) => void }) {
  const { t } = useTranslation();
  const { convertWeight, toKg, units } = useUnitConverter();
  const [text, setText] = useState(() => (kg ? convertWeight(kg).formatted : ''));
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface-sunken p-4">
      <Text className="text-xs font-bold uppercase tracking-widest text-subtle">{t('workouts.weight')}</Text>
      <View className="flex-row items-baseline gap-1">
        <TextInput
          className="min-w-14 px-2 text-right text-lg font-bold text-foreground"
          value={text}
          onChangeText={(v) => {
            const clean = v.replace(',', '.').replace(/[^0-9.]/g, '');
            setText(clean);
            const n = parseFloat(clean);
            onChange(Number.isFinite(n) && n > 0 ? Math.round(toKg(n) * 100) / 100 : undefined);
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={colors.placeholder}
          selectTextOnFocus
          accessibilityLabel={t('workouts.weight')}
        />
        <Text className="text-sm text-subtle">{units.weight}</Text>
      </View>
    </View>
  );
}
