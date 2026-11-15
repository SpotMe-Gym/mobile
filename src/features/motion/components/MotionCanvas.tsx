import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg from 'react-native-svg';

/**
 * The still frame with a drawing on top. `children` gets the drawing's size in points and
 * returns SVG elements; frame coordinates (0–1) are multiplied by it.
 */
export function MotionCanvas({
  image,
  aspect,
  maxHeight = 460,
  children,
}: {
  image: string | null;
  /** Frame width / height. */
  aspect: number;
  maxHeight?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const [available, setAvailable] = useState(0);
  const ratio = aspect > 0 ? aspect : 9 / 16;
  const height = Math.min(maxHeight, available / ratio);
  const width = height * ratio;
  return (
    <View className="items-center" onLayout={(e) => setAvailable(Math.round(e.nativeEvent.layout.width))}>
      {available > 0 && (
        <View
          className="overflow-hidden rounded-2xl border border-border bg-surface-sunken"
          style={{ width, height }}
        >
          {image && (
            <Image
              source={{ uri: image }}
              style={{ width, height, opacity: 0.55 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          )}
          <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {children({ width, height })}
          </Svg>
        </View>
      )}
    </View>
  );
}

/** "x,y x,y …" for a Polyline, from frame coordinates. */
export const polyline = (
  points: readonly { x: number; y: number }[],
  size: { width: number; height: number },
) => points.map((p) => `${(p.x * size.width).toFixed(1)},${(p.y * size.height).toFixed(1)}`).join(' ');
