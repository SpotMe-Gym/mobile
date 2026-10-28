import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import { WIDGETS } from '@/features/dashboard/widgets/catalog';
import type { WidgetRenderProps } from '@/features/dashboard/widgets/types';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useBodyStore } from '@/features/body/bodyStore';
import { useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useSessionStore } from '@/features/sessions/sessionStore';
import { useWorkoutStore, emptySchedule } from '@/features/workouts/workoutStore';
import { toDayKey, isoWeekday } from '@/shared/utils/date';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('@/features/exercises/components/ExerciseAnimation', () => ({ ExerciseAnimation: () => null }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const props = (over: Partial<WidgetRenderProps> = {}): WidgetRenderProps => ({
  size: 'half',
  width: 170,
  height: 170,
  isEditing: false,
  onEnterEdit: jest.fn(),
  onOpenDetail: jest.fn(),
  onPressIn: jest.fn(),
  onPressOut: jest.fn(),
  ...over,
});
const renderWidget = (id: string, over?: Partial<WidgetRenderProps>) => {
  const def = WIDGETS.find((w) => w.id === id)!;
  const Render = def.Render;
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Render {...props(over)} />
    </SafeAreaProvider>,
  );
};

const today = toDayKey();
const daysAgo = (n: number) => toDayKey(new Date(Date.now() - n * 86_400_000));

beforeEach(() => {
  useWeightStore.setState({
    entries: [
      { id: 'a', day: daysAgo(20), kg: 81, createdAt: '' },
      { id: 'b', day: daysAgo(1), kg: 79.6, createdAt: '' },
    ],
  });
  useBodyStore.setState({
    measurements: [
      { id: 'm1', day: daysAgo(30), values: { waist: 82, hips: 100 }, createdAt: '' },
      { id: 'm2', day: daysAgo(2), values: { waist: 80.5 }, createdAt: '' },
    ] as never,
    biaReports: [],
  });
  const food = {
    code: 'yog',
    name: 'Greek yogurt',
    base: 'g' as const,
    per100: { kcal: 60, protein: 10, carbs: 4, fat: 0 },
    source: 'off' as const,
  };
  useNutritionStore.setState({
    days: {
      [today]: [
        {
          id: 'e',
          meal: 'breakfast',
          name: 'Greek yogurt',
          quantity: 200,
          unit: 'g',
          macros: { kcal: 120, protein: 20, carbs: 8, fat: 0 },
          loggedAt: '',
        },
      ],
    },
    foods: {
      yog: {
        ...food,
        meals: ['breakfast'],
        lastUsed: '',
        useCount: 5,
        lastPortion: { quantity: 200, unit: 'g' },
      },
    },
  });
  useWorkoutStore.setState({
    workouts: [
      {
        id: 'w',
        name: 'Legs day',
        duration: 45,
        exercises: [
          {
            id: 'b1',
            exerciseId: 'Barbell_Full_Squat',
            name: 'Squat',
            type: 'exercise',
            sets: 3,
            reps: '8',
            restTime: 90,
            executionTime: 40,
          },
        ],
      },
    ],
    schedule: { ...emptySchedule(), [isoWeekday()]: ['w'] },
  });
  useSessionStore.setState({ sessions: [] });
});

describe('section widgets', () => {
  it('are all in the catalog, each with a title', () => {
    const ids = WIDGETS.map((w) => w.id);
    for (const id of [
      'bodyAndWeight',
      'weightTrend',
      'measurements',
      'caloriesWeek',
      'proteinToday',
      'frequentFoods',
      'nextWorkout',
      'weeklyVolume',
      'consistency',
      'logAnything',
    ]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('body & weight slides between weight and body, tap opens the body screen', () => {
    const onOpenDetail = jest.fn();
    renderWidget('bodyAndWeight', { onOpenDetail, size: 'full', width: 360 });
    fireEvent.press(screen.getAllByRole('button')[0]!);
    expect(onOpenDetail).toHaveBeenCalled();
    expect(screen.getAllByText(/79[.,]6/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80[.,]5/).length).toBeGreaterThan(0);
  });

  it('weight trend, measurements, calories, protein, next workout, volume and consistency render', () => {
    renderWidget('weightTrend');
    expect(screen.getByText('Weight trend')).toBeTruthy();
    renderWidget('measurements');
    expect(screen.getAllByText('Waist').length).toBeGreaterThan(0);
    renderWidget('caloriesWeek');
    expect(screen.getByText(/avg 120 kcal/)).toBeTruthy();
    renderWidget('proteinToday', { size: 'compact' });
    expect(screen.getByText('Protein today')).toBeTruthy();
    renderWidget('nextWorkout', { size: 'full', width: 360 });
    expect(screen.getByText('Legs day')).toBeTruthy();
    expect(screen.getByText('Starts with Squat')).toBeTruthy();
    renderWidget('weeklyVolume');
    expect(screen.getByText(/Finish a session/)).toBeTruthy();
    renderWidget('consistency', { size: 'compact' });
    expect(screen.getByText('Consistency')).toBeTruthy();
  });

  it('frequent foods logs the usual portion in one tap', () => {
    renderWidget('frequentFoods');
    fireEvent.press(screen.getByRole('button', { name: 'Log Greek yogurt, 200 g' }));
    expect(useNutritionStore.getState().days[today]).toHaveLength(2);
  });

  it('log anything offers weight, measurements, meal and workout', () => {
    renderWidget('logAnything');
    fireEvent.press(screen.getByRole('button', { name: 'Log anything' }));
    fireEvent.press(screen.getByRole('button', { name: /log meal/i }));
    expect(mockPush).toHaveBeenCalledWith('/nutrition/search');
  });
});
