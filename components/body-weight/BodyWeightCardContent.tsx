import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { useUserStore } from '../../store/userStore';
import { useUnitConverter } from '../../hooks/useUnitConverter';

interface BodyWeightCardContentProps {
  /** Sizing for the card box. Omitted on the grid, where height is content-driven. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Closed-card body for the Body Weight card, shared by the home grid and the
 * expandable-card preview, which must render identically to avoid content shifting
 * when the preview is swapped for the real card at the end of the collapse animation.
 *
 * No hydration gate needed: userStore persists to MMKV, which reads synchronously
 * during store creation, so the first render already has the real values.
 */
export function BodyWeightCardContent({ style }: BodyWeightCardContentProps) {
  const { t } = useTranslation();
  const weightHistory = useUserStore(s => s.weightHistory);
  const { currentWeight, convertWeight } = useUnitConverter();

  const history = weightHistory || [];
  const latestVal = currentWeight.value;
  const prevEntry = history.length > 1 ? history[history.length - 2] : null;
  const prevVal = prevEntry ? convertWeight(prevEntry.weight).value : latestVal;
  const diff = latestVal - prevVal;
  const isGain = diff > 0;
  const hasTrend = history.length >= 2 && diff !== 0;

  return (
    <View
      style={[
        {
          backgroundColor: '#18181b',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#27272a',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* No `h-full`: on the home grid this card's box has no fixed height, and a
          percentage height there resolves against the scroll viewport, not the content. */}
      <Card className="w-full bg-transparent border-none" title={t('dashboard.bodyWeight')}>
        <View className="flex-row items-baseline mt-2">
          <Text className="text-5xl font-bold text-white">{currentWeight.formatted}</Text>
          <Text className="text-zinc-500 text-xl ml-2">{currentWeight.unit}</Text>
        </View>
        <View className="flex-row items-center mt-4">
          {hasTrend ? (
            <>
              {isGain ? <TrendingUp size={16} color="#ef4444" /> : <TrendingDown size={16} color="#22c55e" />}
              <Text className={`${isGain ? 'text-red-500' : 'text-green-500'} ml-1 text-sm font-medium`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(1)} {currentWeight.unit} {t('dashboard.sinceLast')}
              </Text>
            </>
          ) : (
            <>
              <Minus size={16} color="#71717a" />
              <Text className="text-zinc-500 ml-1 text-sm font-medium">{t('dashboard.noChange')}</Text>
            </>
          )}
        </View>
      </Card>
    </View>
  );
}
