import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { MeasurementDef } from '@/features/body/measurementCatalog';
import type { Tone } from '@/features/body/avatar/zoneColors';

interface MeasurementRowProps {
  def: MeasurementDef;
  /** Logged value (cm), if any. */
  value?: number;
  /** What the 3D model measures there when nothing is logged (cm). */
  estimate?: number;
  /** Change vs the baseline (cm). */
  delta?: number;
  tone: Tone;
  unit: string;
  format: (cm: number | undefined, signed?: boolean) => string;
  sinceLabel?: string;
  last?: boolean;
}

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-success/15 text-success-text',
  bad: 'bg-danger/15 text-danger-text',
  neutral: 'bg-surface-elevated text-muted',
};

export function MeasurementRow({ def, value, estimate, delta, tone, unit, format, sinceLabel, last }: MeasurementRowProps) {
  const { t } = useTranslation();
  const label = t(def.labelKey);
  const shown = value ?? estimate;
  const isEstimate = value === undefined;
  const a11y = isEstimate
    ? `${label}: ${t('body.estimatedA11y', { value: format(estimate), unit })}`
    : delta !== undefined && sinceLabel
      ? t('body.deltaA11y', { label, value: format(value), unit, change: format(delta, true), date: sinceLabel })
      : `${label}: ${format(value)} ${unit}`;

  return (
    <View
      accessible
      accessibilityLabel={a11y}
      className={cn('flex-row items-center justify-between px-4 py-3', !last && 'border-b border-border')}
    >
      <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {isEstimate && shown !== undefined && (
          <Text className="rounded-md bg-surface-elevated px-1.5 py-0.5 text-xs text-subtle">{t('body.estimated')}</Text>
        )}
        <Text className={cn('text-base font-semibold', isEstimate ? 'text-subtle' : 'text-foreground')}>
          {format(shown)} <Text className="text-xs font-normal text-subtle">{unit}</Text>
        </Text>
        {delta !== undefined && !isEstimate && (
          <Text className={cn('min-w-14 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold', TONE_CLASS[tone])}>
            {format(delta, true)}
          </Text>
        )}
      </View>
    </View>
  );
}
