import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '@/shared/components/SafeScreen';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { AiButton } from '@/shared/components/AiButton';
import { DashboardGrid, type GridScroll } from '@/features/dashboard/components/DashboardGrid';
import { useUserStore } from '@/features/profile/userStore';
import { useToday } from '@/shared/hooks/useToday';
import { formatDayKey } from '@/shared/utils/date';
import { lightImpact } from '@/shared/lib/haptics';
import { TOUCH_SIZE_CLASS } from '@/shared/lib/platform';
import { cn } from '@/shared/lib/cn';

// A gesture-handler scroll view: a card being dragged in edit mode cancels the page scroll
// instead of racing it; Animated so a dragged card can scroll the page from the UI thread.
const PageScroll = Animated.createAnimatedComponent(GestureScrollView);

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useUserStore((s) => s.name);
  const { t, i18n } = useTranslation();
  const today = useToday();
  const dateLabel = useMemo(
    () => formatDayKey(today, i18n.language, { weekday: 'long', month: 'short', day: 'numeric' }),
    [today, i18n.language],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  const scrollRef = useAnimatedRef<GestureScrollView>();
  const offset = useSharedValue(0);
  const viewportTop = useSharedValue(insets.top);
  const viewportBottom = useSharedValue(windowHeight - insets.bottom);
  const contentHeight = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    offset.set(e.contentOffset.y);
    contentHeight.set(e.contentSize.height);
  });
  const gridScroll: GridScroll = useMemo(
    () => ({ ref: scrollRef, offset, viewportTop, viewportBottom, contentHeight }),
    [scrollRef, offset, viewportTop, viewportBottom, contentHeight],
  );

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
    <SafeScreen className="flex-1 bg-background" edges={['top']}>
      <PageScroll
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEnabled={!isDraggingWidget}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewportBottom.set(viewportTop.value + e.nativeEvent.layout.height);
        }}
        onContentSizeChange={(_w, h) => contentHeight.set(h)}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Backdrop sits under the content and fills the page; rows and the grid let taps on
            empty space through (box-none), so any tap that misses a card or control lands
            here and finishes editing. */}
        {isEditing && (
          <Pressable
            onPress={exitEdit}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.editDone')}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View pointerEvents="box-none" className="relative mb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.openProfile')}
            className={cn(
              TOUCH_SIZE_CLASS,
              'z-10 items-center justify-center rounded-full border border-border-strong bg-surface-elevated active:opacity-70',
            )}
            hitSlop={8}
          >
            <Text className="font-bold text-foreground">{name ? name[0]?.toUpperCase() : 'U'}</Text>
          </Pressable>

          <View className="absolute left-0 right-0 items-center" pointerEvents="none">
            <Text
              accessibilityRole="header"
              className="text-xl font-black italic tracking-tighter text-foreground"
            >
              SPOTME
            </Text>
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

        <View pointerEvents="box-none" className="mb-6 flex-row items-end justify-between">
          <View pointerEvents="box-none" className="flex-1 pr-4">
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
          scroll={gridScroll}
        />

        <Button
          variant="ghost"
          label={isEditing ? t('dashboard.editDone') : t('dashboard.editLayout')}
          onPress={isEditing ? exitEdit : enterEdit}
          className="mt-6 w-full"
        />
      </PageScroll>
    </SafeScreen>
  );
}
