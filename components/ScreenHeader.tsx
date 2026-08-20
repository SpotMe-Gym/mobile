import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
  showBackButton?: boolean;
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
      <View className="flex-row items-center flex-1 mr-4">
        {showBackButton && (
          <Button
            size="icon"
            variant="secondary"
            icon={<Icon icon={ChevronLeft} color="white" size={24} />}
            onPress={handleBack}
            className="h-12 w-12 mr-4"
          />
        )}
        <Text className="text-2xl font-bold text-white flex-shrink" numberOfLines={1}>{title}</Text>
      </View>

      {rightAction && (
        <View>
          {rightAction}
        </View>
      )}
    </View>
  );
}
