import { useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { NumberField } from '@/shared/ui/NumberField';
import { formatDayKey, fromDayKey, toDayKey, type DayKey } from '@/shared/utils/date';

interface AddWeightModalProps {
  visible: boolean;
  onClose: () => void;
  /** Weight in the display unit. */
  onSave: (weight: number, day: DayKey) => void;
  /** Pre-fill, in the display unit. */
  initialWeight: number | null;
  unit: 'kg' | 'lbs';
}

const makeSchema = (unit: 'kg' | 'lbs') =>
  z.object({
    weight: z
      .number({ message: 'required' })
      .nullable()
      .refine((v) => v !== null, 'required')
      .refine((v) => v === null || (unit === 'kg' ? v >= 20 && v <= 400 : v >= 44 && v <= 880), 'range'),
    day: z.string(),
  });

type Values = { weight: number | null; day: DayKey };

const shiftDay = (day: DayKey, by: number) => {
  const d = fromDayKey(day);
  d.setDate(d.getDate() + by);
  return toDayKey(d);
};

export function AddWeightModal({ visible, onClose, onSave, initialWeight, unit }: AddWeightModalProps) {
  const { t, i18n } = useTranslation();
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(makeSchema(unit)),
    defaultValues: { weight: initialWeight, day: toDayKey() },
  });

  // Fresh values every time the sheet opens (previously it kept the first-render weight).
  useEffect(() => {
    if (visible) reset({ weight: initialWeight, day: toDayKey() });
  }, [visible, initialWeight, reset]);

  const submit = handleSubmit((v) => {
    if (v.weight === null) return;
    onSave(v.weight, v.day);
    onClose();
  });

  const today = toDayKey();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 items-center justify-center bg-overlay/80 px-4"
      >
        <View
          className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6"
          accessibilityViewIsModal
        >
          <View className="mb-6 flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
              {t('bodyWeight.logWeight')}
            </Text>
            <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
          </View>

          <Controller
            control={control}
            name="weight"
            render={({ field, fieldState }) => (
              <NumberField
                label={t('bodyWeight.weight')}
                value={field.value}
                onChangeValue={field.onChange}
                decimals={1}
                unit={unit}
                autoFocus
                placeholder="0.0"
                className="mb-6"
                error={
                  fieldState.error
                    ? fieldState.error.message === 'range'
                      ? t('bodyWeight.weightRange')
                      : t('errors.required')
                    : undefined
                }
              />
            )}
          />

          <Controller
            control={control}
            name="day"
            render={({ field }) => (
              <View className="mb-6">
                <Text className="mb-2 ml-1 font-medium text-muted">{t('bodyWeight.date')}</Text>
                <View className="flex-row items-center justify-between rounded-xl bg-surface-elevated px-2">
                  <IconButton
                    icon={ChevronLeft}
                    variant="ghost"
                    accessibilityLabel={t('bodyWeight.previousDay')}
                    onPress={() => field.onChange(shiftDay(field.value, -1))}
                  />
                  <Text className="font-semibold capitalize text-foreground" accessibilityLiveRegion="polite">
                    {field.value === today
                      ? t('common.today')
                      : formatDayKey(field.value, i18n.language, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                  </Text>
                  <IconButton
                    icon={ChevronRight}
                    variant="ghost"
                    accessibilityLabel={t('bodyWeight.nextDay')}
                    disabled={field.value >= today}
                    onPress={() => field.onChange(shiftDay(field.value, 1))}
                  />
                </View>
              </View>
            )}
          />

          <Button label={t('bodyWeight.saveEntry')} onPress={() => void submit()} className="w-full" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
