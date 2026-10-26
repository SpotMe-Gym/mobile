import { z } from 'zod';

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, 'required').max(50, 'tooLong'),
  gender: z
    .enum(['male', 'female', 'neutral'], { message: 'required' })
    .nullable()
    .refine((v) => v !== null, 'required'),
  age: z.number({ message: 'required' }).int().min(13, 'range').max(100, 'range'),
  heightCm: z
    .number({ message: 'required' })
    .min(100, 'range')
    .max(250, 'range')
    .nullable()
    .refine((v) => v !== null, 'required'),
  weightKg: z
    .number({ message: 'required' })
    .min(30, 'range')
    .max(300, 'range')
    .nullable()
    .refine((v) => v !== null, 'required'),
  activity: z
    .enum(['sedentary', 'light', 'moderate', 'very', 'super'])
    .nullable()
    .refine((v) => v !== null, 'required'),
  goal: z
    .enum(['lose', 'maintain', 'gain'])
    .nullable()
    .refine((v) => v !== null, 'required'),
  targets: z.object({
    kcal: z.number().min(1200).max(10000),
    protein: z.number().min(0).max(1000),
    carbs: z.number().min(0).max(2000),
    fat: z.number().min(0).max(1000),
  }),
  ratioLocked: z.boolean(),
});

export type OnboardingValues = z.input<typeof onboardingSchema>;

export const STEP_FIELDS = {
  1: ['name', 'gender', 'age', 'heightCm', 'weightKg'],
  2: ['activity', 'goal'],
  3: ['targets'],
} as const satisfies Record<1 | 2 | 3, readonly (keyof OnboardingValues)[]>;
