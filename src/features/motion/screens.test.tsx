import type { ReactElement } from 'react';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import MotionLab from '@/app/motion/index';
import NewMotion from '@/app/motion/new';
import MotionResult from '@/app/motion/[id]';
import { analyzeExecution } from '@/features/motion/analysis/execution';
import { analyzeMachine } from '@/features/motion/analysis/machine';
import { fitMachine } from '@/features/motion/analysis/movements';
import type { Sample, Track } from '@/features/motion/analysis/track';
import { motionForAi, useMotionStore } from '@/features/motion/motionStore';

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
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [null, jest.fn()] }));

/** A lever machine filmed for two lifts: handle on an arc, load rising faster towards the end. */
function clip(): Track {
  const frames = [];
  for (let i = 0; i < 150; i++) {
    const t = i / 15;
    const a = (1 - Math.cos((2 * Math.PI * t) / 5)) / 2;
    const angle = Math.PI / 4 - (a * Math.PI) / 2;
    const s = (x: number, y: number): Sample => [x / 0.5625, y, 0.9];
    frames.push({
      t,
      p: [
        s(0.2 + 0.2 * Math.cos(angle), 0.5 + 0.2 * Math.sin(angle)),
        s(0.45, 0.8 - 0.1 * (0.6 * a + 0.2 * a * a)),
      ],
    });
  }
  return { width: 1080, height: 1920, duration: 10, frames };
}

function seed() {
  const track = clip();
  const machine = analyzeMachine(track)!;
  const store = useMotionStore.getState();
  store.reset();
  const executionId = store.add({
    kind: 'execution',
    name: 'Chest press',
    image: null,
    aspect: 0.5625,
    result: analyzeExecution(track),
  });
  const machineId = store.add({
    kind: 'machine',
    name: 'Press, row 2',
    image: null,
    aspect: 0.5625,
    movement: 'chestPress',
    result: machine,
    fit: fitMachine(machine.profile, 'chestPress'),
  });
  return { executionId, machineId };
}

beforeEach(() => {
  mockPush.mockClear();
  mockParams = {};
});

describe('Motion Lab', () => {
  it('offers the two options and lists what was saved', () => {
    seed();
    render(<MotionLab />);
    fireEvent.press(screen.getByLabelText('Record my execution'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/motion/new', params: { mode: 'execution' } });
    fireEvent.press(screen.getByLabelText('Analyse a machine'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/motion/new', params: { mode: 'machine' } });
    expect(screen.getByText('Press, row 2')).toBeTruthy();
    expect(screen.getByText(/2 reps · score/)).toBeTruthy();
    // No native tracker in tests: the screen says so instead of failing later.
    expect(screen.getByText(/iPhone only for now/)).toBeTruthy();
  });

  it('sets up a machine analysis: name, what it is for, filming tips', () => {
    mockParams = { mode: 'machine' };
    render(<NewMotion />);
    expect(screen.getByText('Leg extension')).toBeTruthy();
    expect(screen.getByText(/weight stack \(or plates\) in the picture/)).toBeTruthy();
    expect(screen.queryByText('Starts with the lowering')).toBeNull();
  });

  it('sets up an execution recording, offering the analysed machines', () => {
    seed();
    mockParams = { mode: 'execution' };
    render(<NewMotion />);
    expect(screen.getByText('Starts with the lowering')).toBeTruthy();
    fireEvent.press(screen.getByText('Press, row 2'));
    expect(screen.getByDisplayValue('Press, row 2')).toBeTruthy();
  });

  it('shows a machine: fit for the movement, profile and numbers', () => {
    const { machineId } = seed();
    mockParams = { id: machineId };
    render(<MotionResult />);
    expect(screen.getByText('Fit for Chest press')).toBeTruthy();
    expect(screen.getByText(/Good fit|Fair fit|Poor fit/)).toBeTruthy();
    expect(screen.getByText('Resistance profile')).toBeTruthy();
    expect(screen.getByText('Lifts measured')).toBeTruthy();
  });

  it('shows an execution: score and each rep', () => {
    const { executionId } = seed();
    mockParams = { id: executionId };
    render(<MotionResult />);
    expect(screen.getByText('Execution score')).toBeTruthy();
    expect(screen.getByText('Rep 1')).toBeTruthy();
    expect(screen.getByText('Rep 2')).toBeTruthy();
  });

  it('says so when the analysis is gone', () => {
    mockParams = { id: 'missing' };
    render(<MotionResult />);
    expect(screen.getByText('This analysis is no longer here.')).toBeTruthy();
  });

  it('gives the AI the numbers, not the drawings', () => {
    seed();
    const data = motionForAi(useMotionStore.getState().records);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ kind: 'machine', movement: 'chestPress' });
    expect(data[1]).toMatchObject({ kind: 'execution', reps: 2 });
    expect(JSON.stringify(data)).not.toContain('drawing');
    expect(JSON.stringify(data).length).toBeLessThan(1500);
  });
});
