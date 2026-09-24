import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Poll interval in ms. The dashboard uses this to reflect live backend state. */
  pollMs?: number;
  enabled?: boolean;
}

interface Result<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Read-only fetch against the Voice2Invoice API. There is no write counterpart
 * by design: the browser must never be able to trigger invoice creation.
 */
export function useApi<T>(path: string | null, { pollMs, enabled = true }: Options = {}): Result<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  // Keeps polling silent: only the first load shows a skeleton.
  const loadedOnce = useRef(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Declared before the fetch effect so a new endpoint clears state first and the
  // fetch below still knows to show a skeleton rather than a flash of "empty".
  useEffect(() => {
    loadedOnce.current = false;
    setData(null);
  }, [path]);

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      if (!loadedOnce.current) setLoading(true);
      try {
        const res = await fetch(path, { signal: controller.signal });
        if (!res.ok) {
          let message = `Request failed (${res.status})`;
          try {
            const body = await res.json();
            if (body?.error) message = body.error;
          } catch { /* non-JSON error body */ }
          throw new Error(message);
        }
        const json = (await res.json()) as T;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not reach the Voice2Invoice API');
      } finally {
        if (!cancelled) {
          loadedOnce.current = true;
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [path, enabled, tick]);

  useEffect(() => {
    if (!pollMs || !path || !enabled) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, path, enabled, refresh]);

  return { data, error, loading, refresh };
}
