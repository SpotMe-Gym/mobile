import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ListGroup, ListRow } from '@/shared/ui/ListRow';
import { useUserStore, type LanguagePref } from '@/features/profile/userStore';
import { resolveLanguage } from '@/i18n';
import { lightImpact } from '@/shared/lib/haptics';

const OPTIONS: readonly LanguagePref[] = ['system', 'en', 'it'];

export default function LanguageSettings() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const language = useUserStore((s) => s.language);
  const setLanguage = useUserStore((s) => s.setLanguage);

  const label = (pref: LanguagePref) =>
    pref === 'system'
      ? t('settings.systemDefault')
      : pref === 'en'
        ? t('settings.english')
        : t('settings.italian');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('settings.language')} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="mb-3 ml-1 font-medium text-muted">{t('settings.selectLanguage')}</Text>
          <ListGroup>
            {OPTIONS.map((pref, i) => (
              <ListRow
                key={pref}
                title={label(pref)}
                // Each language is named in itself too, so it's findable when the UI is in another one.
                subtitle={
                  pref === 'system'
                    ? label(resolveLanguage('system'))
                    : pref === 'en'
                      ? 'English'
                      : 'Italiano'
                }
                selected={language === pref}
                isLast={i === OPTIONS.length - 1}
                onPress={() => {
                  lightImpact();
                  setLanguage(pref);
                }}
              />
            ))}
          </ListGroup>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
