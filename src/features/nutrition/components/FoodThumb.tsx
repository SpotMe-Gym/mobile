import { View } from 'react-native';
import { Image } from 'expo-image';
import { Utensils } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/shared/ui/Icon';

/** Fixed-size product image with a neutral fallback — never shifts layout while loading. */
export function FoodThumb({ uri, size = 56 }: { uri?: string; size?: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-xl bg-surface-elevated"
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <Icon icon={Utensils} size={size * 0.4} color={colors.subtle} />
      )}
    </View>
  );
}
