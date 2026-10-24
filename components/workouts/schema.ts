import { z } from 'zod';

const exerciseSchema = z.object({
  id: z.string(),
  type: z.enum(['exercise', 'rest']),
  name: z.string().trim().max(60),
  sets: z.number().int().min(0).max(30),
  reps: z.string().trim().max(20),
  weight: z.number().optional(),
  restTime: z.number().int().min(0).max(1800),
  executionTime: z.number().int().min(0).max(1800),
  executionName: z.string().max(30).optional(),
  executionTime2: z.number().int().min(0).max(1800).optional(),
  executionName2: z.string().max(30).optional(),
  notes: z.string().optional(),
});

export const workoutFormSchema = z
  .object({
    name: z.string().trim().min(1, 'nameRequired').max(60),
    days: z.array(z.number().int().min(1).max(7)),
    exercises: z.array(exerciseSchema),
  })
  .refine((v) => v.exercises.some((e) => e.type === 'rest' || e.name.length > 0), {
    path: ['exercises'],
    message: 'exerciseRequired',
  });

export type WorkoutFormValues = z.input<typeof workoutFormSchema>;
export type ExerciseFormValues = WorkoutFormValues['exercises'][number];
