import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/shared/ui/IconButton';

/** Entry point to the (upcoming) AI coach. */
export function AiButton() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <IconButton
      icon={Sparkles}
      variant="ai"
      filled
      iconSize={20}
      accessibilityLabel={t('dashboard.aiChat')}
      onPress={() => router.push('/chat')}
    />
  );
}
