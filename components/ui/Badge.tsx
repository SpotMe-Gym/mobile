import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <View
      className={cn(
        'self-start rounded-full border border-border-strong bg-surface-elevated px-2 py-0.5',
        className,
      )}
    >
      <Text className="text-xs font-semibold text-muted">{label}</Text>
    </View>
  );
}
