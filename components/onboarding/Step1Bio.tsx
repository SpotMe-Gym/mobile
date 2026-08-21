import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { User, Minus, Plus, Ruler, Weight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface BioForm {
  name: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  height: string;
  weight: string;
  age: string;
}

interface Step1BioProps {
  form: BioForm;
  setForm: (form: BioForm) => void;
}

export function Step1Bio({ form, setForm }: Step1BioProps) {
  const { t } = useTranslation();

  const genderOptions = [
    { key: 'Male', label: t('common.male') },
    { key: 'Female', label: t('common.female') },
    { key: 'Other', label: t('common.other') },
  ] as const;

  return (
    <View>
      <Text className="text-4xl font-bold text-white mb-2">{t('onboarding.welcomeToSpotMe')}</Text>
      <Text className="text-zinc-400 text-lg mb-8">{t('onboarding.letsStartWithBasics')}</Text>

      {/* Name */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">{t('common.name')}</Text>
        <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
          <User color="#A1A1AA" size={20} />
          <TextInput
            className="flex-1 ml-3 text-white text-lg h-full"
            placeholder={t('onboarding.yourName')}
            placeholderTextColor="#52525B"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
          />
        </View>
      </View>

      {/* Gender */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">{t('common.gender')}</Text>
        <View className="flex-row gap-3">
          {genderOptions.map((g) => (
            <TouchableOpacity
              key={g.key}
              className={`flex-1 h-12 items-center justify-center rounded-xl border ${form.gender === g.key ? 'bg-blue-600 border-blue-600' : 'bg-zinc-900 border-zinc-800'}`}
              onPress={() => setForm({ ...form, gender: g.key as BioForm['gender'] })}
            >
              <Text className={`font-semibold ${form.gender === g.key ? 'text-white' : 'text-zinc-400'}`}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Age */}
      <View className="mb-5">
        <Text className="text-zinc-400 font-medium mb-2 ml-1">{t('common.age')}</Text>
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-row justify-between items-center">
          <TouchableOpacity onPress={() => {
            const current = parseInt(form.age) || 25;
            if (current > 10) setForm({ ...form, age: (current - 1).toString() });
          }} className="h-12 w-12 bg-zinc-800 rounded-full items-center justify-center">
            <Minus size={20} color="white" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-3xl font-bold text-white">{form.age}</Text>
            <Text className="text-zinc-500 text-xs">{t('common.years')}</Text>
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
          <Text className="text-zinc-400 font-medium mb-2 ml-1">{t('common.heightCm')}</Text>
          <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
            <Ruler color="#A1A1AA" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-lg h-full"
              placeholder="180"
              placeholderTextColor="#52525B"
              keyboardType="numeric"
              value={form.height}
              onChangeText={(text) => setForm({ ...form, height: text })}
            />
          </View>
        </View>
        {/* Weight */}
        <View className="flex-1">
          <Text className="text-zinc-400 font-medium mb-2 ml-1">{t('common.weightKg')}</Text>
          <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 h-14 flex-row items-center">
            <Weight color="#A1A1AA" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-lg h-full"
              placeholder="75"
              placeholderTextColor="#52525B"
              keyboardType="numeric"
              value={form.weight}
              onChangeText={(text) => setForm({ ...form, weight: text })}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
