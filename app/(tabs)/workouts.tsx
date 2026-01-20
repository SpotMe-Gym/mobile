import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Plus, ChevronRight, Play, Dumbbell } from 'lucide-react-native';

const routines = [
  { id: '1', name: 'Push Day A', duration: '45 min', exercises: 6, last: '3 days ago' },
  { id: '2', name: 'Pull Day B', duration: '55 min', exercises: 7, last: 'Yesterday' },
  { id: '3', name: 'Legs & Core', duration: '60 min', exercises: 5, last: '5 days ago' },
  { id: '4', name: 'Full Body Circuit', duration: '30 min', exercises: 4, last: '1 week ago' },
];

export default function Workouts() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <View className="flex-row justify-between items-center mb-6 mt-2">
          <Text className="text-3xl font-bold text-white">Workouts</Text>
          <TouchableOpacity className="bg-blue-600 p-2 rounded-full">
            <Plus color="white" size={24} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={routines}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Card className="mb-4 bg-zinc-900 border border-zinc-800">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <View className="h-12 w-12 bg-zinc-800 rounded-lg items-center justify-center mr-4">
                    <Dumbbell size={24} color="#3b82f6" />
                  </View>
                  <View>
                    <Text className="text-white font-bold text-lg">{item.name}</Text>
                    <Text className="text-zinc-500 text-sm">{item.exercises} Exercises • {item.duration}</Text>
                  </View>
                </View>
                <TouchableOpacity className="h-10 w-10 bg-white/10 rounded-full items-center justify-center">
                  <Play size={20} color="white" fill="white" />
                </TouchableOpacity>
              </View>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </SafeAreaView>
  );
}
