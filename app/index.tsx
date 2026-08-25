import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Sparkles, Plus } from 'lucide-react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUserStore } from '@/store/userStore';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { lightImpact } from '@/lib/haptics';

import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useUserStore(s => s.name);
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const enterEdit = () => {
    if (isEditing) return;
    lightImpact();
    setIsEditing(true);
  };

  const exitEdit = () => {
    setIsEditing(false);
    setAddSheetOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="mb-6 flex-row justify-between items-center relative">
          <Pressable
            onPress={() => router.push('/profile')}
            className="h-11 w-11 bg-zinc-800 rounded-full items-center justify-center border border-zinc-700 z-10"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-white font-bold">{name ? name[0].toUpperCase() : 'U'}</Text>
          </Pressable>

          <View className="absolute left-0 right-0 items-center">
            <Text className="text-white text-xl font-black italic tracking-tighter">SPOTME</Text>
          </View>

          {isEditing ? (
            <Button
              size="icon"
              variant="secondary"
              icon={<Icon icon={Plus} size={22} color="white" />}
              onPress={() => setAddSheetOpen(true)}
              accessibilityLabel={t('dashboard.editAddCard')}
              className="z-10"
            />
          ) : (
            <Button
              size="icon"
              variant="ai"
              icon={<Icon icon={Sparkles} size={20} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />}
              onPress={() => router.push('/chat')}
              accessibilityLabel={t('dashboard.aiChat')}
              className="z-10"
            />
          )}
        </View>

        <View className="mb-6 flex-row justify-between items-end">
          <View className="flex-1 pr-4">
            <Text className="text-textSecondary text-sm font-medium">{t('common.monday')}, {t('common.jan')} 19</Text>
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit>
              {t('common.hello')}, {name || t('common.user')}
            </Text>
          </View>
          {isEditing && (
            <Button
              size="sm"
              variant="white"
              label={t('dashboard.editDone')}
              onPress={exitEdit}
              className="mb-1"
            />
          )}
        </View>

        <DashboardGrid
          isEditing={isEditing}
          onEnterEdit={enterEdit}
          addSheetOpen={addSheetOpen}
          onAddSheetOpenChange={setAddSheetOpen}
        />

        <Button
          variant="ghost"
          label={isEditing ? t('dashboard.editDone') : t('dashboard.editLayout')}
          onPress={isEditing ? exitEdit : enterEdit}
          className="w-full mt-6"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
