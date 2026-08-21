import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Minus, Plus, Info, Lock, Unlock, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface Step3NutritionProps {
  calories: number;
  updateCalories: (c: number) => void;
  protein: number;
  carbs: number;
  fat: number;
  updateMacro: (t: 'p' | 'c' | 'f', v: number) => void;
  isLocked: boolean;
  setIsLocked: (l: boolean) => void;
}

export function Step3Nutrition({
  calories, updateCalories,
  protein, carbs, fat, updateMacro,
  isLocked, setIsLocked
}: Step3NutritionProps) {
  const { t } = useTranslation();

  // Steps for adjusters
  const calStep = isLocked ? 50 : 1;
  const macroStep = isLocked ? 5 : 1;

  return (
    <View>
      <View className="flex-row justify-between items-start mb-2">
        <View>
          <Text className="text-3xl font-bold text-white mb-1">{t('onboarding.oneLastThing')}</Text>
          <Text className="text-zinc-400 text-base mb-6 w-64">
            A <Text className="text-white font-bold">non-medical suggestion</Text> based on your stats.
          </Text>
        </View>
        <TouchableOpacity
          className="bg-purple-900/40 border border-purple-500/30 p-3 rounded-xl items-center justify-center"
          onPress={() => Alert.alert(t('onboarding.aiCoachComingSoon'))}
        >
          <Sparkles size={20} color="#c084fc" />
        </TouchableOpacity>
      </View>

      {/* Ratios Toggle */}
      <TouchableOpacity
        onPress={() => setIsLocked(!isLocked)}
        className="flex-row items-center mb-4 self-start bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800"
      >
        {isLocked ? <Lock size={16} color="#4ade80" /> : <Unlock size={16} color="#fbbf24" />}
        <Text className={`ml-2 font-bold ${isLocked ? 'text-green-400' : 'text-amber-400'}`}>
          {isLocked ? t('onboarding.ratioLocked') : t('onboarding.ratioUnlocked')}
        </Text>
      </TouchableOpacity>

      {/* Calorie Card */}
      <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
        <View className="flex-row justify-between items-end mb-4">
          <Text className="text-zinc-400 font-medium">{t('onboarding.dailyTarget')}</Text>
          <View className="flex-row items-baseline">
            <TextInput
              value={calories.toString()}
              onChangeText={(text) => {
                const v = parseInt(text) || 0;
                updateCalories(v);
              }}
              keyboardType="numeric"
              className="text-3xl font-black text-white p-0"
              style={{ minWidth: 80 }}
              textAlign="right"
              placeholderTextColor="#52525B"
            />
            <Text className="text-sm font-normal text-zinc-500 ml-1">{t('common.kcal')}</Text>
          </View>
        </View>

        {/* Calorie Stepper */}
        <View className="flex-row justify-between items-center bg-zinc-950 p-2 rounded-xl mb-4">
          <TouchableOpacity 
            onPress={() => updateCalories(calories - calStep)} 
            className="h-11 w-11 bg-zinc-800 rounded-lg items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Minus size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-zinc-500 text-xs">{t('onboarding.adjustTotal', { step: calStep })}</Text>
          <TouchableOpacity 
            onPress={() => updateCalories(calories + calStep)} 
            className="h-11 w-11 bg-zinc-800 rounded-lg items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Macros */}
        <View className="gap-4">
          <MacroSlider label={t('food.protein')} val={protein} setVal={(v) => updateMacro('p', v)} color="bg-blue-500" step={macroStep} />
          <MacroSlider label={t('food.carbs')} val={carbs} setVal={(v) => updateMacro('c', v)} color="bg-orange-500" step={macroStep} />
          <MacroSlider label={t('onboarding.fats')} val={fat} setVal={(v) => updateMacro('f', v)} color="bg-yellow-500" step={macroStep} />
        </View>
      </View>

      <View className="flex-row items-center bg-zinc-900/50 p-3 rounded-xl mb-4 border border-zinc-800/50">
        <Info size={18} color="#71717a" className="mr-2" />
        <Text className="text-zinc-500 text-xs flex-1 leading-4">
          {isLocked
            ? t('onboarding.lockedHint')
            : t('onboarding.unlockedHint')}
        </Text>
      </View>
    </View>
  );
}

// Helper Comp for Macro Slider
function MacroSlider({ label, val, setVal, color, step }: { label: string, val: number, setVal: (v: number) => void, color: string, step: number }) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="flex-row justify-between mb-2">
        <Text className="text-white font-bold">{label}</Text>
        <View className="flex-row items-baseline">
          <TextInput
            value={val.toString()}
            onChangeText={(text) => {
              const v = parseInt(text) || 0;
              setVal(v);
            }}
            keyboardType="numeric"
            className="text-zinc-400 font-bold p-0"
            textAlign="right"
            style={{ minWidth: 40 }}
          />
          <Text className="text-zinc-400 ml-1">{t('common.grams')}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity 
          onPress={() => setVal(Math.max(0, val - step))} 
          className="h-9 w-9 bg-zinc-800 rounded items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Minus size={16} color="gray" />
        </TouchableOpacity>
        <View className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <View className={`h-full ${color}`} style={{ width: '100%' }} />
        </View>
        <TouchableOpacity 
          onPress={() => setVal(val + step)} 
          className="h-9 w-9 bg-zinc-800 rounded items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Plus size={16} color="gray" />
        </TouchableOpacity>
      </View>
    </View>
  )
}
