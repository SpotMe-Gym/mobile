import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '@/i18n/keys';
import { Button } from '@/shared/ui/Button';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

interface ActionButtonRenderProps extends WidgetRenderProps {
  labelKey: TranslationKey;
  href: Href;
}

function ActionButtonRender({ labelKey, href }: ActionButtonRenderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <Button
        label={t(labelKey)}
        variant="secondary"
        className="h-full w-full flex-1 rounded-2xl"
        onPress={() => router.push(href)}
      />
    </View>
  );
}

function LogMealRender(props: WidgetRenderProps) {
  return <ActionButtonRender {...props} labelKey="dashboard.logMeal" href="/nutrition/search" />;
}

function AddWeightRender(props: WidgetRenderProps) {
  // Opens the log-weight sheet directly instead of expanding from a card that isn't there.
  return (
    <ActionButtonRender
      {...props}
      labelKey="dashboard.addWeight"
      href={{ pathname: '/body-weight', params: { add: '1' } }}
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
  gestureMode: 'inner',
  Render: AddWeightRender,
};
