import { View, Text } from 'react-native';

interface CalorieGaugeProps {
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  targets?: {
    calories: number;
    protein: number; // in grams
    carbs: number;   // in grams
    fat: number;     // in grams
  };
  size?: 'small' | 'large';
  showLabel?: boolean;
  showLegend?: boolean;
}

export function CalorieGauge({
  totals,
  targets = { calories: 2800, protein: 180, carbs: 300, fat: 80 },
  size = 'large',
  showLabel = true,
  showLegend = false,
}: CalorieGaugeProps) {
  const isSmall = size === 'small';
  // Increased size for 'small' variant as requested
  const segments = isSmall ? 24 : 40;
  const radius = isSmall ? 58 : 80;
  const segmentWidth = isSmall ? 3 : 4;
  const segmentHeight = isSmall ? 8 : 12;

  const startAngle = -90;
  const endAngle = 90;
  const range = endAngle - startAngle;
  const step = range / (segments - 1);

  // Current progress
  const percentage = Math.min(Math.max(totals.calories / targets.calories, 0), 1);
  const activeSegments = Math.round(percentage * segments);

  // Calculate Calorie Breakdown from actual intake
  const proteinCals = totals.protein * 4;
  const carbsCals = totals.carbs * 4;
  const fatCals = totals.fat * 9;
  const totalCalculated = proteinCals + carbsCals + fatCals || 1;

  // Distribute active segments proportionally by what was eaten
  const pRatio = proteinCals / totalCalculated;
  const cRatio = carbsCals / totalCalculated;

  const pSegs = Math.round(activeSegments * pRatio);
  const cSegs = Math.round(activeSegments * cRatio);

  const pEnd = pSegs;
  const cEnd = pSegs + cSegs;

  // Calculate TARGET positions for markers (where goals would be on the arc)
  const targetProteinCals = targets.protein * 4;
  const targetCarbsCals = targets.carbs * 4;
  const targetFatCals = targets.fat * 9;
  const targetTotalCals = targetProteinCals + targetCarbsCals + targetFatCals;

  // Target marker positions (as percentage of total arc)
  const proteinTargetPos = targetProteinCals / targetTotalCals;
  const carbsTargetPos = (targetProteinCals + targetCarbsCals) / targetTotalCals;

  // Convert to segment indices
  const proteinMarkerIdx = Math.round(proteinTargetPos * segments);
  const carbsMarkerIdx = Math.round(carbsTargetPos * segments);

  return (
    <View
      className="items-center justify-center"
      style={{
        height: isSmall ? radius + 10 : radius * 2.4,
        marginBottom: isSmall ? 0 : -48,
        marginTop: isSmall ? 16 : 0
      }}
    >
      <View
        className="relative items-center justify-center"
        style={{ width: radius * 2, height: radius }}
      >
        {/* Segments */}
        {Array.from({ length: segments }).map((_, i) => {
          const angle = startAngle + (i * step);
          const isActive = i < activeSegments;
          const isMarker = i === proteinMarkerIdx || i === carbsMarkerIdx;

          // Determine color based on macro breakdown
          let bgColor = '#27272a'; // zinc-800
          if (isActive) {
            if (i < pEnd) bgColor = '#3b82f6'; // blue-500 (protein)
            else if (i < cEnd) bgColor = '#f97316'; // orange-500 (carbs)
            else bgColor = '#eab308'; // yellow-500 (fat)
          }

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: segmentWidth,
                height: isMarker ? segmentHeight + 4 : segmentHeight,
                borderRadius: segmentWidth / 2,
                backgroundColor: bgColor,
                transform: [
                  { rotate: `${angle}deg` },
                  { translateY: -radius },
                ],
                opacity: isActive ? 1 : 0.3,
              }}
            />
          );
        })}

        {/* Target markers - small ticks on the outside */}
        {[proteinMarkerIdx, carbsMarkerIdx].map((idx, markerIndex) => {
          const angle = startAngle + (idx * step);
          const markerColor = markerIndex === 0 ? '#3b82f6' : '#f97316';

          return (
            <View
              key={`marker-${markerIndex}`}
              style={{
                position: 'absolute',
                width: 2,
                height: isSmall ? 4 : 6,
                borderRadius: 1,
                backgroundColor: markerColor,
                transform: [
                  { rotate: `${angle}deg` },
                  { translateY: -(radius + (isSmall ? 8 : 14)) },
                ],
                opacity: 0.8,
              }}
            />
          );
        })}

        {/* Center Text */}
        {showLabel && (
          <View className="absolute bottom-0 items-center">
            <Text
              className="font-bold text-white"
              style={{ fontSize: isSmall ? 28 : 36, lineHeight: isSmall ? 34 : 42 }}
            >
              {totals.calories}
            </Text>
            <Text
              className="text-zinc-500 font-medium"
              style={{ fontSize: isSmall ? 11 : 12 }}
            >
              / {targets.calories} kcal
            </Text>
          </View>
        )}
      </View>

      {/* Mini legend (optional) */}
      {showLegend && (
        <View className="flex-row gap-2 mt-1">
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />
            <Text className="text-zinc-500 text-[8px]">P</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1" />
            <Text className="text-zinc-500 text-[8px]">C</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1" />
            <Text className="text-zinc-500 text-[8px]">F</Text>
          </View>
        </View>
      )}
    </View>
  );
}
