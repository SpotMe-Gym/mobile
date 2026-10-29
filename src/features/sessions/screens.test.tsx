import type { ReactElement } from 'react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import ExercisePicker from '@/app/workouts/exercise-picker';
import SessionScreen from '@/app/workouts/session';
import { useExercisePicker } from '@/features/exercises/pickerStore';
import { useSessionStore } from '@/features/sessions/sessionStore';
import { useWorkoutStore } from '@/features/workouts/workoutStore';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
// The music bar polls music sources: tested on its own.
jest.mock('@/features/music/components/MusicBar', () => ({ MusicBar: () => null }));
jest.mock('@/features/exercises/components/ExerciseAnimation', () => ({ ExerciseAnimation: () => null }));
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual('react-native');
  return { FlashList: FlatList };
});

describe('exercise picker', () => {
  it('searches the library (Italian too) and hands the choice back', () => {
    const onPick = jest.fn();
    useExercisePicker.setState({ onPick });
    render(<ExercisePicker />);
    fireEvent.changeText(screen.getByLabelText('Search: bench press, squat, panca…'), 'panca');
    const first = screen.getAllByRole('button').find((b) => /bench/i.test(b.props.accessibilityLabel ?? ''));
    expect(first).toBeTruthy();
    fireEvent.press(first!);
    fireEvent.press(screen.getByRole('button', { name: 'Add to workout' }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: expect.any(String), name: expect.stringMatching(/bench/i) }),
    );
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('workout session', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useWorkoutStore.setState({
      workouts: [
        {
          id: 'w1',
          name: 'Legs',
          duration: 40,
          exercises: [
            {
              id: 'b1',
              exerciseId: 'Barbell_Squat',
              name: 'Barbell Squat',
              sets: 2,
              reps: '5',
              weight: 80,
              restTime: 120,
              executionTime: 0,
              type: 'exercise',
            },
          ],
        },
      ],
    });
    mockParams = { workoutId: 'w1' };
  });

  it('plays the workout: set with its targets, Done logs it, then the rest timer and what comes next', () => {
    render(<SessionScreen />);
    expect(screen.getByText('Legs')).toBeTruthy();
    expect(screen.getByText('Barbell Squat')).toBeTruthy();
    expect(screen.getByText(/Set 1 of 2/)).toBeTruthy();
    // Up next while on set 1: the rest, then set 2
    expect(screen.getByText('Then rest 2:00')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Set done' }));
    const session = useSessionStore.getState().sessions[0]!;
    expect(session.sets).toEqual([
      expect.objectContaining({ reps: 5, weightKg: 80, exerciseId: 'Barbell_Squat', setIndex: 0 }),
    ]);
    // Now resting, the next set is shown
    expect(screen.getByRole('button', { name: 'Skip rest' })).toBeTruthy();
    expect(screen.getAllByText(/Set 2 of 2/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
    fireEvent.press(screen.getByRole('button', { name: 'Set done' }));
    expect(useSessionStore.getState().sessions[0]!.sets).toHaveLength(2);
    expect(screen.getByText('Workout complete')).toBeTruthy();
  });

  it('pauses and resumes', () => {
    render(<SessionScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(useSessionStore.getState().sessions[0]!.player?.pausedAt).not.toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useSessionStore.getState().sessions[0]!.player?.pausedAt).toBeNull();
  });

  it('resumes the session in progress instead of starting another', () => {
    const first = render(<SessionScreen />);
    first.unmount();
    render(<SessionScreen />);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });
});
