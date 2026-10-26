import { memo, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { MEAL_TYPES, useNutritionStore, type LogEntry, type MealType } from '@/features/nutrition/nutritionStore';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';
import type { DayKey } from '@/shared/utils/date';

interface MealListProps {
  entries: LogEntry[];
  day: DayKey;
}

export const MealList = memo(function MealList({ entries, day }: MealListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const removeEntry = useNutritionStore((s) => s.removeEntry);

  const openSearch = useCallback(
    (meal: MealType) => router.push({ pathname: '/nutrition/search', params: { meal } }),
    [router],
  );

  return (
    <View className="pb-10">
      {MEAL_TYPES.map((meal) => {
        const items = entries.filter((e) => e.meal === meal);
        const mealKcal = items.reduce((acc, e) => acc + e.macros.kcal, 0);
        const mealName = t(`meals.${meal}`);
        return (
          <View key={meal} className="mb-6">
            <View className="mb-2 flex-row items-center justify-between px-1">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {mealName}
              </Text>
              <Text className="text-sm text-muted">
                {t('common.kcalValue', { value: Math.round(mealKcal) })}
              </Text>
            </View>

            {items.length === 0 ? (
              <Card className="items-center border border-dashed border-border py-6">
                <Text className="mb-2 text-subtle">{t('food.noFoodLoggedYet')}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Plus} size={16} color={colors['primary-text']} />}
                  label={t('food.addItemTo', { meal: mealName })}
                  textClassName="text-primary-text"
                  onPress={() => openSearch(meal)}
                />
              </Card>
            ) : (
              <View className="gap-2">
                {items.map((entry) => (
                  <MealEntryRow key={entry.id} entry={entry} onDelete={() => removeEntry(day, entry.id)} />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Icon icon={Plus} size={16} color={colors['primary-text']} />}
                  label={t('food.addItemTo', { meal: mealName })}
                  onPress={() => openSearch(meal)}
                  className="mt-2 border-dashed bg-surface-elevated/50"
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
});

const MealEntryRow = memo(function MealEntryRow({
  entry,
  onDelete,
}: {
  entry: LogEntry;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const f = (n: number) => formatNumber(n, i18n.language, 0);
  const portion =
    entry.unit === 'portion'
      ? null
      : entry.unit === 'serving'
        ? t('food.servingsCount', { count: entry.quantity })
        : `${formatNumber(entry.quantity, i18n.language, 1)} ${t(`food.units.${entry.unit}`)}`;

  const confirmDelete = () =>
    Alert.alert(t('food.deleteEntryTitle'), t('food.deleteEntryMessage', { name: entry.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Card className="flex-row items-center justify-between border border-border py-3">
      <View className="flex-1 pr-2">
        <Text className="font-medium text-foreground" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text className="text-xs text-subtle">
          {[
            portion,
            t('common.kcalValue', { value: f(entry.macros.kcal) }),
            t('food.macroLine', {
              protein: f(entry.macros.protein),
              carbs: f(entry.macros.carbs),
              fat: f(entry.macros.fat),
            }),
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>
      <IconButton
        icon={Trash2}
        variant="danger"
        iconSize={18}
        accessibilityLabel={t('food.deleteEntryA11y', { name: entry.name })}
        onPress={confirmDelete}
      />
    </Card>
  );
});
