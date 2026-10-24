import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';

interface DurationFieldProps {
  seconds: number;
  onChange: (seconds: number) => void;
  label: string;
}

const clampInt = (text: string, max: number) => {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  return digits === '' ? 0 : Math.min(max, parseInt(digits, 10));
};

/** mm:ss editor. Controlled — always shows the current value (no stale defaultValue). */
export function DurationField({ seconds, onChange, label }: DurationFieldProps) {
  const { t } = useTranslation();
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <View className="flex-row items-center gap-1" accessible={false}>
      <TextInput
        value={m === 0 && s === 0 ? '' : String(m)}
        onChangeText={(v) => onChange(clampInt(v, 30) * 60 + s)}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.placeholder}
        selectTextOnFocus
        accessibilityLabel={`${label}, ${t('workouts.minutes')}`}
        className="min-w-6 p-0 text-right text-lg font-bold text-foreground"
      />
      <Text className="pt-1 text-xs font-medium text-subtle">{t('workouts.minutesShort')}</Text>
      <TextInput
        value={m === 0 && s === 0 ? '' : String(s).padStart(2, '0')}
        onChangeText={(v) => onChange(m * 60 + clampInt(v, 59))}
        keyboardType="number-pad"
        placeholder="00"
        placeholderTextColor={colors.placeholder}
        selectTextOnFocus
        accessibilityLabel={`${label}, ${t('workouts.seconds')}`}
        className="min-w-7 p-0 text-right text-lg font-bold text-foreground"
      />
      <Text className="pt-1 text-xs font-medium text-subtle">{t('workouts.secondsShort')}</Text>
    </View>
  );
}
