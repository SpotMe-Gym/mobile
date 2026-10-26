import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';
import type { Macros } from '@/features/nutrition/utils/nutrition';

interface CalorieGaugeProps {
  totals: Macros;
  targets: Macros;
  size?: 'small' | 'large';
  showLabel?: boolean;
  showLegend?: boolean;
}

/** Segmented semicircle: filled share = kcal eaten / target, coloured by macro split. */
export function CalorieGauge({
  totals,
  targets,
  size = 'large',
  showLabel = true,
  showLegend = false,
}: CalorieGaugeProps) {
  const { t, i18n } = useTranslation();
  const isSmall = size === 'small';
  const segments = isSmall ? 24 : 40;
  const radius = isSmall ? 58 : 80;
  const segmentWidth = isSmall ? 3 : 4;
  const segmentHeight = isSmall ? 8 : 12;

  const startAngle = -90;
  const step = 180 / (segments - 1);

  const percentage = targets.kcal > 0 ? Math.min(Math.max(totals.kcal / targets.kcal, 0), 1) : 0;
  const activeSegments = Math.round(percentage * segments);

  // Split the filled arc by where the eaten calories came from.
  const pCals = totals.protein * 4;
  const cCals = totals.carbs * 4;
  const fCals = totals.fat * 9;
  const eaten = pCals + cCals + fCals || 1;
  const pEnd = Math.round(activeSegments * (pCals / eaten));
  const cEnd = pEnd + Math.round(activeSegments * (cCals / eaten));

  // Target markers: where the protein/carb goals would end on the arc.
  const tP = targets.protein * 4;
  const tC = targets.carbs * 4;
  const tTotal = tP + tC + targets.fat * 9 || 1;
  const proteinMarkerIdx = Math.round((tP / tTotal) * segments);
  const carbsMarkerIdx = Math.round(((tP + tC) / tTotal) * segments);

  const remaining = Math.max(0, targets.kcal - totals.kcal);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('food.gaugeA11y', {
        eaten: formatNumber(totals.kcal, i18n.language, 0),
        target: formatNumber(targets.kcal, i18n.language, 0),
        remaining: formatNumber(remaining, i18n.language, 0),
      })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage * 100) }}
      className="items-center justify-center"
      style={{
        height: isSmall ? radius + 10 : radius * 2.4,
        marginBottom: isSmall ? 0 : -48,
        marginTop: isSmall ? 16 : 0,
      }}
    >
      <View className="relative items-center justify-center" style={{ width: radius * 2, height: radius }}>
        {Array.from({ length: segments }).map((_, i) => {
          const angle = startAngle + i * step;
          const isActive = i < activeSegments;
          const isMarker = i === proteinMarkerIdx || i === carbsMarkerIdx;
          let bg: string = colors['surface-elevated'];
          if (isActive) bg = i < pEnd ? colors.protein : i < cEnd ? colors.carbs : colors.fat;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: segmentWidth,
                height: isMarker ? segmentHeight + 4 : segmentHeight,
                borderRadius: segmentWidth / 2,
                backgroundColor: bg,
                transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
                opacity: isActive ? 1 : 0.3,
              }}
            />
          );
        })}

        {[proteinMarkerIdx, carbsMarkerIdx].map((idx, markerIndex) => (
          <View
            key={`marker-${markerIndex}`}
            style={{
              position: 'absolute',
              width: 2,
              height: isSmall ? 4 : 6,
              borderRadius: 1,
              backgroundColor: markerIndex === 0 ? colors.protein : colors.carbs,
              transform: [
                { rotate: `${startAngle + idx * step}deg` },
                { translateY: -(radius + (isSmall ? 8 : 14)) },
              ],
              opacity: 0.8,
            }}
          />
        ))}

        {showLabel && (
          <View className="absolute bottom-0 items-center">
            <Text className={`font-bold text-foreground ${isSmall ? 'text-3xl' : 'text-4xl'}`}>
              {formatNumber(totals.kcal, i18n.language, 0)}
            </Text>
            <Text className="text-xs font-medium text-subtle">
              {t('food.ofTargetKcal', { target: formatNumber(targets.kcal, i18n.language, 0) })}
            </Text>
          </View>
        )}
      </View>

      {showLegend && (
        <View className="mt-1 flex-row gap-3">
          {(
            [
              ['protein', colors.protein],
              ['carbs', colors.carbs],
              ['fat', colors.fat],
            ] as const
          ).map(([key, color]) => (
            <View key={key} className="flex-row items-center">
              <View className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-xs text-subtle">{t(`food.${key}Short`)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
