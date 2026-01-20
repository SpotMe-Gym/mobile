import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserState {
  name: string;
  gender: 'Male' | 'Female' | 'Other' | null;
  height: string;
  weight: string;
  hasCompletedOnboarding: boolean;

  setName: (name: string) => void;
  setGender: (gender: 'Male' | 'Female' | 'Other') => void;
  setHeight: (height: string) => void;
  setWeight: (weight: string) => void;
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
      hasCompletedOnboarding: false,

      setName: (name) => set({ name }),
      setGender: (gender) => set({ gender }),
      setHeight: (height) => set({ height }),
      setWeight: (weight) => set({ weight }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetUser: () => set({ name: '', gender: null, height: '', weight: '', hasCompletedOnboarding: false }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
