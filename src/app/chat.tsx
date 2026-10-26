import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';

export default function Chat() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-surface-sunken" edges={['top']}>
      <View className="px-4">
        <ScreenHeader title={t('chat.title')} />
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Icon icon={Sparkles} size={48} color={colors.accent} />
        <Text className="mt-4 text-xl font-bold text-foreground">{t('chat.title')}</Text>
        <Text className="mt-2 text-center text-base text-subtle">{t('chat.comingSoon')}</Text>
      </View>
    </SafeAreaView>
  );
}
