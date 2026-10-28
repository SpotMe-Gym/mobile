import { create } from 'zustand';

export interface PickedExercise {
  exerciseId: string;
  name: string;
}

/**
 * Hand-off between a screen that needs an exercise and the picker screen: the caller sets
 * `onPick`, opens the picker, and the picker calls it once with the choice.
 */
export const useExercisePicker = create<{ onPick: ((e: PickedExercise) => void) | null }>(() => ({
  onPick: null,
}));

export function requestExercise(onPick: (e: PickedExercise) => void) {
  useExercisePicker.setState({ onPick });
}
