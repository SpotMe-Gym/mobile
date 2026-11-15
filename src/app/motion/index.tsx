import { ScrollView, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, ChevronRight, Cog, ScanLine, type LucideIcon } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SafeScreen } from '@/shared/components/SafeScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';
import { formatDayKey, toDayKey } from '@/shared/utils/date';
import { useMotionStore, type MotionRecord } from '@/features/motion/motionStore';
import { motionAvailable } from '../../../modules/spotme-motion';
import type { MotionMode } from '@/features/motion/markers';

function Option({
  icon,
  title,
  message,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-4 active:opacity-70"
    >
      <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
        <Icon icon={icon} size={28} color={colors['primary-text']} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-foreground">{title}</Text>
        <Text className="mt-0.5 text-sm leading-5 text-muted">{message}</Text>
      </View>
      <Icon icon={ChevronRight} size={20} color={colors.subtle} />
    </Pressable>
  );
}

function summary(record: MotionRecord, t: TFunction) {
  if (record.kind === 'machine') {
    const shape = t(`motion.shape.${record.result.shape}`);
    return record.fit.match === null
      ? shape
      : t('motion.listMachine', { shape, match: Math.round(record.fit.match * 100) });
  }
  return t('motion.listExecution', { count: record.result.reps.length, score: record.result.score });
}

export default function MotionLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const records = useMotionStore((s) => s.records);
  const start = (mode: MotionMode) => router.push({ pathname: '/motion/new', params: { mode } });

  return (
    <SafeScreen className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('motion.title')} subtitle={t('motion.subtitle')} />

        {!motionAvailable && (
          <View className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3">
            <Text className="text-sm text-warning-text">{t('motion.unavailable')}</Text>
          </View>
        )}

        <Option
          icon={Activity}
          title={t('motion.executionTitle')}
          message={t('motion.executionMessage')}
          onPress={() => start('execution')}
        />
        <Option
          icon={Cog}
          title={t('motion.machineTitle')}
          message={t('motion.machineMessage')}
          onPress={() => start('machine')}
        />

        <Text accessibilityRole="header" className="mb-2 mt-6 text-lg font-bold text-foreground">
          {t('motion.saved')}
        </Text>
        {records.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-border-strong px-6 py-10">
            <Icon icon={ScanLine} size={32} color={colors.subtle} />
            <Text className="mt-3 text-center text-sm text-subtle">{t('motion.savedEmpty')}</Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-border bg-surface">
            {records.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: '/motion/[id]', params: { id: r.id } })}
                accessibilityRole="button"
                className={`flex-row items-center px-4 py-3 active:opacity-70 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated">
                  <Icon icon={r.kind === 'machine' ? Cog : Activity} size={20} color={colors.muted} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {r.name || t(r.kind === 'machine' ? 'motion.unnamedMachine' : 'motion.unnamedExercise')}
                  </Text>
                  <Text className="text-sm text-subtle" numberOfLines={1}>
                    {summary(r, t)} ·{' '}
                    {formatDayKey(toDayKey(new Date(r.createdAt)), i18n.language, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <Icon icon={ChevronRight} size={18} color={colors.subtle} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}
