import { useEffect, useState } from "react";
import { NotImplementedError } from "../utils/errors";

export interface AsyncResourceState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  notImplemented: boolean;
  reload: () => void;
}

export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotImplemented(false);
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof NotImplementedError) {
          setNotImplemented(true);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, notImplemented, reload: () => setTick((t) => t + 1) };
}
