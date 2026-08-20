import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, Clock, Dumbbell, Minus, ChevronUp, ChevronDown, Armchair } from 'lucide-react-native';
import { useWorkoutStore, Exercise } from '../../store/workoutStore';
import { v4 as uuidv4 } from 'uuid';
import { Icon } from '@/components/ui/Icon';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated';

const ExerciseCard = React.memo(({
  ex,
  index,
  totalCount,
  updateExercise,
  removeExercise,
  moveExercise
}: {
  ex: Exercise,
  index: number,
  totalCount: number,
  updateExercise: (id: string, field: keyof Exercise, value: any) => void,
  removeExercise: (id: string) => void,
  moveExercise: (index: number, direction: 'up' | 'down') => void
}) => {
  const hasExecution = (ex.executionTime !== undefined && ex.executionTime > 0) || (ex.executionTime2 !== undefined && ex.executionTime2 > 0);
  const hasExecution2 = (ex.executionTime2 !== undefined && ex.executionTime2 > 0);

  const [showExecution, setShowExecution] = useState(hasExecution);
  const [showExecution2, setShowExecution2] = useState(hasExecution2);

  // Sync local state if props change externally (e.g. from shift)
  useEffect(() => {
    setShowExecution((ex.executionTime !== undefined && ex.executionTime > 0) || (ex.executionTime2 !== undefined && ex.executionTime2 > 0));
    setShowExecution2((ex.executionTime2 !== undefined && ex.executionTime2 > 0));
  }, [ex.executionTime, ex.executionTime2]);


  // Helper to update seconds
  const updateTime = (field: 'restTime' | 'executionTime' | 'executionTime2', min: string, sec: string) => {
    const m = parseInt(min) || 0;
    const s = parseInt(sec) || 0;
    updateExercise(ex.id, field, (m * 60) + s);
  }

  const getMin = (seconds?: number) => seconds ? Math.floor(seconds / 60).toString() : '';
  const getSec = (seconds?: number) => seconds ? (seconds % 60).toString().padStart(2, '0') : '';

  // --- REST CARD VARIANT ---
  if (ex.type === 'rest') {
    return (
      <View className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-3 mb-4 flex-row items-center">
        {/* Left Controls (Mini version) */}
        <View className="items-center justify-center mr-3 gap-0">
          <TouchableOpacity 
            onPress={() => moveExercise(index, 'up')} 
            disabled={index === 0}
            hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
            className={`p-2 ${index === 0 ? 'opacity-20' : ''}`}>
            <Icon icon={ChevronUp} size={16} color="#71717a" />
          </TouchableOpacity>
          <Text className="text-zinc-600 text-xs font-bold">{index + 1}</Text>
          <TouchableOpacity 
            onPress={() => moveExercise(index, 'down')} 
            disabled={index === totalCount - 1}
            hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
            className={`p-2 ${index === totalCount - 1 ? 'opacity-20' : ''}`}>
            <Icon icon={ChevronDown} size={16} color="#71717a" />
          </TouchableOpacity>
        </View>

        {/* Rest Content */}
        <View className="flex-1 flex-row items-center gap-3">
          <View className="bg-amber-900/10 p-2 rounded-xl border border-amber-900/20">
            <Icon icon={Armchair} size={16} color="#d97706" />
          </View>
          <Text className="text-zinc-400 font-bold text-sm mr-auto">Rest Period</Text>

          <View className="flex-row items-center gap-1 bg-zinc-950/30 px-3 py-2 rounded-xl border border-zinc-800/30">
            <TextInput
              placeholder="0"
              placeholderTextColor="#3f3f46"
              className="text-white font-bold text-base text-right min-w-[20px] p-0"
              keyboardType="numeric"
              defaultValue={getMin(ex.restTime)}
              onChangeText={(t) => updateTime('restTime', t, getSec(ex.restTime))}
              selectTextOnFocus
            />
            <Text className="text-zinc-600 text-xs font-medium pt-1">m</Text>
            <TextInput
              placeholder="00"
              placeholderTextColor="#3f3f46"
              className="text-white font-bold text-base text-right min-w-[28px] p-0"
              keyboardType="numeric"
              defaultValue={getSec(ex.restTime)}
              onChangeText={(t) => updateTime('restTime', getMin(ex.restTime), t)}
              selectTextOnFocus
            />
            <Text className="text-zinc-600 text-xs font-medium pt-1">s</Text>
          </View>

          <TouchableOpacity onPress={() => removeExercise(ex.id)} className="p-2 ml-1">
            <Icon icon={Trash2} size={16} color="#ef4444" opacity={0.8} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-4 flex-row">
      {/* Left Column: Reordering Controls */}
      <View className="items-center justify-center mr-3 gap-0">
        <TouchableOpacity
          onPress={() => moveExercise(index, 'up')}
          disabled={index === 0}
          hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
          className={`p-2 rounded-full ${index === 0 ? 'opacity-20' : 'bg-zinc-800 border border-zinc-700'}`}
        >
          <Icon icon={ChevronUp} size={16} color="#a1a1aa" />
        </TouchableOpacity>

        <View className="bg-zinc-800 h-7 w-7 rounded-full items-center justify-center border border-zinc-700 my-1">
          <Text className="text-zinc-400 text-xs font-bold">{index + 1}</Text>
        </View>

        <TouchableOpacity
          onPress={() => moveExercise(index, 'down')}
          disabled={index === totalCount - 1}
          hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
          className={`p-2 rounded-full ${index === totalCount - 1 ? 'opacity-20' : 'bg-zinc-800 border border-zinc-700'}`}
        >
          <Icon icon={ChevronDown} size={16} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      {/* Right Column: Content */}
      <View className="flex-1 gap-4">
        {/* Header: Name & Trash */}
        <View className="flex-row items-center gap-3">
          <TextInput
            className="flex-1 text-white font-bold text-lg"
            placeholder="Exercise Name"
            placeholderTextColor="#52525b"
            value={ex.name}
            onChangeText={(t) => updateExercise(ex.id, 'name', t)}
          />
          <TouchableOpacity onPress={() => removeExercise(ex.id)} className="p-2 bg-zinc-950/30 rounded-full">
            <Icon icon={Trash2} size={18} color="#ef4444" opacity={0.8} />
          </TouchableOpacity>
        </View>

        {/* Sets / Reps Row */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-zinc-950/40 rounded-2xl p-4 flex-row items-center justify-between border border-zinc-800/50">
            <Text className="text-zinc-500 text-[10px] font-bold tracking-widest text-zinc-600">SETS</Text>
            <TextInput
              className="text-white font-bold text-lg text-right px-2 min-w-[40px]"
              value={ex.sets.toString()}
              onChangeText={(t) => updateExercise(ex.id, 'sets', parseInt(t) || 0)}
              keyboardType="numeric"
              selectTextOnFocus
            />
          </View>
          <View className="flex-1 bg-zinc-950/40 rounded-2xl p-4 flex-row items-center justify-between border border-zinc-800/50">
            <Text className="text-zinc-500 text-[10px] font-bold tracking-widest text-zinc-600">REPS</Text>
            <TextInput
              className="text-white font-bold text-lg text-right px-2 min-w-[40px]"
              value={ex.reps}
              onChangeText={(t) => updateExercise(ex.id, 'reps', t)}
              selectTextOnFocus
            />
          </View>
        </View>

        {/* Rest Time Row */}
        <View className="flex-row gap-3 items-center">
          <View className="flex-1 bg-zinc-950/40 rounded-2xl p-4 flex-row items-center border border-zinc-800/50 gap-3">
            <Clock size={16} color="#71717a" />
            <Text className="text-zinc-500 text-[10px] font-bold tracking-widest mr-auto mt-0.5">REST</Text>
            <View className="flex-row items-center gap-1">
              <TextInput
                placeholder="0"
                placeholderTextColor="#3f3f46"
                className="text-white font-bold text-lg text-right min-w-[20px]"
                keyboardType="numeric"
                defaultValue={getMin(ex.restTime)}
                onChangeText={(t) => updateTime('restTime', t, getSec(ex.restTime))}
                selectTextOnFocus
              />
              <Text className="text-zinc-600 text-xs font-medium pt-1">m</Text>
              <TextInput
                placeholder="00"
                placeholderTextColor="#3f3f46"
                className="text-white font-bold text-lg text-right min-w-[28px]"
                keyboardType="numeric"
                defaultValue={getSec(ex.restTime)}
                onChangeText={(t) => updateTime('restTime', getMin(ex.restTime), t)}
                selectTextOnFocus
              />
              <Text className="text-zinc-600 text-xs font-medium pt-1">s</Text>
            </View>
          </View>
        </View>

        {/* Execution Phases Logic */}
        {/* Phase 1 */}
        {(showExecution) && (
          <View className="flex-row gap-3 items-center">
            <View className="flex-1 bg-blue-950/10 rounded-2xl p-4 flex-row items-center border border-blue-900/20 gap-3">
              <Dumbbell size={16} color="#60a5fa" />
              <TextInput
                className="text-blue-500 text-xs font-bold tracking-widest mr-auto min-w-[60px] p-0"
                placeholder="EXECUTION"
                placeholderTextColor="rgba(96, 165, 250, 0.5)"
                value={ex.executionName || ''}
                onChangeText={(t) => updateExercise(ex.id, 'executionName', t)}
              />
              <View className="flex-row items-center gap-1">
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#1e3a8a"
                  className="text-white font-bold text-lg text-right min-w-[20px] p-0"
                  keyboardType="numeric"
                  defaultValue={getMin(ex.executionTime)}
                  onChangeText={(t) => updateTime('executionTime', t, getSec(ex.executionTime))}
                  selectTextOnFocus
                />
                <Text className="text-blue-500/50 text-xs font-medium pt-1">m</Text>
                <TextInput
                  placeholder="00"
                  placeholderTextColor="#1e3a8a"
                  className="text-white font-bold text-lg text-right min-w-[28px] p-0"
                  keyboardType="numeric"
                  defaultValue={getSec(ex.executionTime)}
                  onChangeText={(t) => updateTime('executionTime', getMin(ex.executionTime), t)}
                  selectTextOnFocus
                />
                <Text className="text-blue-500/50 text-xs font-medium pt-1">s</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                // Phase Shift Logic
                if (showExecution2) {
                  // Shift value 2 to 1
                  updateExercise(ex.id, 'executionTime', ex.executionTime2);
                  updateExercise(ex.id, 'executionName', ex.executionName2);
                  // Clear 2
                  updateExercise(ex.id, 'executionTime2', 0);
                  updateExercise(ex.id, 'executionName2', '');
                  setShowExecution2(false);
                } else {
                  setShowExecution(false);
                  updateExercise(ex.id, 'executionTime', 0);
                  updateExercise(ex.id, 'executionName', '');
                }
              }}
              className="bg-zinc-800/30 h-14 w-14 rounded-2xl items-center justify-center border border-zinc-800 active:bg-zinc-800"
            >
              <Icon icon={Minus} size={18} color="#71717a" />
            </TouchableOpacity>
          </View>
        )}

        {/* Phase 2: Tempo / Negative */}
        {showExecution && showExecution2 && (
          <View className="flex-row gap-3 items-center">
            <View className="flex-1 bg-purple-950/10 rounded-2xl p-4 flex-row items-center border border-purple-900/20 gap-3">
              <Dumbbell size={16} color="#c084fc" />
              <TextInput
                className="text-purple-500 text-xs font-bold tracking-widest mr-auto min-w-[60px] p-0"
                placeholder="ALT. EXECUTION"
                placeholderTextColor="rgba(192, 132, 252, 0.5)"
                value={ex.executionName2 || ''}
                onChangeText={(t) => updateExercise(ex.id, 'executionName2', t)}
              />
              <View className="flex-row items-center gap-1">
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#4c1d95"
                  className="text-white font-bold text-lg text-right min-w-[20px] p-0"
                  keyboardType="numeric"
                  defaultValue={getMin(ex.executionTime2)}
                  onChangeText={(t) => updateTime('executionTime2', t, getSec(ex.executionTime2))}
                  selectTextOnFocus
                />
                <Text className="text-purple-500/50 text-xs font-medium pt-1">m</Text>
                <TextInput
                  placeholder="00"
                  placeholderTextColor="#4c1d95"
                  className="text-white font-bold text-lg text-right min-w-[28px] p-0"
                  keyboardType="numeric"
                  defaultValue={getSec(ex.executionTime2)}
                  onChangeText={(t) => updateTime('executionTime2', getMin(ex.executionTime2), t)}
                  selectTextOnFocus
                />
                <Text className="text-purple-500/50 text-xs font-medium pt-1">s</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowExecution2(false);
                updateExercise(ex.id, 'executionTime2', 0);
                updateExercise(ex.id, 'executionName2', '');
              }}
              className="bg-zinc-800/30 h-14 w-14 rounded-2xl items-center justify-center border border-zinc-800 active:bg-zinc-800"
            >
              <Icon icon={Minus} size={18} color="#71717a" />
            </TouchableOpacity>
          </View>
        )}

        {/* Add Phase Buttons */}
        {(!showExecution || !showExecution2) && (
          <TouchableOpacity
            onPress={() => {
              if (!showExecution) setShowExecution(true);
              else setShowExecution2(true);
            }}
            className="flex-row items-center justify-center p-3 rounded-xl bg-zinc-800/30 border border-dashed border-zinc-700 active:bg-zinc-800"
          >
            <Icon icon={Plus} size={14} color="#71717a" className="mr-2" />
            <Text className="text-zinc-500 text-xs font-bold">Add Execution Time</Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
});

export default function CreateWorkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const editId = typeof params.id === 'string' ? params.id : undefined;

  const { workouts, addWorkout, updateWorkout, schedule, toggleWorkoutForDay } = useWorkoutStore();
  const existing = editId ? workouts.find(w => w.id === editId) : undefined;

  const [name, setName] = useState(existing?.name || '');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Initialize schedule sync in useEffect...
  useEffect(() => {
    if (existing && editId) {
      const days = Object.keys(schedule).filter(day => {
        return schedule[day]?.includes(editId);
      });
      setSelectedDays(days);
    }
  }, [existing, editId, schedule]);

  const [exercises, setExercises] = useState<Exercise[]>(
    existing?.exercises || [{ id: uuidv4(), name: '', sets: 3, reps: '10', restTime: 60, executionTime: 45, type: 'exercise' }]
  );

  const fadeProgress = useSharedValue(0);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  const saveButtonStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
  }));

  const showSaveButton = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    cancelAnimation(fadeProgress);
    fadeProgress.value = withTiming(1, { duration: 200 });
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      fadeProgress.value = withTiming(0, { duration: 300 });
    }, 3500);
  }, []);

  const onInteraction = useCallback(() => {
    showSaveButton();
    scheduleHide();
  }, [showSaveButton, scheduleHide]);


  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a workout name");
      return;
    }
    const validExercises = exercises.filter(e => e.type === 'rest' || e.name.trim());
    if (validExercises.length === 0) {
      alert("Please add at least one exercise or rest period");
      return;
    }

    // Auto-calculate duration: Sum of (Sets * (Execution + Rest))
    // Converted to Minutes roughly
    const totalSeconds = validExercises.reduce((acc, ex) => {
      if (ex.type === 'rest') {
        return acc + (ex.restTime || 0);
      }
      const setDuration = (ex.executionTime || 0) + (ex.executionTime2 || 0) + (ex.restTime || 0);
      return acc + (setDuration * (ex.sets || 1));
    }, 0);
    const calculatedDuration = Math.ceil(totalSeconds / 60) || 15; // Min 15 mins default if 0

    const workoutData = {
      name,
      duration: calculatedDuration,
      exercises: validExercises
    };

    if (editId) {
      updateWorkout(editId, workoutData);

      // Sync Schedule
      // Remove from all days first to be safe, or smart update
      DAYS.forEach(day => {
        const isSelected = selectedDays.includes(day);
        const currentAssigned = schedule[day] || [];
        const isAssigned = currentAssigned.includes(editId);

        if (isSelected && !isAssigned) {
          toggleWorkoutForDay(day, editId);
        } else if (!isSelected && isAssigned) {
          toggleWorkoutForDay(day, editId);
        }
      });

    } else {
      const newId = uuidv4();
      addWorkout({ id: newId, ...workoutData });
      // Add to schedule
      selectedDays.forEach(day => {
        toggleWorkoutForDay(day, newId);
      });
    }
    router.back();
  };

  const addExercise = useCallback(() => {
    setExercises(prev => [...prev, { id: uuidv4(), name: '', sets: 3, reps: '10', restTime: 60, executionTime: 45, type: 'exercise' }]);
    onInteraction();
  }, [onInteraction]);

  const addRest = useCallback(() => {
    setExercises(prev => [...prev, { id: uuidv4(), name: 'Rest', sets: 0, reps: '', restTime: 120, executionTime: 0, type: 'rest' }]);
    onInteraction();
  }, [onInteraction]);

  const updateExercise = useCallback((id: string, field: keyof Exercise, value: any) => {
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    onInteraction();
  }, [onInteraction]);

  const removeExercise = useCallback((id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    onInteraction();
  }, [onInteraction]);

  const moveExercise = useCallback((index: number, direction: 'up' | 'down') => {
    setExercises(prev => {
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    onInteraction();
  }, [onInteraction]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={editId ? "Edit Workout" : "New Workout"} onBack={() => router.back()} className="mt-8" />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          onScrollBeginDrag={showSaveButton}
          onScrollEndDrag={scheduleHide}
          onMomentumScrollBegin={showSaveButton}
          onMomentumScrollEnd={scheduleHide}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >

          {/* Basic Info */}
          <View className="gap-4 mb-6">
            <View>
              <Text className="text-zinc-400 text-xs font-medium mb-1 ml-1">WORKOUT NAME</Text>
              <TextInput
                className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl text-lg font-bold"
                placeholder="e.g. Push Day A"
                placeholderTextColor="#52525b"
                value={name}
                onChangeText={(t) => { setName(t); onInteraction(); }}
              />
            </View>
            {/* Previously Duration / Difficulty - REMOVED */}
          </View>

          {/* Schedule */}
          <Text className="text-white text-lg font-bold mb-4 mt-8">Weekly Schedule</Text>
          <View className="flex-row justify-between mb-6">
            {DAYS.map((day) => {
              const isSelected = selectedDays.includes(day);
              // Calculate responsive width roughly
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => {
                    onInteraction();
                    if (isSelected) {
                      setSelectedDays(selectedDays.filter(d => d !== day));
                    } else {
                      setSelectedDays([...selectedDays, day]);
                    }
                  }}
                  className={`h-11 w-11 rounded-full items-center justify-center ${isSelected ? 'bg-blue-600' : 'bg-zinc-800'}`}
                >
                  <Text className={`font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Exercises */}
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-white text-lg font-bold">Exercises</Text>
            {exercises.length === 0 && (
              <Text className="text-zinc-500 text-xs italic">No exercises added yet</Text>
            )}
          </View>

          <View className="gap-4 mb-6">
            {exercises.map((ex, index) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                index={index}
                totalCount={exercises.length}
                updateExercise={updateExercise}
                removeExercise={removeExercise}
                moveExercise={moveExercise}
              />
            ))}
          </View>

          {/* Minimalist Add Buttons */}
          <View className="flex-row gap-4 mb-20">
            <Button
              variant="secondary"
              icon={<Icon icon={Plus} size={18} color="#9ca3af" />}
              label="Add Exercise"
              onPress={addExercise}
              className="flex-1 py-4 rounded-2xl"
            />

            <Button
              variant="secondary"
              icon={<Icon icon={Armchair} size={18} color="#d97706" />}
              label="Add Rest"
              onPress={addRest}
              className="flex-1 py-4 rounded-2xl"
            />
          </View>
        </ScrollView>

        <Animated.View
          className="absolute left-4 right-4"
          style={[saveButtonStyle, { bottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <Button
            label="Save Workout"
            className="bg-blue-600 h-14"
            onPress={handleSave}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
