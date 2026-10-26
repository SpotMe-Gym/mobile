import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage, userMMKV, LEGACY_WEIGHT_KEY } from '@/shared/lib/storage';
import type { Macros } from '@/features/nutrition/utils/nutrition';

/** 'neutral' = "Neutral / prefer not to say" (formerly 'other'). */
export type Gender = 'male' | 'female' | 'neutral';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'super';
export type Goal = 'lose' | 'maintain' | 'gain';
export type LanguagePref = 'system' | 'en' | 'it';
export type WeightUnit = 'kg' | 'lbs';
export type HeightUnit = 'cm' | 'ft';

export const DEFAULT_TARGETS: Macros = { kcal: 2800, protein: 180, carbs: 300, fat: 80 };

export interface UserProfile {
  name: string;
  gender: Gender | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  targets: Macros;
}

interface UserState extends UserProfile {
  hasCompletedOnboarding: boolean;
  units: { weight: WeightUnit; height: HeightUnit };
  language: LanguagePref;

  completeOnboarding: (profile: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setTargets: (targets: Macros) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setHeightUnit: (unit: HeightUnit) => void;
  setLanguage: (language: LanguagePref) => void;
  resetUser: () => void;
}

const initialState = {
  name: '',
  gender: null,
  heightCm: null,
  age: null,
  activityLevel: null,
  goal: null,
  targets: DEFAULT_TARGETS,
  hasCompletedOnboarding: false,
  units: { weight: 'kg', height: 'cm' },
  language: 'system',
} satisfies Omit<UserState, keyof UserActions>;

type UserActions = Pick<
  UserState,
  | 'completeOnboarding'
  | 'updateProfile'
  | 'setTargets'
  | 'setWeightUnit'
  | 'setHeightUnit'
  | 'setLanguage'
  | 'resetUser'
>;

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,
      completeOnboarding: (profile) => set({ ...profile, hasCompletedOnboarding: true }),
      updateProfile: (patch) => set(patch),
      setTargets: (targets) => set({ targets }),
      setWeightUnit: (unit) => set((s) => ({ units: { ...s.units, weight: unit } })),
      setHeightUnit: (unit) => set((s) => ({ units: { ...s.units, height: unit } })),
      setLanguage: (language) => set({ language }),
      resetUser: () => set(initialState),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => mmkvStateStorage(userMMKV)),
      version: 2,
      migrate: (persisted, version) => migrateUserState(persisted, version),
    },
  ),
);

// ---------------------------------------------------------------------------
// Migrations (exported for tests)
// ---------------------------------------------------------------------------

const GENDER_V0: Record<string, Gender> = { Male: 'male', Female: 'female', Other: 'neutral' };
const ACTIVITY_V0: Record<string, ActivityLevel> = {
  Sedentary: 'sedentary',
  'Lightly Active': 'light',
  'Moderately Active': 'moderate',
  'Very Active': 'very',
  'Super Active': 'super',
};
const GOAL_V0: Record<string, Goal> = {
  'Lose Weight': 'lose',
  'Maintain Weight': 'maintain',
  'Gain Muscle': 'gain',
};

const toNumberOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function migrateUserState(persisted: unknown, version: number): Partial<UserState> {
  const s = isRecord(persisted) ? persisted : {};
  if (version >= 2) return s as Partial<UserState>;
  // v1 → v2: 'other' became 'neutral' ("Neutral / prefer not to say").
  if (version === 1) return { ...s, gender: s.gender === 'other' ? 'neutral' : s.gender } as Partial<UserState>;

  // v0 → v1: string numbers → numbers, display labels → enum ids, calories → kcal,
  // weight history moves to its own store (handed off through a one-shot MMKV key).
  const legacyHistory = Array.isArray(s.weightHistory) ? s.weightHistory : [];
  const legacyCurrent = toNumberOrNull(s.weight);
  if (legacyHistory.length > 0 || legacyCurrent !== null) {
    userMMKV.set(LEGACY_WEIGHT_KEY, JSON.stringify({ history: legacyHistory, current: legacyCurrent }));
  }

  const t = isRecord(s.targets) ? s.targets : {};
  const units = isRecord(s.units) ? s.units : {};
  return {
    name: typeof s.name === 'string' ? s.name : '',
    gender: typeof s.gender === 'string' ? (GENDER_V0[s.gender] ?? null) : null,
    heightCm: toNumberOrNull(s.height),
    age: toNumberOrNull(s.age),
    activityLevel: typeof s.activityLevel === 'string' ? (ACTIVITY_V0[s.activityLevel] ?? null) : null,
    goal: typeof s.goal === 'string' ? (GOAL_V0[s.goal] ?? null) : null,
    targets: {
      kcal: toNumberOrNull(t.calories) ?? DEFAULT_TARGETS.kcal,
      protein: toNumberOrNull(t.protein) ?? DEFAULT_TARGETS.protein,
      carbs: toNumberOrNull(t.carbs) ?? DEFAULT_TARGETS.carbs,
      fat: toNumberOrNull(t.fat) ?? DEFAULT_TARGETS.fat,
    },
    hasCompletedOnboarding: s.hasCompletedOnboarding === true,
    units: {
      weight: units.weight === 'lbs' ? 'lbs' : 'kg',
      height: units.height === 'ft' ? 'ft' : 'cm',
    },
    language: 'system',
  };
}
