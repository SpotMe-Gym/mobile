import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

interface ActionButtonProps {
  label: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
}

/** The quick-action bar. Also rendered as the expand preview, so the two always match. */
export function ActionButton({ label, onPress, onPressIn, onPressOut }: ActionButtonProps) {
  return (
    <View className="flex-1">
      <Button
        label={label}
        variant="secondary"
        className="h-full w-full flex-1 rounded-2xl"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />
    </View>
  );
}

function LogMealRender({ onPressIn, onPressOut }: WidgetRenderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  // Food search is a native full-screen modal: it slides up rather than expanding.
  return (
    <ActionButton
      label={t('dashboard.logMeal')}
      onPress={() => router.push('/nutrition/search')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  );
}

function AddWeightRender({ onOpenDetail, onPressIn, onPressOut }: WidgetRenderProps) {
  const { t } = useTranslation();
  // Expands from this button into the weight screen; the log sheet opens once it has landed.
  return (
    <ActionButton
      label={t('dashboard.addWeight')}
      onPress={onOpenDetail}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  );
}

export const logMealAction: WidgetDefinition = {
  id: 'logMeal',
  kind: 'action',
  category: 'general',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.logMeal',
  gestureMode: 'inner',
  Render: LogMealRender,
};

export const addWeightAction: WidgetDefinition = {
  id: 'addWeight',
  kind: 'action',
  category: 'general',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.addWeight',
  detailPath: '/body-weight',
  detailParams: { add: '1' },
  gestureMode: 'inner',
  Render: AddWeightRender,
};
