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

  it('starts from the workout, logs a set with its defaults and starts the rest timer', () => {
    render(<SessionScreen />);
    expect(screen.getByText('Legs')).toBeTruthy();
    expect(screen.getByText('Barbell Squat')).toBeTruthy();
    expect(screen.getByText(/First time/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Mark set 1 done' }));
    const session = useSessionStore.getState().sessions[0]!;
    expect(session.sets).toEqual([
      expect.objectContaining({ reps: 5, weightKg: 80, exerciseId: 'Barbell_Squat', setIndex: 0 }),
    ]);
    expect(screen.getByText(/Rest 2:00|Rest 1:59/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo set 1' })).toBeTruthy();
  });

  it('resumes the session in progress instead of starting another', () => {
    const first = render(<SessionScreen />);
    first.unmount();
    render(<SessionScreen />);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });
});
