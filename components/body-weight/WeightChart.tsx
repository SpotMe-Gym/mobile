import { View, Text, Dimensions } from 'react-native';
import { useMemo } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WeightData {
  date: string;
  weight: number;
}

interface WeightChartProps {
  data: WeightData[];
  height?: number;
  color?: string;
}

export function WeightChart({ data, height = 200, color = '#3b82f6' }: WeightChartProps) {
  const processedData = useMemo(() => {
    if (!data.length) return [];

    // Sort by date just in case
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Take last 7 entries for the chart if many
    const recent = sorted.slice(-7);

    // Find min/max for scaling
    const weights = recent.map(d => d.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const range = maxWeight - minWeight || 1; // avoid divide by zero

    // Add buffer to range so lines don't touch top/bottom exactly
    const buffer = range * 0.2;
    const paddedMin = Math.min(0, minWeight - buffer); // or just minWeight - buffer if we don't start at 0
    const paddedMax = maxWeight + buffer;
    const paddedRange = paddedMax - paddedMin;

    return recent.map((d, index) => {
      // Calculate normalized height (0 to 1)
      // We want the line to be relative to the range, but maybe we want a bar chart or line chart?
      // Let's do a simple bar-like visualization or connected points?
      // Since we don't have SVG, absolute positioned views for points and lines is tricky for lines (rotation).
      // A Bar chart is easiest with Views.

      const normalized = (d.weight - (minWeight - buffer)) / (range + buffer * 2);

      return {
        ...d,
        normalized,
        label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'narrow' }),
      };
    });
  }, [data]);

  if (processedData.length < 2) {
    return (
      <View style={{ height }} className="items-center justify-center bg-zinc-900 rounded-3xl border border-zinc-800">
        <Text className="text-zinc-500">Add more weight entries to see trends</Text>
      </View>
    );
  }

  // Create a Bar Chart look for simplicity without SVG
  return (
    <View style={{ height }} className="flex-row items-end justify-between bg-zinc-900 rounded-3xl p-4 border border-zinc-800">
      {processedData.map((d, i) => (
        <View key={i} className="items-center" style={{ width: `${100 / processedData.length}%` }}>
          {/* Bar / Pill */}
          <View
            style={{
              height: Math.max(d.normalized * (height - 60), 4), // Min height 4
              width: 8,
              backgroundColor: i === processedData.length - 1 ? color : '#3f3f46', // Highlight last
              borderRadius: 4,
            }}
          />
          {/* Date Label */}
          <Text className="text-zinc-500 text-[10px] mt-2">{d.label}</Text>
          {/* Weight Label (only for selected/last?) */}
          <Text className="text-white text-[10px] font-medium absolute -top-5 w-10 text-center">
            {d.weight}
          </Text>
        </View>
      ))}
    </View>
  );
}
