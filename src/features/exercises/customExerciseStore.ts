import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/shared/lib/ids';
import { CUSTOM_PREFIX } from '@/features/exercises/library';

/** An exercise someone added that isn't in the library. Synced (custom_exercises). */
export interface CustomExercise {
  id: string;
  name: string;
  muscles: string[];
  equipment?: string;
  createdAt: string;
}

interface CustomExerciseState {
  exercises: CustomExercise[];
  add: (input: { name: string; muscles: string[]; equipment?: string }) => CustomExercise;
  remove: (id: string) => void;
  reset: () => void;
}

export const useCustomExerciseStore = create<CustomExerciseState>()(
  persist(
    (set) => ({
      exercises: [],
      add: ({ name, muscles, equipment }) => {
        const exercise: CustomExercise = {
          id: `${CUSTOM_PREFIX}${newId()}`,
          name: name.trim().slice(0, 80),
          muscles,
          equipment: equipment || undefined,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ exercises: [...s.exercises, exercise] }));
        return exercise;
      },
      remove: (id) => set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) })),
      reset: () => set({ exercises: [] }),
    }),
    { name: 'custom-exercise-storage', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
