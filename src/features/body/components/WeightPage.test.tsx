import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import { WeightPage } from '@/features/body/components/WeightPage';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { toDayKey } from '@/shared/utils/date';

describe('WeightPage (first page of the body slider)', () => {
  it('shows the latest weight, the change and the height', () => {
    useWeightStore.setState({
      entries: [
        {
          id: 'a',
          day: toDayKey(new Date(Date.now() - 8 * 86_400_000)),
          kg: 80,
          createdAt: '2026-10-20T07:00:00.000Z',
        },
        {
          id: 'b',
          day: toDayKey(new Date(Date.now() - 86_400_000)),
          kg: 79.4,
          createdAt: '2026-10-27T07:00:00.000Z',
        },
      ],
    });
    render(<WeightPage height={320} heightLabel="Height 175 cm" />);
    expect(screen.getAllByText(/79[.,]4/).length).toBeGreaterThan(0);
    // The change since the last entry and over 30 days
    expect(screen.getAllByText(/0[.,]6/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Entries')).toBeTruthy();
    expect(screen.getByText('Height 175 cm')).toBeTruthy();
  });
});
