import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Check } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ScreenHeader';

const LANGUAGES = [
  { code: 'en', labelKey: 'settings.english' },
  { code: 'it', labelKey: 'settings.italian' },
];

export default function LanguageSettings() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('settings.language')} />

        <ScrollView>
          <Text className="text-zinc-400 font-medium mb-3 ml-1">{t('settings.selectLanguage')}</Text>
          <View className="bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800">
            {LANGUAGES.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                className={`flex-row items-center justify-between p-5 active:bg-zinc-800/50 ${index !== LANGUAGES.length - 1 ? 'border-b border-zinc-800' : ''
                  }`}
              >
                <View>
                  <Text className="text-white text-lg font-semibold">{t(lang.labelKey)}</Text>
                  <Text className="text-zinc-500 uppercase">{lang.code}</Text>
                </View>
                {i18n.language.startsWith(lang.code) && (
                  <View className="bg-blue-600 h-8 w-8 rounded-full items-center justify-center">
                    <Check size={16} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
