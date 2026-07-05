export interface RetryClassification {
  kind: 'auth' | 'rate_limit' | 'server' | 'network' | 'other';
  retryable: boolean;
}

export function classifyError(e: unknown): RetryClassification {
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403) return { kind: 'auth', retryable: false };
  if (status === 429) return { kind: 'rate_limit', retryable: true };
  if (status && status >= 500) return { kind: 'server', retryable: true };
  const msg = e instanceof Error ? e.message : String(e);
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|network/i.test(msg))
    return { kind: 'network', retryable: true };
  return { kind: 'other', retryable: false };
}

interface Opts {
  onAttempt?: (attemptNumber: number) => void;
  backoffMs?: (attempt: number) => number;
}

const DEFAULT_BACKOFF = (n: number): number => 2 ** n * 1000;

export async function withBackoff<T>(fn: () => Promise<T>, opts: Opts = {}): Promise<T> {
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const cls = classifyError(e);
      if (!cls.retryable || attempt === 3) throw e;
      opts.onAttempt?.(attempt + 1);
      await new Promise((r) => setTimeout(r, backoff(attempt)));
    }
  }
  throw lastError;
}
