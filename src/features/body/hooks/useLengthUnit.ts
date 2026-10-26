import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/features/profile/userStore';
import { formatNumber } from '@/shared/utils/number';

const CM_PER_IN = 2.54;

/** Circumferences follow the height unit: cm, or inches for ft/in users. Storage is always cm. */
export function useLengthUnit() {
  const { i18n } = useTranslation();
  const unit = useUserStore((s) => (s.units.height === 'ft' ? 'in' : 'cm'));
  const toDisplay = useCallback((cm: number) => (unit === 'in' ? cm / CM_PER_IN : cm), [unit]);
  const fromDisplay = useCallback((v: number) => (unit === 'in' ? v * CM_PER_IN : v), [unit]);
  const format = useCallback(
    (cm: number | undefined, signed = false) => {
      if (cm === undefined || !Number.isFinite(cm)) return '--';
      const v = toDisplay(cm);
      const text = formatNumber(Math.abs(v), i18n.language, 1);
      if (!signed) return formatNumber(v, i18n.language, 1);
      return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${text}`;
    },
    [toDisplay, i18n.language],
  );
  return { unit, toDisplay, fromDisplay, format } as const;
}
