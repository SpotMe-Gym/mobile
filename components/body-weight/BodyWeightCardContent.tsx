import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { useUserStore } from '../../store/userStore';
import { useUnitConverter } from '../../hooks/useUnitConverter';
import type { WidgetSize } from '../dashboard/widgetSizes';

interface BodyWeightCardContentProps {
  size?: WidgetSize;
  /** Explicit cell box from the grid or expand preview. Parent always owns width/height. */
  style?: StyleProp<ViewStyle>;
}

function Trend({
  hasTrend,
  isGain,
  diff,
  unit,
  compact,
}: {
  hasTrend: boolean;
  isGain: boolean;
  diff: number;
  unit: string;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const iconSize = compact ? 12 : 16;

  if (!hasTrend) {
    return (
      <View className="flex-row items-center">
        <Minus size={iconSize} color="#71717a" />
        {!compact && (
          <Text className="text-zinc-500 ml-1 text-sm font-medium">{t('dashboard.noChange')}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-row items-center">
      {isGain ? <TrendingUp size={iconSize} color="#ef4444" /> : <TrendingDown size={iconSize} color="#22c55e" />}
      <Text className={`${isGain ? 'text-red-500' : 'text-green-500'} ml-1 ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}{compact ? '' : ` ${unit} ${t('dashboard.sinceLast')}`}
      </Text>
    </View>
  );
}

/**
 * Closed-card body for Body Weight. The parent cell always supplies width and height;
 * this fills that box with flex:1 so percentage heights never leak to the ScrollView.
 */
export function BodyWeightCardContent({ size = 'full', style }: BodyWeightCardContentProps) {
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
  const isCompact = size === 'compact';
  const isHalf = size === 'half';

  return (
    <View
      style={[
        {
          backgroundColor: '#18181b',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#27272a',
          overflow: 'hidden',
          flex: 1,
        },
        style,
      ]}
    >
      <Card
        className="flex-1 w-full h-full bg-transparent border-none"
        title={t('dashboard.bodyWeight')}
      >
        {isCompact ? (
          <View className="flex-1 justify-center">
            <View className="flex-row items-baseline">
              <Text className="text-2xl font-bold text-white" numberOfLines={1}>
                {currentWeight.formatted}
              </Text>
              <Text className="text-zinc-500 text-sm ml-1">{currentWeight.unit}</Text>
            </View>
            <View className="mt-1">
              <Trend hasTrend={hasTrend} isGain={isGain} diff={diff} unit={currentWeight.unit} compact />
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-baseline mt-1">
              <Text className={`${isHalf ? 'text-4xl' : 'text-5xl'} font-bold text-white`}>
                {currentWeight.formatted}
              </Text>
              <Text className="text-zinc-500 text-xl ml-2">{currentWeight.unit}</Text>
            </View>
            <View className={`${isHalf ? 'mt-2' : 'mt-3'}`}>
              <Trend hasTrend={hasTrend} isGain={isGain} diff={diff} unit={currentWeight.unit} compact={false} />
            </View>
          </>
        )}
      </Card>
    </View>
  );
}
