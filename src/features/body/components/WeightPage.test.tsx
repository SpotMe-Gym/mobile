import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import { WeightPage } from '@/features/body/components/WeightPage';
import { useWeightStore } from '@/features/body-weight/weightStore';

describe('WeightPage (first page of the body slider)', () => {
  it('shows the latest weight, the change and the height', () => {
    useWeightStore.setState({
      entries: [
        { id: 'a', day: '2026-10-20', kg: 80, createdAt: '2026-10-20T07:00:00.000Z' },
        { id: 'b', day: '2026-10-27', kg: 79.4, createdAt: '2026-10-27T07:00:00.000Z' },
      ],
    });
    render(<WeightPage height={320} heightLabel="Height 175 cm" />);
    expect(screen.getAllByText(/79[.,]4/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0[.,]6/)).toBeTruthy();
    expect(screen.getByText('Height 175 cm')).toBeTruthy();
  });
});
