/**
 * Central error reporting. Swap the body for Sentry (`Sentry.captureException`) when a DSN
 * is configured — call sites stay the same. Never attach health data (weights, foods,
 * names) to `extra`.
 */
export function reportError(error: unknown, extra?: Record<string, string | number | boolean>): void {
  if (__DEV__) {
    console.error('[SpotMe]', error, extra ?? '');
  }
}
