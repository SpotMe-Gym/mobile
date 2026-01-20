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
  height: string;
  weight: string;
  age: string;
  hasCompletedOnboarding: boolean;
  units: {
    weight: 'kg' | 'lbs';
    height: 'cm' | 'ft';
  };

  setName: (name: string) => void;
  setGender: (gender: 'Male' | 'Female' | 'Other') => void;
  setHeight: (height: string) => void;
  setWeight: (weight: string) => void;
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
      units: {
        weight: 'kg',
        height: 'cm',
      },

      setName: (name) => set({ name }),
      setGender: (gender) => set({ gender }),
      setHeight: (height) => set({ height }),
      setWeight: (weight) => set({ weight }),
      setAge: (age) => set({ age }),
      setWeightUnit: (unit) => set((state) => ({ units: { ...state.units, weight: unit } })),
      setHeightUnit: (unit) => set((state) => ({ units: { ...state.units, height: unit } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetUser: () => set({ name: '', gender: null, height: '', weight: '', age: '', hasCompletedOnboarding: false, units: { weight: 'kg', height: 'cm' } }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
