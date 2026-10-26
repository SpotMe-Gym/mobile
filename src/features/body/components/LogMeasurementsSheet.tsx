import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { NumberField } from '@/shared/ui/NumberField';
import { colors } from '@/theme/colors';
import { MEASUREMENTS, type MeasurementDef } from '@/features/body/measurementCatalog';
import { useLengthUnit } from '@/features/body/hooks/useLengthUnit';
import type { MeasurementKey, MeasurementValues } from '@/features/body/types';

interface LogMeasurementsSheetProps {
  visible: boolean;
  /** Latest known values (cm) — shown as placeholders, not prefilled. */
  previous: MeasurementValues;
  onClose: () => void;
  onSave: (values: MeasurementValues) => void;
}

type Draft = Partial<Record<MeasurementKey, number | null>>;

/** Page sheet with every circumference; blank fields are simply not logged. */
export function LogMeasurementsSheet({ visible, previous, onClose, onSave }: LogMeasurementsSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { unit, fromDisplay, format } = useLengthUnit();
  const [draft, setDraft] = useState<Draft>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);

  // Fresh form each time the sheet opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft({});
      setSubmitted(false);
    }
  }

  const errorFor = (def: MeasurementDef): string | undefined => {
    const v = draft[def.key];
    if (v === null || v === undefined) return undefined;
    const cm = fromDisplay(v);
    if (cm < def.min || cm > def.max) {
      return t('body.outOfRange', { min: format(def.min), max: format(def.max), unit });
    }
    return undefined;
  };

  const filled = MEASUREMENTS.filter((d) => typeof draft[d.key] === 'number');
  const hasErrors = filled.some((d) => errorFor(d));

  const save = () => {
    setSubmitted(true);
    if (filled.length === 0 || hasErrors) return;
    const values: MeasurementValues = {};
    for (const d of filled) values[d.key] = fromDisplay(draft[d.key] as number);
    onSave(values);
    onClose();
  };

  const field = (def: MeasurementDef) => {
    const last = previous[def.key];
    return (
      <NumberField
        key={def.key}
        label={t(def.labelKey)}
        value={draft[def.key] ?? null}
        onChangeValue={(v) => setDraft((d) => ({ ...d, [def.key]: v }))}
        decimals={1}
        unit={unit}
        placeholder={last !== undefined ? format(last) : '0.0'}
        error={errorFor(def)}
        className="mb-4 w-[48%]"
        returnKeyType="next"
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface-sunken">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
            {t('body.logMeasurements')}
          </Text>
          <IconButton icon={X} variant="ghost" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        >
          <Text className="mb-5 text-sm text-muted">{t('body.logHint')}</Text>

          <View className="flex-row flex-wrap justify-between">
            {MEASUREMENTS.filter((d) => d.group === 'primary').map(field)}
          </View>

          <Pressable
            onPress={() => setShowAdvanced((s) => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            accessibilityLabel={showAdvanced ? t('body.hideAdvanced') : t('body.showAdvanced')}
            className="mb-4 h-12 flex-row items-center justify-between rounded-xl bg-surface px-4"
          >
            <Text className="font-semibold text-foreground">{t('body.advanced')}</Text>
            <Icon icon={showAdvanced ? ChevronUp : ChevronDown} size={20} color={colors.muted} />
          </Pressable>

          {showAdvanced && (
            <View className="flex-row flex-wrap justify-between">
              {MEASUREMENTS.filter((d) => d.group === 'advanced').map(field)}
            </View>
          )}

          {submitted && filled.length === 0 && (
            <Text className="mb-3 text-center text-sm text-danger-text" accessibilityLiveRegion="polite">
              {t('body.nothingToSave')}
            </Text>
          )}
          <Button label={t('body.save')} onPress={save} className="mt-2 w-full" disabled={submitted && hasErrors} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

