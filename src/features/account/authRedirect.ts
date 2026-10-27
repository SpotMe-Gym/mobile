export type AuthRedirect = { code: string } | { error: string; description?: string };

/**
 * Reads the result of an OAuth round-trip from the redirect URL
 * (`spotme://auth/callback?code=…`, or `?error=…&error_description=…`, possibly in the fragment).
 */
export function parseAuthRedirect(url: string): AuthRedirect {
  const params: Record<string, string> = {};
  const start = url.search(/[?#]/);
  if (start !== -1) {
    for (const pair of url.slice(start + 1).split(/[?#&]/)) {
      if (!pair) continue;
      const [key, ...rest] = pair.split('=');
      if (!key) continue;
      const value = rest.join('=');
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        params[key] = value;
      }
    }
  }
  if (params.error) return { error: params.error, description: params.error_description };
  if (params.code) return { code: params.code };
  return { error: 'missing_code' };
}

/** Apple sends the name only on the first sign-in; null parts are common. */
export function formatAppleName(
  name:
    { givenName?: string | null; middleName?: string | null; familyName?: string | null } | null | undefined,
): string {
  if (!name) return '';
  return [name.givenName, name.middleName, name.familyName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ');
}
