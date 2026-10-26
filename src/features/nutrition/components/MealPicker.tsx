import { useTranslation } from 'react-i18next';
import { MEAL_TYPES, type MealType } from '@/features/nutrition/nutritionStore';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

export function MealPicker({ value, onChange }: { value: MealType; onChange: (meal: MealType) => void }) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      size="sm"
      value={value}
      onChange={onChange}
      segments={MEAL_TYPES.map((m) => ({ value: m, label: t(`meals.${m}`) }))}
    />
  );
}
