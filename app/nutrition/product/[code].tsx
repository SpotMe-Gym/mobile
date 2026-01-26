import { View, Text, Image, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutritionStore, FoodItem, Meal } from '../../../store/nutritionStore';
import { ChevronLeft, Plus, Utensils } from 'lucide-react-native';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitConverter } from '../../../hooks/useUnitConverter';

const OZ_TO_G = 28.3495;

export default function ProductDetail() {
  const router = useRouter();
  const { t } = useTranslation();
  const { units } = useUnitConverter();
  const isImperial = units.weight === 'lbs';

  const params = useLocalSearchParams();
  // Robust param parsing
  const meal = Array.isArray(params.meal) ? params.meal[0] : params.meal;
  const initialData = Array.isArray(params.initialData) ? params.initialData[0] : params.initialData;

  const { addFood } = useNutritionStore();

  const product = initialData ? JSON.parse(initialData) : null;
  const nutriments = product?.nutriments || {};

  // State
  // Default to 100g or ~3.5oz
  const [amount, setAmount] = useState(isImperial ? '3.5' : '100');

  // Dynamic step sizes
  const stepSizes = isImperial ? [0.1, 1, 5] : [1, 10, 100];
  const [stepSize, setStepSize] = useState<number>(stepSizes[1]); // Default middle step

  // Reset step size if unit system changes (unlikely during session but good practice)
  useEffect(() => {
    setStepSize(isImperial ? 1 : 10);
  }, [isImperial]);

  // Calculate multiplier (convert to grams relative to 100g)
  const multiplier = useMemo(() => {
    const val = parseFloat(amount) || 0;
    if (isImperial) {
      return (val * OZ_TO_G) / 100;
    }
    return val / 100;
  }, [amount, isImperial]);

  // Derived macros
  const calories = Math.round((nutriments["energy-kcal_100g"] || 0) * multiplier);
  const protein = Math.round((nutriments.proteins_100g || 0) * multiplier);
  const carbs = Math.round((nutriments.carbohydrates_100g || 0) * multiplier);
  const fat = Math.round((nutriments.fat_100g || 0) * multiplier);

  const totalMacroMass = protein + carbs + fat || 1;

  const handleAdd = () => {
    if (!product) return;
    const foodItem: FoodItem = {
      id: product.code,
      name: product.product_name,
      calories, protein, carbs, fat,
      brand: product.brands,
      image_url: product.image_url,
    };
    const targetMeal = (meal as Meal['name']) || 'Snack';
    const today = new Date().toISOString().split('T')[0];
    addFood(today, targetMeal, foodItem);
    router.dismiss();
  };

  const adjustAmount = (direction: 1 | -1) => {
    const current = parseFloat(amount) || 0;
    // For float precision in oz
    const next = Math.max(0, current + (direction * stepSize));
    setAmount(isImperial ? next.toFixed(1) : Math.round(next).toString());
  };

  if (!product) return null;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-1 relative">
        {/* Background Blur */}
        <View className="absolute top-0 w-full h-96 opacity-30">
          {product.image_url && (
            <Image source={{ uri: product.image_url }} className="w-full h-full" blurRadius={30} />
          )}
          <View className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
        </View>

        <View className="flex-1 px-6 pt-2">
          {/* Header */}
          <View className="flex-row items-center mb-6 mt-2">
            <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 bg-zinc-800/80 rounded-full items-center justify-center backdrop-blur-md">
              <ChevronLeft size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1 ml-4 mr-10">
              <Text className="text-white font-bold text-center text-lg shadow-black shadow-lg" numberOfLines={1}>{product.product_name}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Image & Title */}
            <View className="items-center mb-10">
              <View className="shadow-2xl shadow-black/80">
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    className="w-48 h-48 rounded-[40px] bg-zinc-900 border-4 border-zinc-800"
                    resizeMode="contain"
                  />
                ) : (
                  <View className="w-48 h-48 rounded-[40px] bg-zinc-900 items-center justify-center border-4 border-zinc-800">
                    <Utensils size={48} color="#52525b" />
                  </View>
                )}
              </View>
              <View className="mt-6 items-center">
                <Text className="text-3xl font-black text-white text-center leading-tight mb-1">{product.product_name}</Text>
                <Text className="text-zinc-400 text-lg font-medium">{product.brands}</Text>
              </View>
            </View>

            {/* Input Control */}
            <View className="bg-zinc-900/90 p-6 rounded-3xl mb-8 border border-zinc-800">
              {/* Step Selector */}
              <View className="flex-row justify-center gap-2 mb-6">
                {stepSizes.map((step) => (
                  <TouchableOpacity
                    key={step}
                    onPress={() => setStepSize(step)}
                    className={`px-4 py-2 rounded-full border ${stepSize === step ? 'bg-blue-600 border-blue-500' : 'bg-zinc-950 border-zinc-800'}`}
                  >
                    <Text className={`font-bold ${stepSize === step ? 'text-white' : 'text-zinc-500'}`}>{step}{isImperial ? t('food.oz') : 'g'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Main Numeric Input */}
              <View className="flex-row items-center justify-between gap-4">
                <TouchableOpacity onPress={() => adjustAmount(-1)} className="h-14 w-14 bg-zinc-800 rounded-2xl items-center justify-center border border-zinc-700 active:scale-95 transition-transform">
                  <Text className="text-zinc-400 text-3xl font-light leading-none pb-1">-</Text>
                </TouchableOpacity>

                <View className="flex-1 items-center">
                  <View className="flex-row items-baseline justify-center">
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      className="text-6xl font-black text-white text-center p-0 min-w-[100px]"
                      selectTextOnFocus
                    />
                    <Text className="text-zinc-500 font-bold text-lg ml-1">{isImperial ? t('food.oz') : t('food.grams')}</Text>
                  </View>
                  <Text className="text-zinc-600 text-xs font-bold tracking-widest uppercase mt-1">{t('food.quantity')}</Text>
                </View>

                <TouchableOpacity onPress={() => adjustAmount(1)} className="h-14 w-14 bg-zinc-800 rounded-2xl items-center justify-center border border-zinc-700 active:scale-95 transition-transform">
                  <Text className="text-white text-3xl font-light leading-none pb-1">+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Macro Stats */}
            <View className="flex-row gap-3 mb-6">
              <MacroStat label={t('food.protein')} value={protein} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
              <MacroStat label={t('food.carbs')} value={carbs} color="text-yellow-400" bg="bg-yellow-500/10" border="border-yellow-500/20" />
              <MacroStat label={t('food.fat')} value={fat} color="text-red-400" bg="bg-red-500/10" border="border-red-500/20" />
            </View>

            {/* Total Energy */}
            <View className="items-center bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800/50">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{t('food.totalEnergy')}</Text>
              <Text className="text-5xl font-black text-white tracking-tighter shadow-lg shadow-blue-900/20">
                {calories} <Text className="text-2xl text-zinc-600 font-bold">kcal</Text>
              </Text>
            </View>

          </ScrollView>

          {/* Floating Action Button */}
          <View className="absolute bottom-8 left-6 right-6">
            <TouchableOpacity
              className="w-full bg-blue-600 h-16 rounded-[20px] flex-row items-center justify-center shadow-lg shadow-blue-500/30 active:opacity-90"
              onPress={handleAdd}
            >
              <Plus size={24} color="white" className="mr-2" />
              <Text className="text-white font-bold text-xl">{t('food.addTo')} {meal || 'Snack'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MacroStat({ label, value, color, bg, border }: any) {
  return (
    <View className={`flex-1 ${bg} border ${border} rounded-2xl p-3 items-center justify-center min-h-[90px]`}>
      <Text className={`text-2xl font-black ${color}`}>{value}g</Text>
      <Text className="text-zinc-500 text-xs font-bold uppercase mt-1">{label}</Text>
    </View>
  );
}
