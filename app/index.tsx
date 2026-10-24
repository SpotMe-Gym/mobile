import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { AiButton } from '@/components/AiButton';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { useUserStore } from '@/store/userStore';
import { useToday } from '@/hooks/useToday';
import { formatDayKey } from '@/utils/date';
import { lightImpact } from '@/lib/haptics';
import { TOUCH_SIZE_CLASS } from '@/lib/platform';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useUserStore(s => s.name);
  const { t, i18n } = useTranslation();
  const today = useToday();
  const dateLabel = useMemo(
    () => formatDayKey(today, i18n.language, { weekday: 'long', month: 'short', day: 'numeric' }),
    [today, i18n.language],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);

  const enterEdit = () => {
    if (isEditing) return;
    lightImpact();
    setIsEditing(true);
  };

  const exitEdit = () => {
    setIsEditing(false);
    setAddSheetOpen(false);
    setIsDraggingWidget(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-2"
        scrollEnabled={!isDraggingWidget}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Backdrop sits under the content, so only taps that miss a card or
            control reach it and leave edit mode. */}
        {isEditing && (
          <Pressable
            onPress={exitEdit}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.editDone')}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View className="mb-6 flex-row justify-between items-center relative">
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.openProfile')}
            className={cn(TOUCH_SIZE_CLASS, 'z-10 items-center justify-center rounded-full border border-border-strong bg-surface-elevated active:opacity-70')}
            hitSlop={8}
          >
            <Text className="font-bold text-foreground">{name ? name[0]?.toUpperCase() : 'U'}</Text>
          </Pressable>

          <View className="absolute left-0 right-0 items-center" pointerEvents="none">
            <Text accessibilityRole="header" className="text-xl font-black italic tracking-tighter text-foreground">SPOTME</Text>
          </View>

          {isEditing ? (
            <IconButton
              icon={Plus}
              accessibilityLabel={t('dashboard.editAddCard')}
              onPress={() => setAddSheetOpen(true)}
              className="z-10"
            />
          ) : (
            <AiButton />
          )}
        </View>

        <View className="mb-6 flex-row justify-between items-end">
          <View className="flex-1 pr-4">
            <Text className="text-sm font-medium capitalize text-muted">{dateLabel}</Text>
            <Text className="text-3xl font-bold text-foreground" numberOfLines={2}>
              {t('common.greeting', { name: name || t('common.user') })}
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
          onDraggingChange={setIsDraggingWidget}
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
