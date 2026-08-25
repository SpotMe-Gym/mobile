import { View, Text } from 'react-native';
import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/Card';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

function RecentActivityRender({ size }: WidgetRenderProps) {
  const { t } = useTranslation();
  const count = size === 'compact' ? 1 : size === 'half' ? 2 : 3;

  return (
    <View className="flex-1 overflow-hidden rounded-2xl">
      <Card className="flex-1 w-full h-full" title={t('dashboard.recentActivity')}>
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            className="flex-row justify-between items-center py-3 border-b border-zinc-800 last:border-0"
          >
            <View className="flex-row items-center flex-1 pr-2">
              <View className="h-8 w-8 rounded-full bg-zinc-800 items-center justify-center mr-3">
                <Play size={8} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium" numberOfLines={1}>{t('dashboard.pullDay')}</Text>
                <Text className="text-zinc-500 text-xs">{t('dashboard.yesterday')}</Text>
              </View>
            </View>
            {size !== 'compact' && (
              <Text className="text-zinc-400 text-sm">{t('dashboard.completed')}</Text>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

export const recentActivityWidget: WidgetDefinition = {
  id: 'recentActivity',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'full',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.recentActivity',
  gestureMode: 'wrapper',
  Render: RecentActivityRender,
};
