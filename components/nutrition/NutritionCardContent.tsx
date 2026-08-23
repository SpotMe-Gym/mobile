import { View, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { CalorieGauge } from './CalorieGauge';
import { useNutritionStore } from '../../store/nutritionStore';
import { useUserStore } from '../../store/userStore';
import { useHasHydrated } from '../../hooks/useHasHydrated';

interface NutritionCardContentProps {
  /** Sizing for the card box (`flex: 1` on the grid, explicit dims in the preview). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Closed-card body for the Nutrition card, shared by the home grid and the
 * expandable-card preview.
 *
 * Reads its own data rather than taking it via props: the preview is swapped for the
 * real card the instant the collapse animation ends, so any difference in markup or
 * values between the two reads as content jumping at the end of the transition.
 */
export function NutritionCardContent({ style }: NutritionCardContentProps) {
  const { t } = useTranslation();
  const getDailyTotals = useNutritionStore(s => s.getDailyTotals);
  const targets = useUserStore(s => s.targets);
  const isHydrated = useHasHydrated(useNutritionStore);

  const today = new Date().toISOString().split('T')[0];
  const totals = getDailyTotals(today);

  return (
    <View style={[{ backgroundColor: '#18181b', borderRadius: 16, overflow: 'hidden' }, style]}>
      <Card className="h-full bg-transparent" title={t('dashboard.nutrition')}>
        <View className="items-center justify-center flex-1 -mt-2">
          {/* Withheld until hydrated: an empty log and a not-yet-loaded log both total
              zero, and rendering the gauge at 0 would assert the user ate nothing. */}
          {isHydrated && <CalorieGauge totals={totals} size="small" targets={targets} />}
        </View>
      </Card>
    </View>
  );
}
