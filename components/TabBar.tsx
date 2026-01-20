import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useLinkBuilder, useTheme } from '@react-navigation/native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Chrome as Home, Dumbbell, Utensils, User } from 'lucide-react-native';
import { Icon } from './ui/Icon';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();

  return (
    <View className="bg-background border-t border-zinc-800 flex-row pb-8 pt-3 absolute bottom-0 w-full">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const color = isFocused ? '#FFFFFF' : '#52525B';

        let iconName;
        if (route.name === 'index') iconName = Home;
        else if (route.name === 'workouts') iconName = Dumbbell;
        else if (route.name === 'nutrition') iconName = Utensils;
        else if (route.name === 'profile') iconName = User;

        const IconComponent = iconName;

        return (
          <TouchableOpacity
            key={route.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID || ""}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 items-center justify-center h-16"
            activeOpacity={0.7}
          >
            {IconComponent && <Icon icon={IconComponent} size={24} color={color} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
