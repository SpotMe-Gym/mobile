import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen, useTopInset } from '@/shared/components/SafeScreen';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Plus, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { lightImpact } from '@/shared/lib/haptics';
import { ExerciseAnimation } from '@/features/exercises/components/ExerciseAnimation';
import {
  frameUrls,
  GROUP_ORDER,
  MUSCLE_GROUPS,
  searchExercises,
  type LibraryExercise,
  type MuscleGroup,
} from '@/features/exercises/library';
import { useCustomExerciseStore, type CustomExercise } from '@/features/exercises/customExerciseStore';
import { useExercisePicker } from '@/features/exercises/pickerStore';

type Row = { kind: 'custom'; item: CustomExercise } | { kind: 'library'; item: LibraryExercise };

const EQUIPMENT = [
  'body only',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebells',
  'bands',
  'other',
] as const;

export default function ExercisePicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheetTop = useTopInset(true);
  const { t } = useTranslation();
  const onPick = useExercisePicker((s) => s.onPick);
  const customs = useCustomExerciseStore((s) => s.exercises);
  const addCustom = useCustomExerciseStore((s) => s.add);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [preview, setPreview] = useState<LibraryExercise | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const mine = customs
      .filter(
        (c) =>
          (!q || c.name.toLowerCase().includes(q)) &&
          (!group || c.muscles.some((m) => (MUSCLE_GROUPS[group] as readonly string[]).includes(m))),
      )
      .map((item) => ({ kind: 'custom' as const, item }));
    const lib = searchExercises(query, { group: group ?? undefined }).map((item) => ({
      kind: 'library' as const,
      item,
    }));
    return [...mine, ...lib];
  }, [query, group, customs]);

  const pick = (exerciseId: string, name: string) => {
    lightImpact();
    onPick?.({ exerciseId, name });
    useExercisePicker.setState({ onPick: null });
    router.back();
  };

  const muscleNames = (muscles: readonly string[]) =>
    muscles
      .map((m) => t(`exercises.muscles.${m.replace(' ', '_')}` as never, { defaultValue: m }))
      .join(', ');

  return (
    <SafeScreen className="flex-1 bg-background" edges={['top']} sheet>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('exercises.pick')} className="mt-4" />
        <View className="h-12 flex-row items-center rounded-2xl border border-border bg-surface px-3">
          <Icon icon={Search} size={18} color={colors.subtle} />
          <TextInput
            className="ml-2 h-full flex-1 text-base text-foreground"
            placeholder={t('exercises.searchPlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('exercises.searchPlaceholder')}
          />
          {query.length > 0 && (
            <IconButton
              icon={X}
              variant="ghost"
              iconSize={16}
              accessibilityLabel={t('common.close')}
              onPress={() => setQuery('')}
            />
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 max-h-12"
          contentContainerStyle={{ gap: 8 }}
        >
          {[null, ...GROUP_ORDER].map((g) => {
            const active = g === group;
            return (
              <Pressable
                key={g ?? 'all'}
                onPress={() => setGroup(g)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={cn(
                  'h-9 justify-center rounded-full border px-4',
                  active ? 'border-primary bg-primary' : 'border-border bg-surface',
                )}
              >
                <Text
                  className={cn('text-sm font-semibold', active ? 'text-primary-foreground' : 'text-muted')}
                >
                  {g ? t(`exercises.groups.${g}`) : t('exercises.all')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mt-3 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(r) => r.item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              <Pressable
                onPress={() => setCreating(true)}
                accessibilityRole="button"
                className="mb-2 flex-row items-center gap-3 rounded-2xl border border-dashed border-border-strong p-3 active:opacity-70"
              >
                <View className="h-14 w-14 items-center justify-center rounded-xl bg-surface-elevated">
                  <Icon icon={Plus} size={20} color={colors['primary-text']} />
                </View>
                <Text className="flex-1 font-semibold text-primary-text" numberOfLines={1}>
                  {query.trim()
                    ? t('exercises.createCustom', { name: query.trim() })
                    : t('exercises.createCustomTitle')}
                </Text>
              </Pressable>
            }
            ListEmptyComponent={
              <Text className="mt-6 text-center text-subtle">{t('exercises.noResults')}</Text>
            }
            renderItem={({ item: row }) => (
              <Pressable
                onPress={() =>
                  row.kind === 'library' ? setPreview(row.item) : pick(row.item.id, row.item.name)
                }
                accessibilityRole="button"
                accessibilityLabel={row.item.name}
                className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-elevated"
              >
                <ExerciseAnimation
                  frames={row.kind === 'library' ? frameUrls(row.item.id) : []}
                  still
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <View className="flex-1">
                  <Text className="font-semibold text-foreground" numberOfLines={2}>
                    {row.item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-subtle" numberOfLines={1}>
                    {row.kind === 'library'
                      ? `${muscleNames(row.item.primary)} · ${t(`exercises.equipment.${row.item.equipment.replace(/[ -]/g, '_')}` as never, { defaultValue: row.item.equipment })}`
                      : `${t('exercises.custom')}${row.item.muscles.length ? ` · ${muscleNames(row.item.muscles)}` : ''}`}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
        <Text className="pb-2 text-center text-[11px] text-subtle">{t('exercises.source')}</Text>
      </View>

      {/* Preview: the exercise moving, its muscles and how to do it. */}
      <Modal
        visible={!!preview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreview(null)}
      >
        {preview && (
          <View className="flex-1 bg-background" style={{ paddingTop: sheetTop }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="mr-3 flex-1 text-2xl font-bold text-foreground">{preview.name}</Text>
                <IconButton
                  icon={X}
                  variant="ghost"
                  accessibilityLabel={t('common.close')}
                  onPress={() => setPreview(null)}
                />
              </View>
              <ExerciseAnimation
                frames={frameUrls(preview.id)}
                style={{ width: '100%', aspectRatio: 1.5, borderRadius: 20 }}
                accessibilityLabel={preview.name}
              />
              <View className="mt-4 flex-row flex-wrap gap-2">
                {preview.primary.map((m) => (
                  <View key={m} className="rounded-full bg-primary/20 px-3 py-1">
                    <Text className="text-xs font-semibold text-primary-text">{muscleNames([m])}</Text>
                  </View>
                ))}
                {preview.secondary.map((m) => (
                  <View key={m} className="rounded-full bg-surface-elevated px-3 py-1">
                    <Text className="text-xs text-muted">{muscleNames([m])}</Text>
                  </View>
                ))}
              </View>
              {preview.instructions.length > 0 && (
                <>
                  <Text className="mb-2 mt-6 text-lg font-bold text-foreground">
                    {t('exercises.instructions')}
                  </Text>
                  {preview.instructions.map((step, i) => (
                    <View key={i} className="mb-2 flex-row gap-3">
                      <Text className="w-5 text-right font-bold text-subtle">{i + 1}</Text>
                      <Text className="flex-1 leading-5 text-muted">{step}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <View
              className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-4 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <Button
                label={t('exercises.add')}
                size="lg"
                className="w-full rounded-2xl"
                onPress={() => {
                  const p = preview;
                  setPreview(null);
                  pick(p.id, p.name);
                }}
              />
            </View>
          </View>
        )}
      </Modal>

      <CustomExerciseSheet
        visible={creating}
        initialName={query.trim()}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          const created = addCustom(input);
          setCreating(false);
          pick(created.id, created.name);
        }}
      />
    </SafeScreen>
  );
}

function CustomExerciseSheet({
  visible,
  initialName,
  onClose,
  onCreate,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onCreate: (input: { name: string; muscles: string[]; equipment?: string }) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetTop = useTopInset(true);
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => setName(initialName)}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ paddingTop: sheetTop }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">{t('exercises.createCustomTitle')}</Text>
            <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
          </View>
          <Text className="mb-1 ml-1 text-xs font-medium uppercase text-muted">
            {t('exercises.customName')}
          </Text>
          <TextInput
            className="rounded-2xl border border-border bg-surface p-4 text-lg font-semibold text-foreground"
            value={name}
            onChangeText={setName}
            placeholder={t('exercises.customName')}
            placeholderTextColor={colors.placeholder}
            maxLength={80}
            accessibilityLabel={t('exercises.customName')}
          />
          <Text className="mb-2 ml-1 mt-5 text-xs font-medium uppercase text-muted">
            {t('exercises.muscleGroup')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GROUP_ORDER.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGroup(g === group ? null : g)}
                accessibilityRole="radio"
                accessibilityState={{ checked: g === group }}
                className={cn(
                  'h-9 justify-center rounded-full border px-4',
                  g === group ? 'border-primary bg-primary' : 'border-border bg-surface',
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-semibold',
                    g === group ? 'text-primary-foreground' : 'text-muted',
                  )}
                >
                  {t(`exercises.groups.${g}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-2 ml-1 mt-5 text-xs font-medium uppercase text-muted">
            {t('exercises.equipmentLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEquipment(e === equipment ? null : e)}
                accessibilityRole="radio"
                accessibilityState={{ checked: e === equipment }}
                className={cn(
                  'h-9 justify-center rounded-full border px-4',
                  e === equipment ? 'border-primary bg-primary' : 'border-border bg-surface',
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-semibold',
                    e === equipment ? 'text-primary-foreground' : 'text-muted',
                  )}
                >
                  {t(`exercises.equipment.${e.replace(/[ -]/g, '_')}` as never, { defaultValue: e })}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={t('exercises.save')}
            size="lg"
            className="mt-8 w-full rounded-2xl"
            disabled={name.trim().length === 0}
            onPress={() =>
              onCreate({
                name,
                muscles: group ? [...MUSCLE_GROUPS[group]].slice(0, 1) : [],
                equipment: equipment ?? undefined,
              })
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
