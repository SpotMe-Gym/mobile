import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { MealPicker } from '@/components/food/MealPicker';
import { IconButton } from '@/components/ui/IconButton';
import { Trash2 } from 'lucide-react-native';

it('MealPicker exposes selected state and switches meal', () => {
  const onChange = jest.fn();
  render(<MealPicker value="lunch" onChange={onChange} />);
  expect(screen.getByRole('tab', { name: 'Lunch' }).props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByRole('tab', { name: 'Dinner' }));
  expect(onChange).toHaveBeenCalledWith('dinner');
});

it('IconButton is announced with its label', () => {
  const onPress = jest.fn();
  render(<IconButton icon={Trash2} accessibilityLabel="Remove Oats" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Remove Oats' }));
  expect(onPress).toHaveBeenCalled();
});
