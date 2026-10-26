import { useTranslation } from 'react-i18next';

/** Maps schema message codes to localised copy. */
export function useFieldError() {
  const { t } = useTranslation();
  return (code: string | undefined, range?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'range') return range ?? t('errors.invalidNumber');
    if (code === 'tooLong') return t('errors.tooLong');
    return t('errors.required');
  };
}
