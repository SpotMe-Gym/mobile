import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({
  id: 'user-storage',
});

const mmkvStorage: StateStorage = {
  setItem: (name, value) => {
    return storage.set(name, value);
  },
  getItem: (name) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};

export interface UserState {
  name: string;
  gender: 'Male' | 'Female' | 'Other' | null;
  height: string; // Stored in CM
  weight: string; // Stored in KG
  age: string;
  hasCompletedOnboarding: boolean;
  weightHistory: Array<{ id?: string; date: string; weight: number }>; // weight in KG
  units: {
    weight: 'kg' | 'lbs';
    height: 'cm' | 'ft';
  };

  setName: (name: string) => void;
  setGender: (gender: 'Male' | 'Female' | 'Other') => void;
  setHeight: (height: string) => void;
  setWeight: (weight: string) => void;
  addWeightEntry: (weight: string, date: string) => void;
  removeWeightEntry: (id: string) => void;
  setAge: (age: string) => void;
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setHeightUnit: (unit: 'cm' | 'ft') => void;
  completeOnboarding: () => void;
  resetUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      name: '',
      gender: null,
      height: '',
      weight: '',
      age: '',
      hasCompletedOnboarding: false,
      weightHistory: [],
      units: {
        weight: 'kg',
        height: 'cm',
      },

      setName: (name) => set({ name }),
      setGender: (gender) => set({ gender }),
      setHeight: (height) => set({ height }),
      setWeight: (weight) => set((state) => {
        // When setting current weight, always add a new entry to history
        const today = new Date().toISOString().split('T')[0];
        const newHistory = [...(state.weightHistory || [])];

        // Generate a unique ID
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        newHistory.push({ id, date: today, weight: parseFloat(weight) });

        // Sort by date
        newHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { weight, weightHistory: newHistory };
      }),
      addWeightEntry: (weight, date) => set((state) => {
        const newHistory = [...(state.weightHistory || [])];

        // Always add new entry, never overwrite
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        newHistory.push({ id, date, weight: parseFloat(weight) });

        newHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Update current weight if this new entry is the most recent or equal to today
        // actually, we should just take the last entry in the sorted list as current weight
        const latestEntry = newHistory[newHistory.length - 1];

        return {
          weightHistory: newHistory,
          weight: latestEntry ? latestEntry.weight.toString() : state.weight
        };
      }),
      removeWeightEntry: (id) => set((state) => {
        // Filter out the entry with the given ID
        // For legacy entries without ID, we can't easily target them individually here without more logic,
        // but new ones will work.
        const newHistory = state.weightHistory.filter(e => e.id !== id);

        // Update current weight to the *new* latest entry
        const latestEntry = newHistory[newHistory.length - 1];

        return {
          weightHistory: newHistory,
          weight: latestEntry ? latestEntry.weight.toString() : '' // Fallback to empty if no history
        };
      }),
      setAge: (age) => set({ age }),
      setWeightUnit: (unit) => set((state) => ({ units: { ...state.units, weight: unit } })),
      setHeightUnit: (unit) => set((state) => ({ units: { ...state.units, height: unit } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetUser: () => set({ name: '', gender: null, height: '', weight: '', age: '', hasCompletedOnboarding: false, weightHistory: [], units: { weight: 'kg', height: 'cm' } }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
