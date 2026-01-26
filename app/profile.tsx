import { View, Text, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { Card } from '../components/ui/Card';
import { Settings, ChevronRight, ChevronLeft, User, Hash, Ruler, Weight, Languages } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUnitConverter } from '@/hooks/useUnitConverter';

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { name, age } = useUserStore();
  const { currentWeight, currentHeight } = useUnitConverter();

  const settingsItems = [
    { icon: User, label: t('settings.accountDetails'), path: null },
    { icon: Hash, label: t('settings.units'), path: '/settings/units' },
    { icon: Languages, label: t('settings.language'), path: '/settings/language' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-zinc-800 p-1.5 rounded-full">
              <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-white">{t('tabs.profile')}</Text>
          </View>
          <TouchableOpacity>
            <Settings color="white" size={24} />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <View className="flex-row items-center mb-8">
          <View className="h-20 w-20 bg-zinc-800 rounded-full items-center justify-center border border-zinc-700 mr-4">
            <Text className="text-white text-3xl font-bold">{name ? name[0].toUpperCase() : 'U'}</Text>
          </View>
          <View>
            <Text className="text-white text-xl font-bold">{name || 'User'}</Text>
            <Text className="text-zinc-500">Premium Member</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <Text className="text-white text-lg font-bold mb-4">{t('dashboard.bodyWeight')} & Stats</Text>
        <View className="flex-row gap-3 mb-8">
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Weight color="#3b82f6" size={24} />
            <Text className="text-white text-xl font-bold mt-2">{currentWeight.formatted}</Text>
            <Text className="text-zinc-500 text-xs">{currentWeight.unit}</Text>
          </Card>
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Ruler color="#f97316" size={24} />
            <Text className="text-white text-xl font-bold mt-2">{currentHeight.formatted}</Text>
            <Text className="text-zinc-500 text-xs">{currentHeight.unit}</Text>
          </Card>
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Hash color="#22c55e" size={24} />
            <Text className="text-white text-xl font-bold mt-2">{age || '--'}</Text>
            <Text className="text-zinc-500 text-xs">Age</Text>
          </Card>
        </View>

        {/* Settings List */}
        <Text className="text-white text-lg font-bold mb-4">{t('settings.appPreferences')}</Text>
        <View className="bg-zinc-900 rounded-2xl overflow-hidden mb-10">
          {settingsItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => item.path && router.push(item.path as any)}
              className={`flex-row items-center justify-between p-4 ${i !== settingsItems.length - 1 ? 'border-b border-zinc-800' : ''}`}
            >
              <View className="flex-row items-center">
                <item.icon size={20} color="white" />
                <Text className="text-white ml-3 font-medium">{item.label}</Text>
              </View>
              <ChevronRight size={20} color="#52525B" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Reset Data Button */}
        <TouchableOpacity
          onPress={() => {
            const { resetUser } = useUserStore.getState();
            Alert.alert(
              "Reset Data",
              "Are you sure you want to clear all data and restart onboarding?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  style: "destructive",
                  onPress: () => {
                    resetUser();
                    router.replace('/onboarding');
                  }
                }
              ]
            );
          }}
          className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl items-center mb-10"
        >
          <Text className="text-red-500 font-bold">Reset All Data</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
