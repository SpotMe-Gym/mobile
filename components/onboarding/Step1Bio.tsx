import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { User, Minus, Plus, Ruler, Weight } from 'lucide-react-native';

interface Step1BioProps {
  form: {
    name: string;
    gender: 'Male' | 'Female' | 'Other' | '';
    height: string;
    weight: string;
    age: string;
  };
  setForm: (form: any) => void;
}

export function Step1Bio({ form, setForm }: Step1BioProps) {
  return (
    <View>
      <Text className="text-4xl font-bold text-white mb-2">Welcome to SpotMe</Text>
      <Text className="text-zinc-400 text-lg mb-8">Let's start with the basics.</Text>

      {/* Name */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">Name</Text>
        <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
          <User color="#A1A1AA" size={20} />
          <TextInput
            className="flex-1 ml-3 text-white text-lg h-full"
            placeholder="Your Name"
            placeholderTextColor="#52525B"
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />
        </View>
      </View>

      {/* Gender */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">Gender</Text>
        <View className="flex-row gap-3">
          {['Male', 'Female', 'Other'].map((g) => (
            <TouchableOpacity
              key={g}
              className={`flex-1 h-12 items-center justify-center rounded-xl border ${form.gender === g ? 'bg-blue-600 border-blue-600' : 'bg-zinc-900 border-zinc-800'}`}
              onPress={() => setForm({ ...form, gender: g as any })}
            >
              <Text className={`font-semibold ${form.gender === g ? 'text-white' : 'text-zinc-400'}`}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Age */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">Age</Text>
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-row justify-between items-center">
          <TouchableOpacity onPress={() => {
            const current = parseInt(form.age) || 25;
            if (current > 10) setForm({ ...form, age: (current - 1).toString() });
          }} className="h-12 w-12 bg-zinc-800 rounded-full items-center justify-center">
            <Minus size={20} color="white" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-3xl font-bold text-white">{form.age}</Text>
            <Text className="text-zinc-500 text-xs">YEARS</Text>
          </View>
          <TouchableOpacity onPress={() => {
            const current = parseInt(form.age) || 25;
            if (current < 100) setForm({ ...form, age: (current + 1).toString() });
          }} className="h-12 w-12 bg-zinc-800 rounded-full items-center justify-center">
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row gap-4 mb-4">
        {/* Height */}
        <View className="flex-1">
          <Text className="text-zinc-400 font-medium mb-2 ml-1">Height (cm)</Text>
          <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
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
        {/* Weight */}
        <View className="flex-1">
          <Text className="text-zinc-400 font-medium mb-2 ml-1">Weight (kg)</Text>
          <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
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
    </View>
  );
}
