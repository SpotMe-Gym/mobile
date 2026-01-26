import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Icon } from './ui/Icon';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string; // Allow minimal overrides if absolutely necessary
  showBackButton?: boolean; // Default true
}

export function ScreenHeader({ title, onBack, rightAction, className, showBackButton = true }: ScreenHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View className={`flex-row items-center justify-between mb-6 mt-2 ${className || ''}`}>
      <View className="flex-row items-center">
        {showBackButton && (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="h-12 w-12 items-center justify-center bg-zinc-800 rounded-full mr-4 active:bg-zinc-700"
          >
            <Icon icon={ChevronLeft} color="white" size={24} />
          </TouchableOpacity>
        )}
        <Text className="text-2xl font-bold text-white">{title}</Text>
      </View>

      {rightAction && (
        <View>
          {rightAction}
        </View>
      )}
    </View>
  );
}
