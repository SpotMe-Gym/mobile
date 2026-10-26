import { fireEvent, render, screen } from '@testing-library/react-native';
import { Trash2 } from 'lucide-react-native';
import { IconButton } from '@/shared/ui/IconButton';

it('IconButton is announced with its label', () => {
  const onPress = jest.fn();
  render(<IconButton icon={Trash2} accessibilityLabel="Remove Oats" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Remove Oats' }));
  expect(onPress).toHaveBeenCalled();
});
