import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useUserStore } from '../../store/userStore';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function UnitsSettings() {
  const router = useRouter();
  const { t } = useTranslation();
  const { units, setWeightUnit, setHeightUnit } = useUserStore();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('settings.units')} />

        <ScrollView>
          {/* Weight Section */}
          <Text className="text-zinc-400 font-medium mb-3 ml-1">{t('settings.weight')}</Text>
          <View className="bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800">
            <TouchableOpacity
              onPress={() => setWeightUnit('kg')}
              className="flex-row items-center justify-between p-5 border-b border-zinc-800 active:bg-zinc-800/50"
            >
              <View>
                <Text className="text-white text-lg font-semibold">{t('settings.metric')}</Text>
                <Text className="text-zinc-500">kg</Text>
              </View>
              {units.weight === 'kg' && (
                <View className="bg-blue-600 h-8 w-8 rounded-full items-center justify-center">
                  <Check size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setWeightUnit('lbs')}
              className="flex-row items-center justify-between p-5 active:bg-zinc-800/50"
            >
              <View>
                <Text className="text-white text-lg font-semibold">{t('settings.imperial')}</Text>
                <Text className="text-zinc-500">lbs</Text>
              </View>
              {units.weight === 'lbs' && (
                <View className="bg-blue-600 h-8 w-8 rounded-full items-center justify-center">
                  <Check size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Height Section */}
          <Text className="text-zinc-400 font-medium mb-3 ml-1">{t('settings.height')}</Text>
          <View className="bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800">
            <TouchableOpacity
              onPress={() => setHeightUnit('cm')}
              className="flex-row items-center justify-between p-5 border-b border-zinc-800 active:bg-zinc-800/50"
            >
              <View>
                <Text className="text-white text-lg font-semibold">{t('settings.metric')}</Text>
                <Text className="text-zinc-500">cm</Text>
              </View>
              {units.height === 'cm' && (
                <View className="bg-blue-600 h-8 w-8 rounded-full items-center justify-center">
                  <Check size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setHeightUnit('ft')}
              className="flex-row items-center justify-between p-5 active:bg-zinc-800/50"
            >
              <View>
                <Text className="text-white text-lg font-semibold">{t('settings.imperial')}</Text>
                <Text className="text-zinc-500">ft</Text>
              </View>
              {units.height === 'ft' && (
                <View className="bg-blue-600 h-8 w-8 rounded-full items-center justify-center">
                  <Check size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
