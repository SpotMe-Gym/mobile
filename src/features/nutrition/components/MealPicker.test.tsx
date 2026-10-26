import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { MealPicker } from '@/features/nutrition/components/MealPicker';

it('MealPicker exposes selected state and switches meal', () => {
  const onChange = jest.fn();
  render(<MealPicker value="lunch" onChange={onChange} />);
  expect(screen.getByRole('tab', { name: 'Lunch' }).props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByRole('tab', { name: 'Dinner' }));
  expect(onChange).toHaveBeenCalledWith('dinner');
});
