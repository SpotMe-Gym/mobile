import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { lightImpact } from '@/shared/lib/haptics';
import { Button } from '@/shared/ui/Button';
import type { MarkerDef } from '@/features/motion/markers';

export type Marks = ([number, number] | null)[];

/**
 * The first frame: tap where each point is (the handle; for a machine also the load and,
 * optionally, the pivot). The tracker follows a small square around each tap, so a spot with
 * contrast (a grip end, a bolt, the edge of the top plate) tracks best.
 */
export function MarkStep({
  image,
  aspect,
  markers,
  onDone,
  onBack,
}: {
  image: string;
  aspect: number;
  markers: MarkerDef[];
  onDone: (marks: Marks) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [marks, setMarks] = useState<Marks>(() => markers.map(() => null));
  const [active, setActive] = useState(0);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Largest picture that fits the space, at the frame's own proportions.
  const ratio = aspect > 0 ? aspect : 9 / 16;
  const height = box.width > 0 ? Math.min(box.height, box.width / ratio) : 0;
  const width = height * ratio;

  const place = (x: number, y: number) => {
    if (width <= 0) return;
    lightImpact();
    const next = [...marks];
    next[active] = [Math.max(0, Math.min(1, x / width)), Math.max(0, Math.min(1, y / height))];
    setMarks(next);
    // On to the next point that still needs marking.
    const todo = next.findIndex((m, i) => m === null && i !== active);
    if (todo >= 0) setActive(todo);
  };

  const missing = markers.some((m, i) => !m.optional && marks[i] === null);
  const current = markers[active]!;

  return (
    <View className="flex-1">
      <View className="mb-3 flex-row flex-wrap gap-2">
        {markers.map((m, i) => (
          <Pressable
            key={m.key}
            onPress={() => setActive(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === active }}
            className={cn(
              'flex-row items-center gap-2 rounded-full border px-3 py-2',
              i === active ? 'border-foreground bg-surface-elevated' : 'border-border bg-surface',
            )}
          >
            <View
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: m.color, opacity: marks[i] ? 1 : 0.35 }}
            />
            <Text className="text-sm font-medium text-foreground">
              {t(m.label)}
              {m.optional ? ` (${t('motion.optional')})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="mb-3 text-sm text-muted">{t(current.hint)}</Text>

      <View
        className="flex-1 items-center justify-center"
        onLayout={(e) =>
          setBox({
            width: Math.round(e.nativeEvent.layout.width),
            height: Math.round(e.nativeEvent.layout.height),
          })
        }
      >
        {width > 0 && (
          <Pressable
            onPress={(e) => place(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            accessibilityRole="image"
            accessibilityLabel={t('motion.markImageLabel')}
            className="overflow-hidden rounded-2xl border border-border"
            style={{ width, height }}
          >
            <Image source={{ uri: image }} style={{ width, height }} contentFit="cover" />
            <Svg
              width={width}
              height={height}
              style={{ position: 'absolute', left: 0, top: 0 }}
              pointerEvents="none"
            >
              {marks.map((m, i) => {
                if (!m) return null;
                const cx = m[0] * width;
                const cy = m[1] * height;
                const color = markers[i]!.color;
                return (
                  <G key={markers[i]!.key}>
                    <Line x1={cx - 16} x2={cx + 16} y1={cy} y2={cy} stroke={color} strokeWidth={1.5} />
                    <Line x1={cx} x2={cx} y1={cy - 16} y2={cy + 16} stroke={color} strokeWidth={1.5} />
                    <Circle cx={cx} cy={cy} r={9} stroke={color} strokeWidth={2.5} fill="none" />
                  </G>
                );
              })}
            </Svg>
          </Pressable>
        )}
      </View>

      <View className="mt-4 flex-row gap-3">
        <Button label={t('common.back')} variant="secondary" className="flex-1" onPress={onBack} />
        <Button
          label={t('motion.analyse')}
          className="flex-[2]"
          disabled={missing}
          onPress={() => onDone(marks)}
        />
      </View>
    </View>
  );
}
