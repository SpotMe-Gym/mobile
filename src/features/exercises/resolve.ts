import { frameUrls, getLibraryExercise, isCustomId } from '@/features/exercises/library';
import { useCustomExerciseStore } from '@/features/exercises/customExerciseStore';

export interface ResolvedExercise {
  id?: string;
  name: string;
  muscles: string[];
  equipment?: string;
  frames: string[];
  instructions: string[];
  source: 'library' | 'custom' | 'free-text';
}

/** What to show for an exercise in a workout: library entry, custom exercise, or its plain name. */
export function resolveExercise(exerciseId: string | undefined, fallbackName: string): ResolvedExercise {
  const lib = getLibraryExercise(exerciseId);
  if (lib) {
    return {
      id: lib.id,
      name: lib.name,
      muscles: lib.primary,
      equipment: lib.equipment,
      frames: frameUrls(lib.id),
      instructions: lib.instructions,
      source: 'library',
    };
  }
  if (isCustomId(exerciseId)) {
    const custom = useCustomExerciseStore.getState().exercises.find((e) => e.id === exerciseId);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        muscles: custom.muscles,
        equipment: custom.equipment,
        frames: [],
        instructions: [],
        source: 'custom',
      };
    }
  }
  return { name: fallbackName, muscles: [], frames: [], instructions: [], source: 'free-text' };
}

/** Key that groups the same exercise across sessions (id when known, else the lower-cased name). */
export const exerciseKey = (exerciseId: string | undefined, name: string) =>
  exerciseId || `name:${name.trim().toLowerCase()}`;
