import type { ReactElement, ReactNode } from 'react';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react-native';
import type { ScrollView, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import CreateWorkout from '@/app/workouts/create';
import { useWorkoutStore, type Exercise } from '@/features/workouts/workoutStore';

interface RN {
  View: typeof View;
  ScrollView: typeof ScrollView;
}

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: jest.fn(),
}));
// The drag itself runs on the UI thread (not in Jest): the list renders in order, and its
// handle is a plain view. What's tested here is the editor around it.
jest.mock('react-native-reanimated', () => {
  const rn = jest.requireActual<RN>('react-native');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (c: unknown) => c, View: rn.View },
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => undefined,
    useSharedValue: (value: unknown) => ({ value, set: jest.fn(), get: () => value }),
  };
});
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual<RN>('react-native').ScrollView,
}));
jest.mock('@/shared/ui/ReorderableList', () => {
  const rn = jest.requireActual<RN>('react-native');
  return {
    ReorderableList: ({
      items,
      keyOf,
      renderItem,
    }: {
      items: unknown[];
      keyOf: (item: unknown) => string;
      renderItem: (item: unknown, index: number) => ReactNode;
    }) => items.map((item, i) => <rn.View key={keyOf(item)}>{renderItem(item, i)}</rn.View>),
    ReorderHandle: ({
      children,
      accessibilityLabel,
    }: {
      children: ReactNode;
      accessibilityLabel: string;
    }) => <rn.View accessibilityLabel={accessibilityLabel}>{children}</rn.View>,
  };
});

const exercise = (id: string, name: string, patch: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  type: 'exercise',
  sets: 3,
  reps: '10',
  restTime: 60,
  executionTime: 0,
  ...patch,
});

function seed() {
  const exercises = [
    exercise('a', 'Bench press', { weight: 60 }),
    exercise('b', 'Plank', { reps: '1', executionTime: 45 }),
    exercise('c', 'Row', { sets: 4 }),
  ];
  useWorkoutStore.setState({
    workouts: [{ id: 'w1', name: 'Push', exercises, duration: 12 }],
  });
}

beforeEach(() => {
  mockBack.mockClear();
  mockParams = {};
});

describe('workout editor', () => {
  it('opens a new workout on its first exercise, ready to fill in', () => {
    render(<CreateWorkout />);
    expect(screen.getByText('New workout')).toBeTruthy();
    expect(screen.getByLabelText('Sets')).toBeTruthy();
    expect(screen.getByText('Tap the exercise to edit it.')).toBeTruthy();
  });

  it('shows an existing workout as one line per exercise, with its totals', () => {
    seed();
    mockParams = { id: 'w1' };
    render(<CreateWorkout />);
    expect(screen.getByText('3 × 10 · 60 kg · rest 1:00')).toBeTruthy();
    expect(screen.getByText('3 × 1 · rest 1:00 · timed 0:45')).toBeTruthy();
    expect(screen.getByText('4 × 10 · rest 1:00')).toBeTruthy();
    // 3 exercises, 10 sets, in the overview.
    expect(screen.getByLabelText(/3 exercises, 10 sets/)).toBeTruthy();
    expect(screen.getByText('Tap an exercise to edit it. Hold ≡ and drag to reorder.')).toBeTruthy();
    // Closed: no editor fields yet.
    expect(screen.queryByLabelText('Sets')).toBeNull();
    expect(screen.getByLabelText('Reorder Bench press')).toBeTruthy();
  });

  it('opens one exercise at a time', () => {
    seed();
    mockParams = { id: 'w1' };
    render(<CreateWorkout />);
    fireEvent.press(screen.getByLabelText('Plank'));
    expect(screen.getAllByLabelText('Sets')).toHaveLength(1);
    expect(screen.getByLabelText('Move Plank up')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Row'));
    expect(screen.getAllByLabelText('Sets')).toHaveLength(1);
    expect(screen.queryByLabelText('Move Plank up')).toBeNull();
    fireEvent.press(screen.getByLabelText('Row'));
    expect(screen.queryByLabelText('Sets')).toBeNull();
  });

  it('moves an exercise and saves the new order', async () => {
    seed();
    mockParams = { id: 'w1' };
    render(<CreateWorkout />);
    fireEvent.press(screen.getByLabelText('Bench press'));
    fireEvent.press(screen.getByLabelText('Move Bench press down'));
    // It stays open where it landed.
    expect(screen.getByLabelText('Move Bench press up')).toBeTruthy();
    fireEvent.press(screen.getByText('Save workout'));
    await waitFor(() =>
      expect(useWorkoutStore.getState().workouts[0]!.exercises.map((e) => e.name)).toEqual([
        'Plank',
        'Bench press',
        'Row',
      ]),
    );
  });

  it('removes an exercise from its editor', async () => {
    seed();
    mockParams = { id: 'w1' };
    render(<CreateWorkout />);
    fireEvent.press(screen.getByLabelText('Plank'));
    fireEvent.press(screen.getByLabelText('Remove Plank'));
    expect(screen.queryByText('Plank')).toBeNull();
    expect(screen.getByLabelText(/2 exercises, 7 sets/)).toBeTruthy();
  });
});
