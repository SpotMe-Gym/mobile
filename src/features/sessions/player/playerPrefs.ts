import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Player settings that stick between workouts. */
export const usePlayerPrefs = create<{ sound: boolean; toggleSound: () => void }>()(
  persist((set) => ({ sound: true, toggleSound: () => set((s) => ({ sound: !s.sound })) }), {
    name: 'player-prefs',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);
