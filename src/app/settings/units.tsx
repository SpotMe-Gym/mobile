import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ListGroup, ListRow } from '@/shared/ui/ListRow';
import { useUserStore } from '@/features/profile/userStore';
import { lightImpact } from '@/shared/lib/haptics';

export default function UnitsSettings() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const units = useUserStore((s) => s.units);
  const setWeightUnit = useUserStore((s) => s.setWeightUnit);
  const setHeightUnit = useUserStore((s) => s.setHeightUnit);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('settings.units')} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text accessibilityRole="header" className="mb-3 ml-1 font-medium text-muted">
            {t('settings.weight')}
          </Text>
          <ListGroup>
            <ListRow
              title={t('settings.metric')}
              subtitle="kg"
              selected={units.weight === 'kg'}
              onPress={() => {
                lightImpact();
                setWeightUnit('kg');
              }}
            />
            <ListRow
              title={t('settings.imperial')}
              subtitle="lbs"
              selected={units.weight === 'lbs'}
              onPress={() => {
                lightImpact();
                setWeightUnit('lbs');
              }}
              isLast
            />
          </ListGroup>

          <Text accessibilityRole="header" className="mb-3 ml-1 font-medium text-muted">
            {t('settings.height')}
          </Text>
          <ListGroup>
            <ListRow
              title={t('settings.metric')}
              subtitle="cm"
              selected={units.height === 'cm'}
              onPress={() => {
                lightImpact();
                setHeightUnit('cm');
              }}
            />
            <ListRow
              title={t('settings.imperial')}
              subtitle="ft / in"
              selected={units.height === 'ft'}
              onPress={() => {
                lightImpact();
                setHeightUnit('ft');
              }}
              isLast
            />
          </ListGroup>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
