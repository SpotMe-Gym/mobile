import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { WeightPanel } from '@/features/body/components/WeightPanel';
import { useWeightStore } from '@/features/body-weight/weightStore';

describe('WeightPanel (right half of the body card)', () => {
  it('shows the latest weight, the change and a way to log a new one', () => {
    useWeightStore.setState({
      entries: [
        { id: 'a', day: '2026-10-20', kg: 80, createdAt: '2026-10-20T07:00:00.000Z' },
        { id: 'b', day: '2026-10-27', kg: 79.4, createdAt: '2026-10-27T07:00:00.000Z' },
      ],
    });
    render(<WeightPanel heightLabel="Height 175 cm" />);
    expect(screen.getByText(/79\.4/)).toBeTruthy();
    expect(screen.getByText(/0\.6 kg/)).toBeTruthy();
    expect(screen.getByText('Height 175 cm')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Log weight' }));
  });
});
