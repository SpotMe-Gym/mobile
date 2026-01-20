import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { Card } from '../../components/ui/Card'; // Fixed import path
import { Settings, ChevronRight, User, Hash, Ruler, Weight } from 'lucide-react-native';

export default function Profile() {
  const { name, weight, height } = useUserStore();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-2">
          <Text className="text-3xl font-bold text-white">Profile</Text>
          <TouchableOpacity>
            <Settings color="white" size={24} />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <View className="flex-row items-center mb-8">
          <View className="h-20 w-20 bg-zinc-800 rounded-full items-center justify-center border border-zinc-700 mr-4">
            <Text className="text-white text-3xl font-bold">{name ? name[0].toUpperCase() : 'U'}</Text>
          </View>
          <View>
            <Text className="text-white text-xl font-bold">{name || 'User'}</Text>
            <Text className="text-zinc-500">Premium Member</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <Text className="text-white text-lg font-bold mb-4">Physical Stats</Text>
        <View className="flex-row gap-3 mb-8">
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Weight color="#3b82f6" size={24} />
            <Text className="text-white text-xl font-bold mt-2">{weight || '--'}</Text>
            <Text className="text-zinc-500 text-xs">Weight (kg)</Text>
          </Card>
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Ruler color="#f97316" size={24} />
            <Text className="text-white text-xl font-bold mt-2">{height || '--'}</Text>
            <Text className="text-zinc-500 text-xs">Height (cm)</Text>
          </Card>
          <Card className="flex-1 bg-zinc-900 border border-zinc-800 items-center py-6">
            <Hash color="#22c55e" size={24} />
            <Text className="text-white text-xl font-bold mt-2">--</Text>
            <Text className="text-zinc-500 text-xs">Age</Text>
          </Card>
        </View>

        {/* Settings List */}
        <Text className="text-white text-lg font-bold mb-4">Settings</Text>
        <View className="bg-zinc-900 rounded-2xl overflow-hidden mb-10">
          {[
            { icon: User, label: "Account Details" },
            { icon: Hash, label: "Units & Measurements" },
            { icon: Settings, label: "App Preferences" },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              className={`flex-row items-center justify-between p-4 ${i !== 2 ? 'border-b border-zinc-800' : ''}`}
            >
              <View className="flex-row items-center">
                <item.icon size={20} color="white" />
                <Text className="text-white ml-3 font-medium">{item.label}</Text>
              </View>
              <ChevronRight size={20} color="#52525B" />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
