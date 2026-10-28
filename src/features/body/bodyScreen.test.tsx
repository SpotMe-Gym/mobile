import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import BodyScreen from '@/app/body';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useBodyStore } from '@/features/body/bodyStore';

jest.mock('@/shared/expandable-card/ExpandableCardLayout', () => ({
  ExpandableCardLayoutWithContext: ({ children }: { children: ReactNode }) => children,
  useExpandableCardContext: () => ({
    handleClose: jest.fn(),
    isExpanded: false,
    cardDimensions: { cardWidth: 100, cardHeight: 100 },
    widgetSize: 'half',
  }),
}));
jest.mock('@/features/body/components/BodyViewer', () => ({ BodyViewer: () => null }));
jest.mock('@/features/body/hooks/useBodyAvatar', () => ({
  useBodyAvatar: () => ({
    model: null,
    failed: false,
    current: { heightCm: 175, measurements: { waist: 80 } },
    baseline: null,
    deltas: {},
    solution: null,
    positions: null,
    colors: null,
    goal: 'maintain',
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Body screen', () => {
  beforeEach(() => {
    useWeightStore.setState({
      entries: Array.from({ length: 7 }, (_, i) => ({
        id: `w${i}`,
        day: `2026-10-${String(20 + i).padStart(2, '0')}`,
        kg: 80 - i * 0.2,
        createdAt: `2026-10-${20 + i}T07:00:00.000Z`,
      })),
    });
    useBodyStore.setState({ measurements: [], biaReports: [] });
  });

  it('slides between weight and the 3D body, with both logs below', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BodyScreen />
      </SafeAreaProvider>,
    );
    // Slider pages and their tabs
    expect(screen.getByRole('tab', { name: 'Weight' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: '3D body' }));
    // Logs
    expect(screen.getByText('Weight log')).toBeTruthy();
    expect(screen.getByText('Measurements log')).toBeTruthy();
    // 5 newest weights, then "show all"
    fireEvent.press(screen.getByRole('button', { name: 'Show all (7)' }));
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log weight' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log measurements' })).toBeTruthy();
  });
});
