import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '../store/userStore';
import { Button } from '../components/ui/Button';
import { Ruler, Weight, User, Hash, Minus, Plus } from 'lucide-react-native';

export default function Onboarding() {
  const router = useRouter();
  const { setName, setGender, setHeight, setWeight, setAge, completeOnboarding } = useUserStore();

  const [form, setForm] = useState({
    name: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    height: '',
    weight: '',
    age: '25', // Default age
  });

  const handleFinish = async () => {
    if (!form.name || !form.gender || !form.height || !form.weight || !form.age) {
      Alert.alert("Missing Information", "Please fill in all fields to continue.");
      return;
    }

    setName(form.name);
    setGender(form.gender as any);
    setHeight(form.height);
    setWeight(form.weight);
    setAge(form.age);
    completeOnboarding();

    // Slight delay to ensure state updates before navigation (though persist is async, usually fast enough)
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-6 pt-10" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-4xl font-bold text-white mb-2">Welcome to SpotMe</Text>
        <Text className="text-zinc-400 text-lg mb-10">Let's get to know you better to personalize your experience.</Text>

        {/* Name Input */}
        <View className="mb-6">
          <Text className="text-white font-medium mb-3 ml-1">What's your name?</Text>
          <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14">
            <User color="#A1A1AA" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-lg h-full"
              placeholder="Your Name"
              placeholderTextColor="#52525B"
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Gender Selection */}
        <View className="mb-6">
          <Text className="text-white font-medium mb-3 ml-1">Gender</Text>
          <View className="flex-row gap-3">
            {['Male', 'Female', 'Other'].map((g) => (
              <TouchableOpacity
                key={g}
                className={`flex-1 h-12 items-center justify-center rounded-xl border ${form.gender === g
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-zinc-900 border-zinc-800'
                  }`}
                onPress={() => setForm({ ...form, gender: g as any })}
              >
                <Text className={`font-semibold ${form.gender === g ? 'text-white' : 'text-zinc-400'}`}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age Input (Premium Tactile UI) */}
        <View className="mb-6">
          <Text className="text-white font-medium mb-3 ml-1">Age</Text>
          <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-row justify-between items-center">
            <TouchableOpacity
              onPress={() => {
                const current = parseInt(form.age) || 25;
                if (current > 10) setForm({ ...form, age: (current - 1).toString() });
              }}
              className="h-12 w-12 bg-zinc-800 rounded-full items-center justify-center active:bg-zinc-700"
            >
              <Minus size={20} color="white" />
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-4xl font-bold text-white">{form.age}</Text>
              <Text className="text-zinc-500 text-xs uppercase tracking-widest">Years</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                const current = parseInt(form.age) || 25;
                if (current < 100) setForm({ ...form, age: (current + 1).toString() });
              }}
              className="h-12 w-12 bg-zinc-800 rounded-full items-center justify-center active:bg-zinc-700"
            >
              <Plus size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row gap-4 mb-10">
          {/* Height Input */}
          <View className="flex-1">
            <Text className="text-white font-medium mb-3 ml-1">Height (cm)</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14">
              <Ruler color="#A1A1AA" size={20} />
              <TextInput
                className="flex-1 ml-3 text-white text-lg h-full"
                placeholder="180"
                placeholderTextColor="#52525B"
                keyboardType="numeric"
                value={form.height}
                onChangeText={(t) => setForm({ ...form, height: t })}
              />
            </View>
          </View>

          {/* Weight Input */}
          <View className="flex-1">
            <Text className="text-white font-medium mb-3 ml-1">Weight (kg)</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14">
              <Weight color="#A1A1AA" size={20} />
              <TextInput
                className="flex-1 ml-3 text-white text-lg h-full"
                placeholder="75"
                placeholderTextColor="#52525B"
                keyboardType="numeric"
                value={form.weight}
                onChangeText={(t) => setForm({ ...form, weight: t })}
              />
            </View>
          </View>
        </View>

        <Button
          label="Get Started"
          onPress={handleFinish}
          variant="white"
          className="w-full h-14 rounded-xl"
        />

      </ScrollView>
    </SafeAreaView>
  );
}
