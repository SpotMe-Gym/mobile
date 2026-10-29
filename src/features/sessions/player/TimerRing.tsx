import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';

/** A countdown ring: `progress` 0 → 1 fills it clockwise from the top. */
export function TimerRing({
  size,
  progress,
  color,
  stroke = 12,
  children,
}: {
  size: number;
  progress: number | null;
  color: string;
  stroke?: number;
  children: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = progress === null ? 0 : Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors['surface-elevated']}
          strokeWidth={stroke}
          fill="none"
        />
        {progress !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
