import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircleUserRound, Hash, Languages, Ruler, Share2, Weight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { ListGroup, ListRow } from '@/shared/ui/ListRow';
import { useUserStore } from '@/features/profile/userStore';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { eraseAllData, shareExport } from '@/features/profile/userData';
import { colors } from '@/theme/colors';
import { useAccountStore } from '@/features/account/accountStore';
import { formatNumber } from '@/shared/utils/number';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const name = useUserStore((s) => s.name);
  const age = useUserStore((s) => s.age);
  const targets = useUserStore((s) => s.targets);
  const { currentWeight, currentHeight } = useUnitConverter();
  const accountStatus = useAccountStore((s) => s.status);
  const accountEmail = useAccountStore((s) => s.user?.email);
  const f = (n: number) => formatNumber(n, i18n.language, 0);

  const confirmReset = () =>
    Alert.alert(t('profile.resetDataTitle'), t('profile.resetDataMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.reset'), style: 'destructive', onPress: eraseAllData },
    ]);

  const exportData = () => {
    shareExport().catch(() => Alert.alert(t('errors.generic')));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <ScreenHeader title={t('profile.title')} />

        <View className="mb-8 flex-row items-center">
          <View className="mr-4 h-20 w-20 items-center justify-center rounded-full border border-border-strong bg-surface-elevated">
            <Text className="text-3xl font-bold text-foreground">{name ? name[0]?.toUpperCase() : 'U'}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">{name || t('common.user')}</Text>
            <Text className="text-subtle">
              {t('profile.dailyTargets', {
                kcal: f(targets.kcal),
                protein: f(targets.protein),
                carbs: f(targets.carbs),
                fat: f(targets.fat),
              })}
            </Text>
          </View>
        </View>

        {accountStatus !== 'unavailable' && (
          <>
            <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
              {t('account.section')}
            </Text>
            <ListGroup>
              <ListRow
                icon={CircleUserRound}
                title={
                  accountStatus === 'signedIn' ? (accountEmail ?? t('account.title')) : t('account.signInRow')
                }
                subtitle={
                  accountStatus === 'signedIn' ? t('account.signedInRowHint') : t('account.signInRowHint')
                }
                chevron
                onPress={() => router.push('/account')}
                isLast
              />
            </ListGroup>
          </>
        )}

        <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
          {t('profile.statsTitle')}
        </Text>
        <View className="mb-8 flex-row gap-3">
          <Stat
            icon={Weight}
            color={colors.accent}
            value={currentWeight.formatted}
            label={currentWeight.unit}
          />
          <Stat
            icon={Ruler}
            color={colors.highlight}
            value={currentHeight.formatted}
            label={currentHeight.unit}
          />
          <Stat
            icon={Hash}
            color={colors.success}
            value={age !== null ? String(age) : '--'}
            label={t('common.age')}
          />
        </View>

        <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
          {t('settings.appPreferences')}
        </Text>
        <ListGroup>
          <ListRow
            icon={Hash}
            title={t('settings.units')}
            chevron
            onPress={() => router.push('/settings/units')}
          />
          <ListRow
            icon={Languages}
            title={t('settings.language')}
            chevron
            onPress={() => router.push('/settings/language')}
            isLast
          />
        </ListGroup>

        <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
          {t('profile.yourData')}
        </Text>
        <ListGroup>
          <ListRow
            icon={Share2}
            title={t('profile.exportData')}
            subtitle={t('profile.exportDataHint')}
            onPress={exportData}
            isLast
          />
        </ListGroup>

        <Button variant="danger" label={t('profile.resetAllData')} onPress={confirmReset} className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
}: {
  icon: typeof Weight;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <Card
      className="flex-1 items-center border border-border py-6"
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Icon icon={icon} size={24} color={color} />
      <Text className="mt-2 text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-subtle">{label}</Text>
    </Card>
  );
}
