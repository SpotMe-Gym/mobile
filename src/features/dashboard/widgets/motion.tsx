import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

/** Door to Motion Lab: film your execution, or analyse a machine's resistance profile. */
function MotionLabRender({ size, onPressIn, onPressOut }: WidgetRenderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => router.push('/motion')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={t('motion.card')}
      className="h-full w-full flex-1 flex-row items-center rounded-2xl border border-border bg-surface px-4 active:opacity-70"
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
        <Icon icon={ScanLine} size={22} color={colors['primary-text']} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {t('motion.card')}
        </Text>
        {size === 'full' && (
          <Text className="text-sm text-subtle" numberOfLines={1}>
            {t('motion.cardHint')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const motionLabAction: WidgetDefinition = {
  id: 'motionLab',
  kind: 'action',
  category: 'training',
  sizes: ['full', 'half'],
  defaultSize: 'full',
  unique: true,
  defaultOnHome: true,
  titleKey: 'motion.card',
  gestureMode: 'inner',
  Render: MotionLabRender,
};
