import { useState, useEffect } from 'react';
import { View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '../store/userStore';
import { Button } from '../components/ui/Button';
import { ChevronLeft } from 'lucide-react-native';

import { Step1Bio } from '../components/onboarding/Step1Bio';
import { Step2Goals, ACTIVITY_LEVELS, GOALS } from '../components/onboarding/Step2Goals';
import { Step3Nutrition } from '../components/onboarding/Step3Nutrition';

export default function Onboarding() {
  const router = useRouter();
  const { setName, setGender, setHeight, setWeight, setAge, setActivityLevel, setGoal, setTargets, completeOnboarding } = useUserStore();

  const [step, setStep] = useState(1);

  // Bio State
  const [form, setForm] = useState({
    name: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    height: '',
    weight: '',
    age: '25',
  });

  // Strategy State
  const [activityIndex, setActivityIndex] = useState<number | null>(null);
  const [goalIndex, setGoalIndex] = useState<number | null>(null);

  // Nutrition State
  const [calories, setCalories] = useState(2500);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(250);
  const [fat, setFat] = useState(70);
  const [isLocked, setIsLocked] = useState(true);

  // Constants
  const MIN_CALS = 1200;
  const MAX_CALS = 10000;

  // Initial Calculation Effect
  useEffect(() => {
    if (step === 3 && activityIndex !== null && goalIndex !== null) {
      calculateSuggestion();
    }
  }, [step]);

  const calculateSuggestion = () => {
    if (activityIndex === null || goalIndex === null) return;

    // Mifflin-St Jeor
    const w = parseFloat(form.weight) || 75;
    const h = parseFloat(form.height) || 180;
    const a = parseInt(form.age) || 25;
    const gender = form.gender;

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    if (gender === 'Male') bmr += 5;
    else if (gender === 'Female') bmr -= 161;
    else bmr -= 78;

    const tdee = Math.round(bmr * ACTIVITY_LEVELS[activityIndex].multiplier);
    const targetCals = tdee + GOALS[goalIndex].calOffset;

    const p = Math.round((targetCals * 0.3) / 4);
    const c = Math.round((targetCals * 0.4) / 4);
    const f = Math.round((targetCals * 0.3) / 9);

    setCalories(targetCals);
    setProtein(p);
    setCarbs(c);
    setFat(f);
    setIsLocked(true); // Default to locked initially
  };

  const updateCalories = (newCals: number) => {
    const c = Math.max(MIN_CALS, Math.min(MAX_CALS, newCals));
    setCalories(c);

    if (isLocked) {
      // Maintain ratios (30/40/30)
      setProtein(Math.round((c * 0.3) / 4));
      setCarbs(Math.round((c * 0.4) / 4));
      setFat(Math.round((c * 0.3) / 9));
    }
  };

  const updateMacro = (type: 'p' | 'c' | 'f', val: number) => {
    let p = protein;
    let c = carbs;
    let f = fat;

    if (type === 'p') p = val;
    if (type === 'c') c = val;
    if (type === 'f') f = val;

    setProtein(p);
    setCarbs(c);
    setFat(f);

    // Always recalculate Total Calories when Macros change (Physics)
    const newTotal = Math.round((p * 4) + (c * 4) + (f * 9));
    setCalories(newTotal);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!form.name || !form.gender || !form.height || !form.weight || !form.age) {
        Alert.alert("Missing Info", "Please fill in all fields.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (activityIndex === null || goalIndex === null) {
        Alert.alert("Selection Required", "Please select your activity level and goal.");
        return;
      }
      setStep(3);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setName(form.name);
    setGender(form.gender as any);
    setHeight(form.height);
    setWeight(form.weight);
    setAge(form.age);

    if (activityIndex !== null) setActivityLevel(ACTIVITY_LEVELS[activityIndex].label as any);
    if (goalIndex !== null) setGoal(GOALS[goalIndex].label as any);

    setTargets({
      calories,
      protein,
      carbs,
      fat
    });

    completeOnboarding();

    setTimeout(() => {
      router.replace('/');
    }, 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-6">
        {/* Header / Progress */}
        <View className="flex-row items-center justify-between mb-8">
          {step > 1 ? (
            <TouchableOpacity onPress={handleBack} className="p-2 bg-zinc-900 rounded-full">
              <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
          ) : <View className="w-10" />}

          <View className="flex-row gap-2">
            {[1, 2, 3].map(i => (
              <View key={i} className={`h-2 w-8 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-zinc-800'}`} />
            ))}
          </View>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {step === 1 && <Step1Bio form={form} setForm={setForm} />}

          {step === 2 && (
            <Step2Goals
              activityIndex={activityIndex}
              setActivityIndex={setActivityIndex}
              goalIndex={goalIndex}
              setGoalIndex={setGoalIndex}
            />
          )}

          {step === 3 && (
            <Step3Nutrition
              calories={calories}
              updateCalories={updateCalories}
              protein={protein}
              carbs={carbs}
              fat={fat}
              updateMacro={updateMacro}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
            />
          )}
        </ScrollView>

        <View className="py-4">
          <Button
            label={step === 3 ? "Start Journey" : "Next"}
            onPress={handleNext}
            variant="white"
            className="w-full h-14 rounded-xl"
          />
        </View>

      </View>
    </SafeAreaView>
  );
}
