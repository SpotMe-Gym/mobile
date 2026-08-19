import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Play, Dumbbell, Sparkles } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { useWorkoutStore, Workout } from '../../store/workoutStore';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/ui/Icon';

// Helper to find which days a workout is assigned to
const getWorkoutDays = (workoutId: string, schedule: Record<string, string | null>) => {
  return Object.entries(schedule)
    .filter(([_, id]) => id === workoutId)
    .map(([day]) => day.substring(0, 3)); // Mon, Tue
};

const WorkoutItem = ({ item, scheduledDays, onPress }: { item: Workout, scheduledDays: string[], onPress: () => void }) => (
  <Card className="mb-4 bg-zinc-900 border border-zinc-800">
    <View className="flex-row justify-between items-center">
      <TouchableOpacity className="flex-row items-center flex-1 pr-4" onPress={onPress}>
        <View className="h-12 w-12 bg-zinc-800 rounded-lg items-center justify-center mr-4">
          <Dumbbell size={24} color="#3b82f6" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">{item.name}</Text>
          <View className="flex-row flex-wrap gap-2 mt-1">
            <Text className="text-zinc-500 text-xs">{item.exercises.length} Ex • {item.duration} min</Text>
            {scheduledDays.length > 0 && (
              <View className="bg-blue-900/30 px-2 py-0.5 rounded">
                <Text className="text-blue-400 text-[10px] font-medium">{scheduledDays.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <Button
        size="icon"
        variant="secondary"
        icon={<Icon icon={Play} size={20} color="white" fill="white" />}
      />
    </View>
  </Card>
);

export default function Workouts() {
  const router = useRouter();
  const { workouts, schedule } = useWorkoutStore();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4 relative">
        <ScreenHeader
          title="My Workouts"
          className="mt-8"
          rightAction={
            <Button
              size="icon"
              variant="ai"
              icon={<Icon icon={Sparkles} size={20} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />}
              onPress={() => router.push('/chat')}
            />
          }
        />

        <View className="flex-1 w-full h-full">
          <FlashList<Workout>
            data={workouts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <WorkoutItem
                item={item}
                scheduledDays={getWorkoutDays(item.id, schedule)}
                onPress={() => router.push(`/workouts/create?id=${item.id}`)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View className="items-center justify-center py-20 opacity-50">
                <Dumbbell size={48} color="white" />
                <Text className="text-white font-bold mt-4">No Workouts Yet</Text>
                <Text className="text-zinc-500 text-center mt-2">Create your first workout routine to get started.</Text>
              </View>
            )}
          />
        </View>

        <Button
          size="icon"
          variant="primary"
          icon={<Icon icon={Plus} color="white" size={28} />}
          onPress={() => router.push('/workouts/create')}
          className="absolute bottom-6 right-6 h-14 w-14 shadow-lg"
        />
      </View>
    </SafeAreaView>
  );
}
