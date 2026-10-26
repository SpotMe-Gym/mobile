import { useTranslation } from 'react-i18next';
import { isApiError } from '@/shared/lib/http';

/** Friendly, non-technical copy for a failed request (language-i18n rule: tone). */
export function useApiErrorMessage(error: unknown): string | null {
  const { t } = useTranslation();
  if (!error) return null;
  if (!isApiError(error)) return t('errors.generic');
  switch (error.kind) {
    case 'offline':
      return t('errors.offline');
    case 'timeout':
      return t('errors.timeout');
    case 'not-found':
      return t('errors.notFound');
    default:
      return t('errors.server');
  }
}
