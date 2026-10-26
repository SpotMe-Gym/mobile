import { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Armchair, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { ExerciseEditorCard } from '@/features/workouts/components/ExerciseEditorCard';
import {
  workoutFormSchema,
  type ExerciseFormValues,
  type WorkoutFormValues,
} from '@/features/workouts/workoutSchema';
import { calculateDuration, scheduledDays, useWorkoutStore, type Exercise } from '@/features/workouts/workoutStore';
import { ISO_WEEKDAYS, weekdayLabel, type IsoWeekday } from '@/shared/utils/date';
import { newId } from '@/shared/lib/ids';
import { successFeedback } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';

const newExercise = (): ExerciseFormValues => ({
  id: newId(),
  name: '',
  sets: 3,
  reps: '10',
  restTime: 60,
  executionTime: 45,
  type: 'exercise',
});
const newRest = (): ExerciseFormValues => ({
  id: newId(),
  name: '',
  sets: 0,
  reps: '',
  restTime: 120,
  executionTime: 0,
  type: 'rest',
});

export default function CreateWorkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;

  const existing = useWorkoutStore((s) => (editId ? s.workouts.find((w) => w.id === editId) : undefined));
  const schedule = useWorkoutStore((s) => s.schedule);
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);

  const { control, handleSubmit, setValue, formState } = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues: {
      name: existing?.name ?? '',
      days: existing ? scheduledDays(schedule, existing.id) : [],
      exercises: existing?.exercises ?? [newExercise()],
    },
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'exercises', keyName: 'fieldKey' });

  // Unsaved-changes guard: confirm before leaving a dirty form (swipe, back button, ✕).
  // Leaving is a two-step dance: turn prevention off (state), then run the pending navigation
  // once that render has committed.
  const [leaveWith, setLeaveWith] = useState<(() => void) | null>(null);
  usePreventRemove(formState.isDirty && leaveWith === null, ({ repeat }) => {
    Alert.alert(t('workouts.discardTitle'), t('workouts.discardMessage'), [
      { text: t('workouts.keepEditing'), style: 'cancel' },
      { text: t('workouts.discard'), style: 'destructive', onPress: () => setLeaveWith(() => repeat) },
    ]);
  });
  useEffect(() => {
    leaveWith?.();
  }, [leaveWith]);

  const save = handleSubmit(
    (v) => {
      const exercises: Exercise[] = v.exercises
        .filter((e) => e.type === 'rest' || e.name.length > 0)
        .map((e) => ({
          ...e,
          name: e.type === 'rest' ? '' : e.name,
          sets: e.type === 'rest' ? 0 : Math.max(1, e.sets),
        }));
      const days = v.days as IsoWeekday[];
      const data = { name: v.name, exercises, duration: calculateDuration(exercises) };
      if (editId && existing) updateWorkout(editId, data, days);
      else addWorkout({ id: newId(), ...data }, days);
      successFeedback();
      setLeaveWith(() => () => router.back());
    },
    (errors) => {
      const message = errors.name ? t('workouts.enterWorkoutName') : t('workouts.addAtLeastOneExercise');
      Alert.alert(t('workouts.cantSave'), message);
    },
  );

  const confirmDelete = () => {
    if (!editId) return;
    Alert.alert(t('workouts.deleteTitle'), t('workouts.deleteMessage', { name: existing?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteWorkout(editId);
          setLeaveWith(() => () => router.back());
        },
      },
    ]);
  };

  const handleMove = useCallback((from: number, to: number) => move(from, to), [move]);
  const handleRemove = useCallback((index: number) => remove(index), [remove]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-4">
          <ScreenHeader
            title={editId ? t('workouts.editWorkout') : t('workouts.newWorkout')}
            className="mt-4"
          />

          {/* The exercise list is bounded (a single workout) and full of focused inputs, so a
              ScrollView is deliberate here — see list-performance rule exceptions. */}
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Text className="mb-1 ml-1 text-xs font-medium uppercase text-muted">
              {t('workouts.workoutName')}
            </Text>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <TextInput
                  className={cn(
                    'rounded-2xl border bg-surface p-4 text-lg font-bold text-foreground',
                    fieldState.error ? 'border-danger' : 'border-border',
                  )}
                  placeholder={t('workouts.workoutNamePlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  accessibilityLabel={t('workouts.workoutName')}
                />
              )}
            />

            <Text accessibilityRole="header" className="mb-4 mt-8 text-lg font-bold text-foreground">
              {t('workouts.weeklySchedule')}
            </Text>
            <Controller
              control={control}
              name="days"
              render={({ field }) => (
                <View className="mb-6 flex-row justify-between">
                  {ISO_WEEKDAYS.map((day) => {
                    const selected = field.value.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() =>
                          field.onChange(
                            selected ? field.value.filter((d) => d !== day) : [...field.value, day],
                          )
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={weekdayLabel(day, i18n.language, 'long')}
                        className={cn(
                          'h-11 w-11 items-center justify-center rounded-full',
                          selected ? 'bg-primary' : 'bg-surface-elevated',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-sm font-bold capitalize',
                            selected ? 'text-primary-foreground' : 'text-muted',
                          )}
                        >
                          {weekdayLabel(day, i18n.language, 'narrow')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />

            <View className="mb-4 flex-row items-end justify-between">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {t('workouts.exercises')}
              </Text>
              {fields.length === 0 && (
                <Text className="text-sm italic text-subtle">{t('workouts.noExercisesYet')}</Text>
              )}
            </View>

            {fields.map((f, index) => (
              <ExerciseEditorCard
                key={f.fieldKey}
                index={index}
                total={fields.length}
                control={control}
                setValue={setValue}
                onMove={handleMove}
                onRemove={handleRemove}
              />
            ))}

            <View className="mb-8 flex-row gap-4">
              <Button
                variant="secondary"
                icon={<Icon icon={Plus} size={18} color={colors.muted} />}
                label={t('workouts.addExercise')}
                onPress={() => append(newExercise())}
                className="flex-1 rounded-2xl py-4"
              />
              <Button
                variant="secondary"
                icon={<Icon icon={Armchair} size={18} color={colors.warning} />}
                label={t('workouts.addRest')}
                onPress={() => append(newRest())}
                className="flex-1 rounded-2xl py-4"
              />
            </View>

            {editId && (
              <Button
                variant="danger"
                label={t('workouts.deleteWorkout')}
                onPress={confirmDelete}
                className="mb-4"
              />
            )}
          </ScrollView>
        </View>

        {/* Always visible: the primary action never hides or becomes an invisible tap target. */}
        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button label={t('workouts.saveWorkout')} size="lg" className="w-full rounded-2xl" onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
