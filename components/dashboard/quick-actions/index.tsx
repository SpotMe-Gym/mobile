import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

interface ActionButtonRenderProps extends WidgetRenderProps {
  labelKey: string;
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
        className="flex-1 w-full h-full bg-zinc-800 rounded-2xl"
        onPress={() => router.push(href)}
      />
    </View>
  );
}

function LogMealRender(props: WidgetRenderProps) {
  return <ActionButtonRender {...props} labelKey="dashboard.logMeal" href="/nutrition/search" />;
}

function AddWeightRender(props: WidgetRenderProps) {
  return <ActionButtonRender {...props} labelKey="dashboard.addWeight" href="/body-weight" />;
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
