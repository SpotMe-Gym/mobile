import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';

/**
 * The machine's resistance over the range of motion (solid), against the movement's strength
 * curve (dashed). Left = start of the lift, where the muscle is stretched.
 */
export function ProfileChart({
  profile,
  reference,
  height = 170,
}: {
  profile: readonly number[];
  reference?: readonly number[] | null;
  height?: number;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const pad = { top: 8, bottom: 6, left: 4, right: 4 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const x = (k: number, n: number) => pad.left + (w * k) / Math.max(1, n - 1);
  const y = (v: number) => pad.top + h * (1 - Math.max(0, Math.min(1, v)));
  const line = (values: readonly number[]) =>
    values
      .map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k, values.length).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');
  const area = `${line(profile)} L${x(profile.length - 1, profile.length).toFixed(1)},${y(0)} L${x(0, profile.length).toFixed(1)},${y(0)} Z`;

  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 && (
        <Svg width={width} height={height} accessibilityLabel={t('motion.chartLabel')}>
          {/* The stretched third, where resistance matters most for the muscle. */}
          <Rect x={pad.left} y={pad.top} width={w / 3} height={h} fill={colors.accent} opacity={0.08} />
          {[0.5, 1].map((v) => (
            <Line
              key={v}
              x1={pad.left}
              x2={pad.left + w}
              y1={y(v)}
              y2={y(v)}
              stroke={colors['border-strong']}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
          <Line
            x1={pad.left}
            x2={pad.left + w}
            y1={y(0)}
            y2={y(0)}
            stroke={colors['border-strong']}
            strokeWidth={1}
          />
          <Path d={area} fill={colors.accent} opacity={0.18} />
          {reference && (
            <Path
              d={line(reference)}
              stroke={colors.muted}
              strokeWidth={2}
              strokeDasharray="6 5"
              fill="none"
            />
          )}
          <Path
            d={line(profile)}
            stroke={colors['primary-text']}
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs text-subtle">{t('motion.chartStart')}</Text>
        <Text className="text-xs text-subtle">{t('motion.chartEnd')}</Text>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
        <View className="flex-row items-center gap-2">
          <View className="h-1 w-5 rounded bg-primary-text" />
          <Text className="text-xs text-muted">{t('motion.legendMachine')}</Text>
        </View>
        {reference && (
          <View className="flex-row items-center gap-2">
            <View className="h-0.5 w-5 bg-muted" />
            <Text className="text-xs text-muted">{t('motion.legendStrength')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
