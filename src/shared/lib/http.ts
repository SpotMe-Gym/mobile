export type ApiErrorKind = 'offline' | 'timeout' | 'server' | 'not-found' | 'invalid-response';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? kind);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * fetch + timeout + caller cancellation, mapping failures to ApiError kinds the UI can
 * explain ("Unable to connect…") instead of silently returning empty results.
 */
export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 12_000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ApiError('timeout')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    if (res.status === 404) throw new ApiError('not-found', undefined, 404);
    if (!res.ok) throw new ApiError('server', `HTTP ${res.status}`, res.status);
    try {
      return await res.json();
    } catch {
      throw new ApiError('invalid-response');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      // Caller cancellation (query unmounted) is re-thrown as-is so TanStack Query ignores it.
      if (signal?.aborted) throw error;
      throw new ApiError('timeout');
    }
    throw new ApiError('offline', error instanceof Error ? error.message : undefined);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
