import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // e.g. "8-12"
  weight?: number;
  restTime: number; // seconds
  executionTime: number; // seconds
  executionName?: string;
  executionTime2?: number; // seconds (optional second phase)
  executionName2?: string;
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  duration: number; // minutes (Calculated)
  exercises: Exercise[];
  lastPerformed?: string; // ISO Date
}

export interface WorkoutState {
  workouts: Workout[];
  schedule: Record<string, string[]>; // Key: "Monday", "Tuesday", etc. Value: workoutId[]

  // Actions
  addWorkout: (workout: Workout) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  toggleWorkoutForDay: (day: string, workoutId: string) => void;
  getWorkoutsForDay: (day: string) => Workout[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: [
        {
          id: '1',
          name: 'Push Day A',
          duration: 45,
          exercises: [
            { id: 'e1', name: 'Bench Press', sets: 3, reps: '8-12', restTime: 90, executionTime: 45 },
            { id: 'e2', name: 'Overhead Press', sets: 3, reps: '8-12', restTime: 90, executionTime: 45 },
            { id: 'e3', name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restTime: 60, executionTime: 40 },
            { id: 'e4', name: 'Lateral Raises', sets: 4, reps: '15-20', restTime: 45, executionTime: 30 },
            { id: 'e5', name: 'Tricep Pushdowns', sets: 3, reps: '12-15', restTime: 45, executionTime: 30 },
            { id: 'e6', name: 'Skullcrushers', sets: 3, reps: '10-12', restTime: 60, executionTime: 40 },
          ],
          lastPerformed: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Pull Day A',
          duration: 50,
          exercises: [
            { id: 'e7', name: 'Pull Ups', sets: 3, reps: 'AMRAP', restTime: 120, executionTime: 60 },
            { id: 'e8', name: 'Barbell Rows', sets: 3, reps: '8-12', restTime: 90, executionTime: 45 },
            { id: 'e9', name: 'Face Pulls', sets: 4, reps: '15-20', restTime: 60, executionTime: 30 },
            { id: 'e10', name: 'Bicep Curls', sets: 3, reps: '10-12', restTime: 60, executionTime: 40 },
          ],
        }
      ],
      schedule: {
        'Monday': ['1'],
        'Tuesday': ['2'],
        'Wednesday': [],
        'Thursday': ['1'],
        'Friday': ['2'],
        'Saturday': [],
        'Sunday': [],
      },

      addWorkout: (workout) => set((state) => ({
        workouts: [...state.workouts, workout]
      })),

      updateWorkout: (id, updates) => set((state) => ({
        workouts: state.workouts.map((w) => w.id === id ? { ...w, ...updates } : w)
      })),

      deleteWorkout: (id) => set((state) => {
        // Also remove from schedule
        const newSchedule = { ...state.schedule };
        Object.keys(newSchedule).forEach(day => {
          newSchedule[day] = newSchedule[day].filter(wId => wId !== id);
        });
        return {
          workouts: state.workouts.filter((w) => w.id !== id),
          schedule: newSchedule
        };
      }),

      toggleWorkoutForDay: (day, workoutId) => set((state) => {
        const current = state.schedule[day] || [];
        const exists = current.includes(workoutId);

        return {
          schedule: {
            ...state.schedule,
            [day]: exists
              ? current.filter(id => id !== workoutId)
              : [...current, workoutId]
          }
        };
      }),

      getWorkoutsForDay: (day) => {
        const { workouts, schedule } = get();
        const workoutIds = schedule[day] || [];
        return workoutIds.map(id => workouts.find(w => w.id === id)).filter((w): w is Workout => !!w);
      }
    }),
    {
      name: 'workout-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4, // Bump version
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;

        // Migration 0 -> 1 (Schedule Schema)
        if (version === 0) {
          const newSchedule: Record<string, string[]> = {};
          const oldSchedule = state.schedule || {};
          Object.keys(oldSchedule).forEach(day => {
            const val = oldSchedule[day];
            newSchedule[day] = typeof val === 'string' ? [val] : [];
          });
          state = { ...state, schedule: newSchedule };
        }

        // Migration 1 -> 2 (Remove Difficulty, Add Timing)
        if (version <= 1) {
          const newWorkouts = (state.workouts || []).map((w: any) => ({
            ...w,
            difficulty: undefined, // Remove field
            exercises: w.exercises.map((e: any) => ({
              ...e,
              restTime: e.restTime || 60,
              executionTime: e.executionTime || 45
            }))
          }));
          state = { ...state, workouts: newWorkouts };
        }

        // Migration 2 -> 3 (Add executionTime2)
        if (version <= 2) {
          const newWorkouts = (state.workouts || []).map((w: any) => ({
            ...w,
            exercises: w.exercises.map((e: any) => ({
              ...e,
              executionTime2: e.executionTime2 || undefined
            }))
          }));
          state = { ...state, workouts: newWorkouts };
        }

        // Migration 3 -> 4 (Add names)
        if (version <= 3) {
          const newWorkouts = (state.workouts || []).map((w: any) => ({
            ...w,
            exercises: w.exercises.map((e: any) => ({
              ...e,
              executionName: e.executionName || undefined,
              executionName2: e.executionName2 || undefined
            }))
          }));
          state = { ...state, workouts: newWorkouts };
        }

        return state;
      },
    }
  )
);
